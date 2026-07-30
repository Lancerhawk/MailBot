import { logger } from '../config/logger';
import type { CacheService } from '../lib/cache.service';

const SERIAL_LOCK_TTL = 120;
const SERIAL_RETRY_DELAY = 200;
const CONCURRENCY_KEY = 'queue:fair:concurrency';
const CONCURRENCY_TTL = 300;
const ACTIVE_USER_TTL = 120;

export class UserSerialQueue {
  private queues = new Map<string, Promise<any>>();
  private name: string;
  private cache: CacheService | null;

  constructor(name: string = 'default', cache?: CacheService) {
    this.name = name;
    this.cache = cache || null;
  }

  public enqueue<T>(userId: string, taskFn: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(userId) || Promise.resolve();

    const wrappedTask = async (): Promise<T> => {
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
          logger.warn({ userId, queueName: this.name }, 'UserSerialQueue: Could not acquire distributed lock after retries. Proceeding with local-only serialization.');
        }

        try {
          return await taskFn();
        } finally {
          if (acquired) {
            await this.cache.releaseLock(lockKey).catch((err: any) => {
              logger.warn({ err, lockKey }, 'UserSerialQueue: Failed to release distributed lock');
            });
          }
        }
      }

      return taskFn();
    };

    const next = previous
      .then(wrappedTask)
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
  private cache: CacheService | null;

  constructor(
    private maxGlobalConcurrency: number,
    private maxPendingPerUser: number,
    private requestTimeoutMs: number,
    cache?: CacheService
  ) {
    this.cache = cache || null;
  }

  private get useDistributed(): boolean {
    return this.cache !== null;
  }

  private async acquireSlot(): Promise<boolean> {
    if (!this.useDistributed) {
      if (this.currentGlobalConcurrency < this.maxGlobalConcurrency) {
        this.currentGlobalConcurrency++;
        return true;
      }
      return false;
    }

    try {
      const client = this.cache!.getRedisClient();
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
    } catch (err) {
      logger.warn({ err }, 'FairConcurrencyQueue: Redis acquireSlot failed. Falling back to memory.');
    }

    if (this.currentGlobalConcurrency < this.maxGlobalConcurrency) {
      this.currentGlobalConcurrency++;
      return true;
    }
    return false;
  }

  private async releaseSlot(): Promise<void> {
    this.currentGlobalConcurrency = Math.max(0, this.currentGlobalConcurrency - 1);

    if (!this.useDistributed) return;

    try {
      const client = this.cache!.getRedisClient();
      if (client && client.isOpen) {
        const val = await client.decr(CONCURRENCY_KEY);
        if (val < 0) {
          await client.set(CONCURRENCY_KEY, '0', { EX: CONCURRENCY_TTL });
        }
      }
    } catch (err) {
      logger.warn({ err }, 'FairConcurrencyQueue: Redis releaseSlot failed.');
    }
  }

  private async markUserActive(userId: string): Promise<boolean> {
    this.activeUsers.add(userId);

    if (!this.useDistributed) return true;

    try {
      const acquired = await this.cache!.acquireLock(`queue:fair:active:${userId}`, ACTIVE_USER_TTL);
      if (!acquired) {
        this.activeUsers.delete(userId);
        return false;
      }
      return true;
    } catch (err) {
      logger.warn({ err, userId }, 'FairConcurrencyQueue: Redis markUserActive failed. Using memory only.');
      return true;
    }
  }

  private async clearUserActive(userId: string): Promise<void> {
    this.activeUsers.delete(userId);

    if (!this.useDistributed) return;

    try {
      await this.cache!.releaseLock(`queue:fair:active:${userId}`);
    } catch (err) {
      logger.warn({ err, userId }, 'FairConcurrencyQueue: Redis clearUserActive failed.');
    }
  }

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

  private async processScheduler() {
    while (this.readyUsers.length > 0) {
      const slotAvailable = await this.acquireSlot();
      if (!slotAvailable) break;

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

      const task = queue.shift()!;
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
      await this.releaseSlot();

      if (isTransientRetry) {
        setTimeout(async () => {
          await this.clearUserActive(userId);
          if (!this.readyUsers.includes(userId)) {
            this.readyUsers.push(userId);
          }
          this.processScheduler();
        }, delayMs);
      } else {
        await this.clearUserActive(userId);
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
