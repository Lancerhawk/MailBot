"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FairConcurrencyQueue = exports.UserSerialQueue = void 0;
const logger_1 = require("../config/logger");
const SERIAL_LOCK_TTL = 120;
const SERIAL_RETRY_DELAY = 200;
const CONCURRENCY_KEY = 'queue:fair:concurrency';
const CONCURRENCY_TTL = 300;
const ACTIVE_USER_TTL = 120;
class UserSerialQueue {
    queues = new Map();
    name;
    cache;
    constructor(name = 'default', cache) {
        this.name = name;
        this.cache = cache || null;
    }
    enqueue(userId, taskFn) {
        const previous = this.queues.get(userId) || Promise.resolve();
        const wrappedTask = async () => {
            if (this.cache) {
                const lockKey = `queue:serial:lock:${this.name}:${userId}`;
                let acquired = false;
                let attempts = 0;
                while (!acquired && attempts < 15) {
                    acquired = await this.cache.acquireLock(lockKey, SERIAL_LOCK_TTL);
                    if (!acquired) {
                        attempts++;
                        await new Promise(r => setTimeout(r, SERIAL_RETRY_DELAY * attempts));
                    }
                }
                if (!acquired) {
                    logger_1.logger.warn({ userId, queueName: this.name }, 'UserSerialQueue: Could not acquire distributed lock after retries. Proceeding with local-only serialization.');
                }
                try {
                    return await taskFn();
                }
                finally {
                    if (acquired) {
                        await this.cache.releaseLock(lockKey).catch((err) => {
                            logger_1.logger.warn({ err, lockKey }, 'UserSerialQueue: Failed to release distributed lock');
                        });
                    }
                }
            }
            return taskFn();
        };
        const next = previous
            .then(wrappedTask)
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
    cache;
    constructor(maxGlobalConcurrency, maxPendingPerUser, requestTimeoutMs, cache) {
        this.maxGlobalConcurrency = maxGlobalConcurrency;
        this.maxPendingPerUser = maxPendingPerUser;
        this.requestTimeoutMs = requestTimeoutMs;
        this.cache = cache || null;
    }
    get useDistributed() {
        return this.cache !== null;
    }
    async acquireSlot() {
        if (!this.useDistributed) {
            if (this.currentGlobalConcurrency < this.maxGlobalConcurrency) {
                this.currentGlobalConcurrency++;
                return true;
            }
            return false;
        }
        try {
            const client = this.cache.getRedisClient();
            if (client && client.isOpen) {
                const current = await client.incr(CONCURRENCY_KEY);
                await client.expire(CONCURRENCY_KEY, CONCURRENCY_TTL);
                if (current <= this.maxGlobalConcurrency) {
                    this.currentGlobalConcurrency++;
                    return true;
                }
                await client.decr(CONCURRENCY_KEY);
                return false;
            }
        }
        catch (err) {
            logger_1.logger.warn({ err }, 'FairConcurrencyQueue: Redis acquireSlot failed. Falling back to memory.');
        }
        if (this.currentGlobalConcurrency < this.maxGlobalConcurrency) {
            this.currentGlobalConcurrency++;
            return true;
        }
        return false;
    }
    async releaseSlot() {
        this.currentGlobalConcurrency = Math.max(0, this.currentGlobalConcurrency - 1);
        if (!this.useDistributed)
            return;
        try {
            const client = this.cache.getRedisClient();
            if (client && client.isOpen) {
                const val = await client.decr(CONCURRENCY_KEY);
                if (val < 0) {
                    await client.set(CONCURRENCY_KEY, '0', { EX: CONCURRENCY_TTL });
                }
            }
        }
        catch (err) {
            logger_1.logger.warn({ err }, 'FairConcurrencyQueue: Redis releaseSlot failed.');
        }
    }
    async markUserActive(userId) {
        this.activeUsers.add(userId);
        if (!this.useDistributed)
            return true;
        try {
            const acquired = await this.cache.acquireLock(`queue:fair:active:${userId}`, ACTIVE_USER_TTL);
            if (!acquired) {
                this.activeUsers.delete(userId);
                return false;
            }
            return true;
        }
        catch (err) {
            logger_1.logger.warn({ err, userId }, 'FairConcurrencyQueue: Redis markUserActive failed. Using memory only.');
            return true;
        }
    }
    async clearUserActive(userId) {
        this.activeUsers.delete(userId);
        if (!this.useDistributed)
            return;
        try {
            await this.cache.releaseLock(`queue:fair:active:${userId}`);
        }
        catch (err) {
            logger_1.logger.warn({ err, userId }, 'FairConcurrencyQueue: Redis clearUserActive failed.');
        }
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
    async processScheduler() {
        while (this.readyUsers.length > 0) {
            const slotAvailable = await this.acquireSlot();
            if (!slotAvailable)
                break;
            const userId = this.readyUsers.shift();
            if (!userId) {
                await this.releaseSlot();
                break;
            }
            const queue = this.userQueues.get(userId);
            if (!queue || queue.length === 0) {
                this.userQueues.delete(userId);
                await this.releaseSlot();
                continue;
            }
            if (this.activeUsers.has(userId)) {
                await this.releaseSlot();
                continue;
            }
            const userMarked = await this.markUserActive(userId);
            if (!userMarked) {
                if (!this.readyUsers.includes(userId)) {
                    this.readyUsers.push(userId);
                }
                await this.releaseSlot();
                continue;
            }
            const task = queue.shift();
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
            await this.releaseSlot();
            if (isTransientRetry) {
                setTimeout(async () => {
                    await this.clearUserActive(userId);
                    if (!this.readyUsers.includes(userId)) {
                        this.readyUsers.push(userId);
                    }
                    this.processScheduler();
                }, delayMs);
            }
            else {
                await this.clearUserActive(userId);
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
