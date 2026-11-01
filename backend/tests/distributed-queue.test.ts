import { createClient } from 'redis';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CacheService } from '../src/lib/cache.service';
import { FairConcurrencyQueue, UserSerialQueue } from '../src/utils/user-queue';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cleanRedisKeys(client: ReturnType<typeof createClient>) {
  const keys = await client.keys('queue:*');
  if (keys.length > 0) {
    await client.del(keys);
  }
}

describe('memory-only queue fallback', () => {
  it('runs FairConcurrencyQueue and UserSerialQueue without a cache service', async () => {
    const queue = new FairConcurrencyQueue(2, 100, 30000);
    const serialQueue = new UserSerialQueue('mem-test');
    const results: string[] = [];

    await Promise.all([
      queue.enqueueTask('user-mem', async () => {
        results.push('fair-1');
        return 'ok';
      }),
      queue.enqueueTask('user-mem2', async () => {
        results.push('fair-2');
        return 'ok';
      }),
    ]);

    expect(results).toEqual(expect.arrayContaining(['fair-1', 'fair-2']));

    const serialResult = await serialQueue.enqueue('user-mem', async () => 'serial-ok');
    expect(serialResult).toBe('serial-ok');
  });
});

describe('distributed queues (Redis)', () => {
  let redisAvailable = false;

  beforeAll(async () => {
    const client = createClient({ url: REDIS_URL });
    try {
      await client.connect();
      await client.set('queue:test:ping', 'pong', { EX: 10 });
      const val = await client.get('queue:test:ping');
      await client.del('queue:test:ping');
      await client.disconnect();
      redisAvailable = val === 'pong';
    } catch {
      redisAvailable = false;
    }

    if (!redisAvailable) {
      console.warn(`[SKIP] Redis unavailable at ${REDIS_URL}; skipping distributed queue tests`);
    }
  });

  afterEach(async () => {
    if (!redisAvailable) return;
    const cache = new CacheService();
    await sleep(500);
    const redisClient = cache.getRedisClient();
    if (redisClient?.isOpen) {
      await cleanRedisKeys(redisClient);
    }
  });

  it('connects to Redis', async ({ skip }) => {
    if (!redisAvailable) skip();

    const client = createClient({ url: REDIS_URL });
    await client.connect();
    expect(client.isOpen).toBe(true);

    await client.set('queue:test:ping', 'pong', { EX: 10 });
    expect(await client.get('queue:test:ping')).toBe('pong');

    await client.del('queue:test:ping');
    await client.disconnect();
  });

  it('enforces FairConcurrencyQueue Redis-backed global concurrency limit', async ({ skip }) => {
    if (!redisAvailable) skip();

    const cache = new CacheService();
    await sleep(1500);

    const redisClient = cache.getRedisClient();
    if (redisClient?.isOpen) {
      await cleanRedisKeys(redisClient);
    }

    const queue = new FairConcurrencyQueue(2, 100, 30000, cache);
    let peakConcurrency = 0;
    let currentConcurrency = 0;
    const executionOrder: string[] = [];

    const createTask = (userId: string, taskId: string, durationMs: number) =>
      queue.enqueueTask(userId, async () => {
        currentConcurrency++;
        peakConcurrency = Math.max(peakConcurrency, currentConcurrency);
        executionOrder.push(taskId);
        await sleep(durationMs);
        currentConcurrency--;
        return taskId;
      });

    const results = await Promise.all([
      createTask('user-a', 'A1', 300),
      createTask('user-b', 'B1', 300),
      createTask('user-c', 'C1', 300),
      createTask('user-d', 'D1', 300),
    ]);

    expect(results).toHaveLength(4);
    expect(peakConcurrency).toBeLessThanOrEqual(2);
    expect(executionOrder).toHaveLength(4);

    if (redisClient?.isOpen) {
      const val = await redisClient.get('queue:fair:concurrency');
      const remaining = val ? parseInt(val, 10) : 0;
      expect(remaining).toBe(0);
    }
  });

  it('schedules FairConcurrencyQueue fairly across users', async ({ skip }) => {
    if (!redisAvailable) skip();

    const cache = new CacheService();
    await sleep(1500);

    const redisClient = cache.getRedisClient();
    if (redisClient?.isOpen) {
      await cleanRedisKeys(redisClient);
    }

    const queue = new FairConcurrencyQueue(1, 100, 30000, cache);
    const executionOrder: string[] = [];

    const createTask = (userId: string, taskId: string) =>
      queue.enqueueTask(userId, async () => {
        executionOrder.push(taskId);
        await sleep(100);
        return taskId;
      });

    await Promise.all([
      createTask('user-a', 'A1'),
      createTask('user-a', 'A2'),
      createTask('user-a', 'A3'),
      createTask('user-b', 'B1'),
    ]);

    expect(executionOrder[0]).toBe('A1');
    expect(executionOrder.indexOf('B1')).toBeLessThan(executionOrder.indexOf('A3'));
  });

  it('runs UserSerialQueue tasks serially with a Redis lock', async ({ skip }) => {
    if (!redisAvailable) skip();

    const cache = new CacheService();
    await sleep(1500);

    const redisClient = cache.getRedisClient();
    if (redisClient?.isOpen) {
      await cleanRedisKeys(redisClient);
    }

    const queue = new UserSerialQueue('test-serial', cache);
    const executionLog: { task: string; start: number; end: number }[] = [];
    const baseTime = Date.now();

    const createTask = (taskId: string, durationMs: number) =>
      queue.enqueue('user-x', async () => {
        const start = Date.now() - baseTime;
        await sleep(durationMs);
        const end = Date.now() - baseTime;
        executionLog.push({ task: taskId, start, end });
        return taskId;
      });

    await Promise.all([createTask('T1', 200), createTask('T2', 200), createTask('T3', 200)]);

    expect(executionLog).toHaveLength(3);
    for (let i = 1; i < executionLog.length; i++) {
      expect(executionLog[i].start).toBeGreaterThanOrEqual(executionLog[i - 1].end);
    }

    if (redisClient?.isOpen) {
      const lockVal = await redisClient.get('queue:serial:lock:test-serial:user-x');
      expect(lockVal).toBeNull();
    }
  });

  it('runs UserSerialQueue tasks for different users in parallel', async ({ skip }) => {
    if (!redisAvailable) skip();

    const cache = new CacheService();
    await sleep(1500);

    const redisClient = cache.getRedisClient();
    if (redisClient?.isOpen) {
      await cleanRedisKeys(redisClient);
    }

    const queue = new UserSerialQueue('test-parallel', cache);
    const startTimes: Record<string, number> = {};
    const baseTime = Date.now();

    const createTask = (userId: string, taskId: string) =>
      queue.enqueue(userId, async () => {
        startTimes[taskId] = Date.now() - baseTime;
        await sleep(300);
        return taskId;
      });

    await Promise.all([createTask('user-alpha', 'Alpha'), createTask('user-beta', 'Beta')]);

    const timeDiff = Math.abs((startTimes.Alpha || 0) - (startTimes.Beta || 0));
    expect(timeDiff).toBeLessThan(150);
  });

  it('creates and cleans FairConcurrencyQueue active-user Redis keys', async ({ skip }) => {
    if (!redisAvailable) skip();

    const cache = new CacheService();
    await sleep(1500);

    const redisClient = cache.getRedisClient();
    if (!redisClient?.isOpen) {
      skip();
      return;
    }

    await cleanRedisKeys(redisClient);

    const queue = new FairConcurrencyQueue(1, 100, 30000, cache);
    let midTaskKeys: string[] = [];

    await queue.enqueueTask('user-lifecycle', async () => {
      midTaskKeys = await redisClient.keys('queue:fair:active:*');
      await sleep(100);
      return 'done';
    });

    expect(midTaskKeys.length).toBeGreaterThan(0);

    await sleep(100);
    const postTaskKeys = await redisClient.keys('queue:fair:active:*');
    expect(postTaskKeys).toHaveLength(0);
  });
});
