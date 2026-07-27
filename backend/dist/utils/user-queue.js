"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FairConcurrencyQueue = exports.UserSerialQueue = void 0;
const logger_1 = require("../config/logger");
class UserSerialQueue {
    queues = new Map();
    enqueue(userId, taskFn) {
        const previous = this.queues.get(userId) || Promise.resolve();
        const next = previous
            .then(taskFn)
            .catch((err) => {
            logger_1.logger.error({ err, userId }, 'Error in UserSerialQueue task execution');
            throw err;
        });
        const safeNext = next.catch(() => { });
        this.queues.set(userId, safeNext);
        safeNext.finally(() => {
            if (this.queues.get(userId) === safeNext) {
                this.queues.delete(userId);
            }
        });
        return next;
    }
    getQueueSize() {
        return this.queues.size;
    }
    isUserBusy(userId) {
        return this.queues.has(userId);
    }
}
exports.UserSerialQueue = UserSerialQueue;
class FairConcurrencyQueue {
    maxGlobalConcurrency;
    maxPendingPerUser;
    requestTimeoutMs;
    userQueues = new Map();
    readyUsers = [];
    activeUsers = new Set();
    currentGlobalConcurrency = 0;
    constructor(maxGlobalConcurrency, maxPendingPerUser, requestTimeoutMs) {
        this.maxGlobalConcurrency = maxGlobalConcurrency;
        this.maxPendingPerUser = maxPendingPerUser;
        this.requestTimeoutMs = requestTimeoutMs;
    }
    enqueueTask(userId, taskFn) {
        return new Promise((resolve, reject) => {
            let queue = this.userQueues.get(userId);
            if (!queue) {
                queue = [];
                this.userQueues.set(userId, queue);
            }
            if (queue.length >= this.maxPendingPerUser) {
                return reject(new Error(`Max queue size (${this.maxPendingPerUser}) exceeded for user ${userId}`));
            }
            queue.push({ taskFn, resolve, reject, retryCount: 0 });
            if (!this.activeUsers.has(userId) && !this.readyUsers.includes(userId)) {
                this.readyUsers.push(userId);
            }
            this.processScheduler();
        });
    }
    processScheduler() {
        while (this.currentGlobalConcurrency < this.maxGlobalConcurrency && this.readyUsers.length > 0) {
            const userId = this.readyUsers.shift();
            const queue = this.userQueues.get(userId);
            if (!queue || queue.length === 0) {
                this.userQueues.delete(userId);
                continue;
            }
            if (this.activeUsers.has(userId)) {
                continue;
            }
            const task = queue.shift();
            this.activeUsers.add(userId);
            this.currentGlobalConcurrency++;
            this.executeTaskWorker(userId, task);
        }
    }
    async executeTaskWorker(userId, task) {
        let isTransientRetry = false;
        let delayMs = 0;
        try {
            const result = await Promise.race([
                task.taskFn(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), this.requestTimeoutMs))
            ]);
            task.resolve(result);
        }
        catch (error) {
            const isTransient = error.status === 429 || error.status >= 500 || error.name === 'TimeoutError' || error.message === 'Request timed out' || error instanceof SyntaxError;
            if (isTransient && task.retryCount < 5) {
                isTransientRetry = true;
                task.retryCount++;
                const retryAfter = error.headers?.['retry-after'] || error.response?.headers?.['retry-after'];
                if (retryAfter && !isNaN(parseInt(retryAfter, 10))) {
                    delayMs = parseInt(retryAfter, 10) * 1000;
                }
                else {
                    const baseDelay = Math.pow(2, task.retryCount) * 1000;
                    const jitter = Math.random() * 2000;
                    delayMs = baseDelay + jitter;
                }
                logger_1.logger.warn(`Transient error. User ${userId} retrying in ${Math.round(delayMs)}ms (Attempt ${task.retryCount}/5)`);
                const queue = this.userQueues.get(userId) || [];
                queue.unshift(task);
                this.userQueues.set(userId, queue);
            }
            else {
                if (task.retryCount >= 5) {
                    logger_1.logger.error({ error }, `Task for user ${userId} discarded after 5 failed retries.`);
                }
                else {
                    logger_1.logger.error({ error }, `Task for user ${userId} failed due to a non-transient error.`);
                }
                task.reject(error);
            }
        }
        finally {
            this.currentGlobalConcurrency--;
            if (isTransientRetry) {
                setTimeout(() => {
                    this.activeUsers.delete(userId);
                    if (!this.readyUsers.includes(userId)) {
                        this.readyUsers.push(userId);
                    }
                    this.processScheduler();
                }, delayMs);
            }
            else {
                this.activeUsers.delete(userId);
                const remainingQueue = this.userQueues.get(userId);
                if (remainingQueue && remainingQueue.length > 0) {
                    if (!this.readyUsers.includes(userId)) {
                        this.readyUsers.push(userId);
                    }
                }
                else {
                    this.userQueues.delete(userId);
                }
            }
            this.processScheduler();
        }
    }
}
exports.FairConcurrencyQueue = FairConcurrencyQueue;
