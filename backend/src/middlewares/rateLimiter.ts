import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { env } from '../config/env';
import { cacheService } from '../lib/cache.service';

const isRedisStore = env.RATE_LIMIT_STORE === 'redis';

if (isRedisStore) {
  console.log("Rate Limiter: Redis Engine Configured via Unified CacheService");
} else {
  console.log("Rate Limiter: Local Memory Engine Active (Default)");
}

const getStore = (prefix: string) => {
  const redisClient = cacheService.getRedisClient();
  if (env.RATE_LIMIT_STORE === 'redis' && redisClient) {
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
