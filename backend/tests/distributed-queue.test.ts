

import dotenv from 'dotenv';
dotenv.config();

import { createClient } from 'redis';
import { CacheService } from '../src/lib/cache.service';
import { FairConcurrencyQueue, UserSerialQueue } from '../src/utils/user-queue';


const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
let passed = 0;
let failed = 0;

function log(tag: string, msg: string) {
  console.log(`  [${tag}] ${msg}`);
}

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    log('PASS', label);
  } else {
    failed++;
    log('FAIL', label);
  }
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function cleanRedisKeys(client: ReturnType<typeof createClient>) {
  const keys = await client.keys('queue:*');
  if (keys.length > 0) {
    await client.del(keys);
  }
}


async function testRedisConnectivity() {
  console.log('\n[TEST] Test 1: Redis Connectivity');

  const client = createClient({ url: REDIS_URL });
  try {
    await client.connect();
    assert(client.isOpen, 'Redis client connected successfully');

    await client.set('queue:test:ping', 'pong', { EX: 10 });
    const val = await client.get('queue:test:ping');
    assert(val === 'pong', 'Redis SET/GET works');

    await client.del('queue:test:ping');
    await client.disconnect();
    assert(true, 'Redis disconnected cleanly');
  } catch (err: any) {
    assert(false, `Redis connection failed: ${err.message}`);
    console.error('\n[FATAL] Cannot proceed without Redis. Make sure Redis is running on', REDIS_URL);
    process.exit(1);
  }
}


async function testFairConcurrencyRedisLimit() {
  console.log('\n[TEST] Test 2: FairConcurrencyQueue — Redis-backed global concurrency limit');

  const cache = new CacheService();
  await sleep(1500);

  const redisClient = cache.getRedisClient();
  if (redisClient && redisClient.isOpen) {
    await cleanRedisKeys(redisClient);
  }

  const queue = new FairConcurrencyQueue(2, 100, 30000, cache);

  let peakConcurrency = 0;
  let currentConcurrency = 0;
  const executionOrder: string[] = [];

  const createTask = (userId: string, taskId: string, durationMs: number) => {
    return queue.enqueueTask(userId, async () => {
      currentConcurrency++;
      peakConcurrency = Math.max(peakConcurrency, currentConcurrency);
      executionOrder.push(taskId);
      await sleep(durationMs);
      currentConcurrency--;
      return taskId;
    });
  };

  const results = await Promise.all([
    createTask('user-a', 'A1', 300),
    createTask('user-b', 'B1', 300),
    createTask('user-c', 'C1', 300),
    createTask('user-d', 'D1', 300),
  ]);

  assert(results.length === 4, `All 4 tasks completed (got ${results.length})`);
  assert(peakConcurrency <= 2, `Peak concurrency was ${peakConcurrency} (max allowed: 2)`);
  assert(executionOrder.length === 4, `Execution order tracked all 4 tasks`);

  if (redisClient && redisClient.isOpen) {
    const val = await redisClient.get('queue:fair:concurrency');
    const remaining = val ? parseInt(val, 10) : 0;
    assert(remaining === 0, `Redis concurrency counter is 0 after completion (got ${remaining})`);
    await cleanRedisKeys(redisClient);
  }

  log('[INFO]', `Execution order: ${executionOrder.join(' → ')}`);
}


async function testFairConcurrencyFairness() {
  console.log('\n[TEST] Test 3: FairConcurrencyQueue — per-user fair scheduling');

  const cache = new CacheService();
  await sleep(1500);

  const redisClient = cache.getRedisClient();
  if (redisClient && redisClient.isOpen) {
    await cleanRedisKeys(redisClient);
  }

  const queue = new FairConcurrencyQueue(1, 100, 30000, cache);
  const executionOrder: string[] = [];

  const createTask = (userId: string, taskId: string) => {
    return queue.enqueueTask(userId, async () => {
      executionOrder.push(taskId);
      await sleep(100);
      return taskId;
    });
  };

  await Promise.all([
    createTask('user-a', 'A1'),
    createTask('user-a', 'A2'),
    createTask('user-a', 'A3'),
    createTask('user-b', 'B1'),
  ]);

  assert(executionOrder[0] === 'A1', `First task was A1 (got ${executionOrder[0]})`);
  const bIndex = executionOrder.indexOf('B1');
  const a3Index = executionOrder.indexOf('A3');
  assert(bIndex < a3Index, `B1 (index ${bIndex}) ran before A3 (index ${a3Index}) — fair scheduling works`);

  if (redisClient && redisClient.isOpen) {
    await cleanRedisKeys(redisClient);
  }

  log('[INFO]', `Execution order: ${executionOrder.join(' → ')}`);
}


async function testSerialQueueDistributedLock() {
  console.log('\n[TEST] Test 4: UserSerialQueue — Redis-backed serial execution');

  const cache = new CacheService();
  await sleep(1500);

  const redisClient = cache.getRedisClient();
  if (redisClient && redisClient.isOpen) {
    await cleanRedisKeys(redisClient);
  }

  const queue = new UserSerialQueue('test-serial', cache);
  const executionLog: { task: string; start: number; end: number }[] = [];
  const baseTime = Date.now();

  const createTask = (taskId: string, durationMs: number) => {
    return queue.enqueue('user-x', async () => {
      const start = Date.now() - baseTime;
      await sleep(durationMs);
      const end = Date.now() - baseTime;
      executionLog.push({ task: taskId, start, end });
      return taskId;
    });
  };

  await Promise.all([
    createTask('T1', 200),
    createTask('T2', 200),
    createTask('T3', 200),
  ]);

  assert(executionLog.length === 3, `All 3 tasks completed`);

  let serialValid = true;
  for (let i = 1; i < executionLog.length; i++) {
    if (executionLog[i].start < executionLog[i - 1].end) {
      serialValid = false;
      break;
    }
  }
  assert(serialValid, 'Tasks ran serially (no time overlap)');

  if (redisClient && redisClient.isOpen) {
    const lockVal = await redisClient.get('queue:serial:lock:test-serial:user-x');
    assert(lockVal === null, 'Redis serial lock released after completion');
    await cleanRedisKeys(redisClient);
  }

  log('[INFO]', `Timeline: ${executionLog.map(e => `${e.task}(${e.start}-${e.end}ms)`).join(', ')}`);
}


async function testSerialQueueParallelUsers() {
  console.log('\n[TEST] Test 5: UserSerialQueue — different users run in parallel');

  const cache = new CacheService();
  await sleep(1500);

  const redisClient = cache.getRedisClient();
  if (redisClient && redisClient.isOpen) {
    await cleanRedisKeys(redisClient);
  }

  const queue = new UserSerialQueue('test-parallel', cache);
  const startTimes: Record<string, number> = {};
  const baseTime = Date.now();

  const createTask = (userId: string, taskId: string) => {
    return queue.enqueue(userId, async () => {
      startTimes[taskId] = Date.now() - baseTime;
      await sleep(300);
      return taskId;
    });
  };

  await Promise.all([
    createTask('user-alpha', 'Alpha'),
    createTask('user-beta', 'Beta'),
  ]);

  const timeDiff = Math.abs((startTimes['Alpha'] || 0) - (startTimes['Beta'] || 0));
  assert(timeDiff < 150, `Different users started within ${timeDiff}ms of each other (parallel)`);

  if (redisClient && redisClient.isOpen) {
    await cleanRedisKeys(redisClient);
  }
}


async function testActiveUserRedisKeys() {
  console.log('\n[TEST] Test 6: FairConcurrencyQueue — active user Redis keys lifecycle');

  const cache = new CacheService();
  await sleep(1500);

  const redisClient = cache.getRedisClient();
  if (!redisClient || !redisClient.isOpen) {
    log('[SKIP]', 'Skipped — Redis not available');
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

  assert(midTaskKeys.length > 0, `Active user key existed during task execution (found ${midTaskKeys.length} keys)`);

  await sleep(100);
  const postTaskKeys = await redisClient.keys('queue:fair:active:*');
  assert(postTaskKeys.length === 0, `Active user key cleaned up after task completion`);

  await cleanRedisKeys(redisClient);
}


async function testMemoryOnlyFallback() {
  console.log('\n[TEST] Test 7: Memory-only fallback (no cacheService)');

  const queue = new FairConcurrencyQueue(2, 100, 30000);
  const serialQueue = new UserSerialQueue('mem-test');

  const results: string[] = [];

  await Promise.all([
    queue.enqueueTask('user-mem', async () => { results.push('fair-1'); return 'ok'; }),
    queue.enqueueTask('user-mem2', async () => { results.push('fair-2'); return 'ok'; }),
  ]);

  assert(results.includes('fair-1') && results.includes('fair-2'), 'FairConcurrencyQueue works without cache');

  const serialResult = await serialQueue.enqueue('user-mem', async () => 'serial-ok');
  assert(serialResult === 'serial-ok', 'UserSerialQueue works without cache');
}


async function main() {
  console.log('\n==============================================================');
  console.log('  Distributed Queue Integration Tests');
  console.log('==============================================================');
  console.log(`  Redis URL: ${REDIS_URL}`);
  console.log(`  RATE_LIMIT_STORE: ${process.env.RATE_LIMIT_STORE || 'memory'}`);

  const startTime = Date.now();

  await testRedisConnectivity();
  await testFairConcurrencyRedisLimit();
  await testFairConcurrencyFairness();
  await testSerialQueueDistributedLock();
  await testSerialQueueParallelUsers();
  await testActiveUserRedisKeys();
  await testMemoryOnlyFallback();

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n--------------------------------------------------------------');
  console.log(`  [SUMMARY] ${passed} passed, ${failed} failed (${duration}s)`);
  console.log('--------------------------------------------------------------\n');

  await sleep(500);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
