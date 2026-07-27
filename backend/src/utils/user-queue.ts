import { logger } from '../config/logger';

export class UserSerialQueue {
  private queues = new Map<string, Promise<any>>();

  public enqueue<T>(userId: string, taskFn: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(userId) || Promise.resolve();

    const next = previous
      .then(taskFn)
      .catch((err) => {
        logger.error({ err, userId }, 'Error in UserSerialQueue task execution');
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

  public getQueueSize(): number {
    return this.queues.size;
  }

  public isUserBusy(userId: string): boolean {
    return this.queues.has(userId);
  }
}

export interface Task<T = any> {
  taskFn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
  retryCount: number;
}

export class FairConcurrencyQueue {
  private userQueues = new Map<string, Task[]>();
  private readyUsers: string[] = [];
  private activeUsers = new Set<string>();
  private currentGlobalConcurrency = 0;

  constructor(
    private maxGlobalConcurrency: number,
    private maxPendingPerUser: number,
    private requestTimeoutMs: number
  ) { }

  public enqueueTask<T>(userId: string, taskFn: () => Promise<T>): Promise<T> {
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

  private processScheduler() {
    while (this.currentGlobalConcurrency < this.maxGlobalConcurrency && this.readyUsers.length > 0) {
      const userId = this.readyUsers.shift()!;
      const queue = this.userQueues.get(userId);

      if (!queue || queue.length === 0) {
        this.userQueues.delete(userId);
        continue;
      }

      if (this.activeUsers.has(userId)) {
        continue;
      }

      const task = queue.shift()!;
      this.activeUsers.add(userId);
      this.currentGlobalConcurrency++;

      this.executeTaskWorker(userId, task);
    }
  }

  private async executeTaskWorker(userId: string, task: Task) {
    let isTransientRetry = false;
    let delayMs = 0;

    try {
      const result = await Promise.race([
        task.taskFn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timed out')), this.requestTimeoutMs)
        )
      ]);

      task.resolve(result);
    } catch (error: any) {
      const isTransient = error.status === 429 || error.status >= 500 || error.name === 'TimeoutError' || error.message === 'Request timed out' || error instanceof SyntaxError;

      if (isTransient && task.retryCount < 5) {
        isTransientRetry = true;
        task.retryCount++;

        const retryAfter = error.headers?.['retry-after'] || error.response?.headers?.['retry-after'];
        if (retryAfter && !isNaN(parseInt(retryAfter, 10))) {
          delayMs = parseInt(retryAfter, 10) * 1000;
        } else {
          const baseDelay = Math.pow(2, task.retryCount) * 1000;
          const jitter = Math.random() * 2000;
          delayMs = baseDelay + jitter;
        }

        logger.warn(`Transient error. User ${userId} retrying in ${Math.round(delayMs)}ms (Attempt ${task.retryCount}/5)`);

        const queue = this.userQueues.get(userId) || [];
        queue.unshift(task);
        this.userQueues.set(userId, queue);
      } else {
        if (task.retryCount >= 5) {
          logger.error({ error }, `Task for user ${userId} discarded after 5 failed retries.`);
        } else {
          logger.error({ error }, `Task for user ${userId} failed due to a non-transient error.`);
        }
        task.reject(error);
      }
    } finally {
      this.currentGlobalConcurrency--;

      if (isTransientRetry) {
        setTimeout(() => {
          this.activeUsers.delete(userId);
          if (!this.readyUsers.includes(userId)) {
            this.readyUsers.push(userId);
          }
          this.processScheduler();
        }, delayMs);
      } else {
        this.activeUsers.delete(userId);
        const remainingQueue = this.userQueues.get(userId);
        if (remainingQueue && remainingQueue.length > 0) {
          if (!this.readyUsers.includes(userId)) {
            this.readyUsers.push(userId);
          }
        } else {
          this.userQueues.delete(userId);
        }
      }

      this.processScheduler();
    }
  }
}
