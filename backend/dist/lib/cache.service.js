"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheService = exports.CacheService = void 0;
const redis_1 = require("redis");
const env_1 = require("../config/env");
const logger_1 = require("../config/logger");
class CacheService {
    redisClient;
    isRedisConnected = false;
    memoryMap = new Map();
    useRedis;
    constructor() {
        this.useRedis = env_1.env.RATE_LIMIT_STORE === 'redis';
        if (this.useRedis) {
            this.initRedis();
        }
        else {
            logger_1.logger.info('[CACHE SERVICE] Running in in-memory mode (RATE_LIMIT_STORE=memory)');
        }
    }
    initRedis() {
        try {
            this.redisClient = (0, redis_1.createClient)({
                url: env_1.env.REDIS_URL,
                socket: {
                    connectTimeout: 10000,
                    reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
                },
            });
            let wasConnected = false;
            this.redisClient.on('error', (err) => {
                if (wasConnected) {
                    logger_1.logger.error({ err: err.message || err }, '[CACHE SERVICE] Redis client error. Falling back to in-memory mode.');
                }
                this.isRedisConnected = false;
            });
            this.redisClient.on('reconnecting', () => {
                logger_1.logger.warn('[CACHE SERVICE] Lost connection to Redis. Attempting to reconnect...');
                this.isRedisConnected = false;
            });
            this.redisClient.on('ready', () => {
                this.isRedisConnected = true;
                if (!wasConnected) {
                    logger_1.logger.info(`[CACHE SERVICE] Connected to Redis server at ${env_1.env.REDIS_URL}`);
                    wasConnected = true;
                }
                else {
                    logger_1.logger.info('[CACHE SERVICE] Reconnected to Redis server.');
                }
            });
            this.redisClient.connect().catch((err) => {
                logger_1.logger.error({ err: err.message || err }, '[CACHE SERVICE] Initial Redis connect failed. Falling back to in-memory mode.');
                this.isRedisConnected = false;
            });
        }
        catch (error) {
            logger_1.logger.error({ err: error.message || error }, '[CACHE SERVICE] Failed to initialize Redis client');
            this.isRedisConnected = false;
        }
    }
    getRedisClient() {
        return this.redisClient;
    }
    async get(key) {
        if (this.useRedis && this.isRedisConnected && this.redisClient) {
            try {
                const data = await this.redisClient.get(key);
                if (!data)
                    return null;
                return JSON.parse(data, (k, v) => {
                    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(v)) {
                        return new Date(v);
                    }
                    return v;
                });
            }
            catch (err) {
                logger_1.logger.warn({ err, key }, '[CACHE SERVICE] Redis GET failed. Falling back to memory.');
            }
        }
        const entry = this.memoryMap.get(key);
        if (!entry)
            return null;
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.memoryMap.delete(key);
            return null;
        }
        return entry.value;
    }
    async set(key, value, ttlSeconds) {
        if (this.useRedis && this.isRedisConnected && this.redisClient) {
            try {
                const serialized = JSON.stringify(value);
                if (ttlSeconds && ttlSeconds > 0) {
                    await this.redisClient.set(key, serialized, { EX: ttlSeconds });
                }
                else {
                    await this.redisClient.set(key, serialized);
                }
                return;
            }
            catch (err) {
                logger_1.logger.warn({ err, key }, '[CACHE SERVICE] Redis SET failed. Falling back to memory.');
            }
        }
        const expiresAt = ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
        this.memoryMap.set(key, { value, expiresAt });
    }
    async delete(key) {
        if (this.useRedis && this.isRedisConnected && this.redisClient) {
            try {
                await this.redisClient.del(key);
            }
            catch (err) {
                logger_1.logger.warn({ err, key }, '[CACHE SERVICE] Redis DEL failed.');
            }
        }
        this.memoryMap.delete(key);
    }
    async acquireLock(lockKey, ttlSeconds = 300) {
        if (this.useRedis && this.isRedisConnected && this.redisClient) {
            try {
                const res = await this.redisClient.set(lockKey, 'LOCKED', {
                    NX: true,
                    EX: ttlSeconds,
                });
                return res === 'OK';
            }
            catch (err) {
                logger_1.logger.warn({ err, lockKey }, '[CACHE SERVICE] Redis acquireLock failed. Falling back to memory.');
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
    async releaseLock(lockKey) {
        await this.delete(lockKey);
    }
}
exports.CacheService = CacheService;
exports.cacheService = new CacheService();
