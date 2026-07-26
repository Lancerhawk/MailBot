import rateLimit from 'express-rate-limit';
import { createClient } from 'redis';
import { RedisStore } from 'rate-limit-redis';
import dotenv from 'dotenv';

dotenv.config();

const isRedisStore = process.env.RATE_LIMIT_STORE === 'redis';

let redisClient: ReturnType<typeof createClient> | undefined;

if (isRedisStore) {
  if (!process.env.REDIS_URL) {
    throw new Error("RATE_LIMIT_STORE is set to 'redis', but REDIS_URL is missing in .env");
  }

  redisClient = createClient({
    url: process.env.REDIS_URL,
    socket: {
      connectTimeout: 10000,
      reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
    },
  });

  let wasConnected = false;

  redisClient.on('error', (err) => {
    if (wasConnected) {
      console.error('[REDIS ERROR] Rate Limiter client error:', err.message || err);
    }
  });

  redisClient.on('reconnecting', () => {
    if (wasConnected) {
      console.warn('[REDIS WARNING] Lost connection to Redis. Attempting to reconnect... (Fail-open mode active: requests passing through without hanging)');
    }
  });

  redisClient.on('ready', () => {
    if (!wasConnected) {
      console.log('[REDIS READY] Rate Limiter successfully connected to Redis server.');
      wasConnected = true;
    } else {
      console.log('[REDIS RESTORED] Rate Limiter successfully reconnected to Redis server.');
    }
  });

  redisClient.connect().catch((err) => {
    console.error("[REDIS INITIAL CONNECT FAILED] Could not connect to Redis for rate limiting:", err.message || err);
  });

  console.log("Rate Limiter: Redis Engine Configured");
} else {
  console.log("Rate Limiter: Local Memory Engine Active (Default)");
}

const getStore = (prefix: string) => {
  if (isRedisStore && redisClient) {
    return new RedisStore({
      prefix: `rate-limit:${prefix}:`,
      sendCommand: (...args: string[]) => {
        if (redisClient && redisClient.isOpen) {
          return redisClient.sendCommand(args);
        }
        console.warn(`[RATE LIMITER FALLBACK] Redis is disconnected! Passing request through for limiter '${prefix}' without Redis check.`);
        return Promise.reject(new Error("Redis client is not connected"));
      },
    });
  }
  return undefined;
};

const getClientIp = (req: any): string => {
  if (!req.ip) return 'unknown';
  return req.ip.replace(/^::ffff:/, '');
};

export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 1 minute',
  passOnStoreError: true,
  keyGenerator: getClientIp,
  skip: (req) => req.path.includes('/status'),
  ...(isRedisStore && { store: getStore('api') }),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Too many login attempts from this IP, please try again after 15 minutes',
  passOnStoreError: true,
  keyGenerator: getClientIp,
  ...(isRedisStore && { store: getStore('auth') }),
});

export const refreshRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Please wait 1 minute before refreshing again.',
  passOnStoreError: true,
  keyGenerator: getClientIp,
  skip: (req) => req.query.refresh !== 'true',
  ...(isRedisStore && { store: getStore('refresh') }),
});

export const regenerateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 2,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Rate limit exceeded for regeneration. Please wait 5 minutes.',
  passOnStoreError: true,
  keyGenerator: getClientIp,
  ...(isRedisStore && { store: getStore('regenerate') }),
});
