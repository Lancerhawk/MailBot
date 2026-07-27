import { createClient } from 'redis';
import { env } from '../config/env';
import { logger } from '../config/logger';

interface MemoryEntry {
  value: any;
  expiresAt: number | null;
}

export class CacheService {
  private redisClient: ReturnType<typeof createClient> | undefined;
  private isRedisConnected: boolean = false;
  private memoryMap = new Map<string, MemoryEntry>();
  private useRedis: boolean;

  constructor() {
    this.useRedis = env.RATE_LIMIT_STORE === 'redis';
    if (this.useRedis) {
      this.initRedis();
    } else {
      logger.info('[CACHE SERVICE] Running in in-memory mode (RATE_LIMIT_STORE=memory)');
    }
  }

  private initRedis() {
    try {
      this.redisClient = createClient({
        url: env.REDIS_URL,
        socket: {
          connectTimeout: 10000,
          reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
        },
      });

      let wasConnected = false;

      this.redisClient.on('error', (err) => {
        if (wasConnected) {
          logger.error({ err: err.message || err }, '[CACHE SERVICE] Redis client error. Falling back to in-memory mode.');
        }
        this.isRedisConnected = false;
      });

      this.redisClient.on('reconnecting', () => {
        logger.warn('[CACHE SERVICE] Lost connection to Redis. Attempting to reconnect...');
        this.isRedisConnected = false;
      });

      this.redisClient.on('ready', () => {
        this.isRedisConnected = true;
        if (!wasConnected) {
          logger.info(`[CACHE SERVICE] Connected to Redis server at ${env.REDIS_URL}`);
          wasConnected = true;
        } else {
          logger.info('[CACHE SERVICE] Reconnected to Redis server.');
        }
      });

      this.redisClient.connect().catch((err) => {
        logger.error({ err: err.message || err }, '[CACHE SERVICE] Initial Redis connect failed. Falling back to in-memory mode.');
        this.isRedisConnected = false;
      });
    } catch (error: any) {
      logger.error({ err: error.message || error }, '[CACHE SERVICE] Failed to initialize Redis client');
      this.isRedisConnected = false;
    }
  }

  public getRedisClient(): ReturnType<typeof createClient> | undefined {
    return this.redisClient;
  }

  public async get<T>(key: string): Promise<T | null> {
    if (this.useRedis && this.isRedisConnected && this.redisClient) {
      try {
        const data = await this.redisClient.get(key);
        if (!data) return null;
        return JSON.parse(data, (k, v) => {
          if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(v)) {
            return new Date(v);
          }
          return v;
        }) as T;
      } catch (err) {
        logger.warn({ err, key }, '[CACHE SERVICE] Redis GET failed. Falling back to memory.');
      }
    }

    const entry = this.memoryMap.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.memoryMap.delete(key);
      return null;
    }
    return entry.value as T;
  }

  public async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (this.useRedis && this.isRedisConnected && this.redisClient) {
      try {
        const serialized = JSON.stringify(value);
        if (ttlSeconds && ttlSeconds > 0) {
          await this.redisClient.set(key, serialized, { EX: ttlSeconds });
        } else {
          await this.redisClient.set(key, serialized);
        }
        return;
      } catch (err) {
        logger.warn({ err, key }, '[CACHE SERVICE] Redis SET failed. Falling back to memory.');
      }
    }

    const expiresAt = ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    this.memoryMap.set(key, { value, expiresAt });
  }

  public async delete(key: string): Promise<void> {
    if (this.useRedis && this.isRedisConnected && this.redisClient) {
      try {
        await this.redisClient.del(key);
      } catch (err) {
        logger.warn({ err, key }, '[CACHE SERVICE] Redis DEL failed.');
      }
    }
    this.memoryMap.delete(key);
  }

  public async acquireLock(lockKey: string, ttlSeconds: number = 300): Promise<boolean> {
    if (this.useRedis && this.isRedisConnected && this.redisClient) {
      try {
        const res = await this.redisClient.set(lockKey, 'LOCKED', {
          NX: true,
          EX: ttlSeconds,
        });
        return res === 'OK';
      } catch (err) {
        logger.warn({ err, lockKey }, '[CACHE SERVICE] Redis acquireLock failed. Falling back to memory.');
      }
    }

    const entry = this.memoryMap.get(lockKey);
    const now = Date.now();
    if (entry && (!entry.expiresAt || now <= entry.expiresAt)) {
      return false;
    }
    this.memoryMap.set(lockKey, { value: 'LOCKED', expiresAt: now + ttlSeconds * 1000 });
    return true;
  }

  public async releaseLock(lockKey: string): Promise<void> {
    await this.delete(lockKey);
  }
}

export const cacheService = new CacheService();
