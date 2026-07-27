"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.regenerateLimiter = exports.refreshRateLimiter = exports.authLimiter = exports.apiLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const rate_limit_redis_1 = require("rate-limit-redis");
const env_1 = require("../config/env");
const cache_service_1 = require("../lib/cache.service");
const isRedisStore = env_1.env.RATE_LIMIT_STORE === 'redis';
if (isRedisStore) {
    console.log("Rate Limiter: Redis Engine Configured via Unified CacheService");
}
else {
    console.log("Rate Limiter: Local Memory Engine Active (Default)");
}
const getStore = (prefix) => {
    const redisClient = cache_service_1.cacheService.getRedisClient();
    if (env_1.env.RATE_LIMIT_STORE === 'redis' && redisClient) {
        return new rate_limit_redis_1.RedisStore({
            prefix: `rate-limit:${prefix}:`,
            sendCommand: (...args) => {
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
const getClientIp = (req) => {
    if (!req.ip)
        return 'unknown';
    return req.ip.replace(/^::ffff:/, '');
};
exports.apiLimiter = (0, express_rate_limit_1.default)({
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
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: 'Too many login attempts from this IP, please try again after 15 minutes',
    passOnStoreError: true,
    keyGenerator: getClientIp,
    ...(isRedisStore && { store: getStore('auth') }),
});
exports.refreshRateLimiter = (0, express_rate_limit_1.default)({
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
exports.regenerateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 5 * 60 * 1000,
    limit: 2,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: 'Rate limit exceeded for regeneration. Please wait 5 minutes.',
    passOnStoreError: true,
    keyGenerator: getClientIp,
    ...(isRedisStore && { store: getStore('regenerate') }),
});
