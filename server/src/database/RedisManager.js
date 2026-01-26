"use strict";
/**
 * PHASE 2: Redis Cache Manager
 * High-performance caching layer for session data and game state
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cache = exports.RedisManager = void 0;
const redis_1 = require("redis");
const config_1 = require("./config");
const Logger_1 = require("../logging/Logger");
class RedisManager {
    constructor() {
        const config = (0, config_1.getDatabaseConfig)().redis;
        this.keyPrefix = config.keyPrefix;
        this.client = (0, redis_1.createClient)({
            socket: {
                host: config.host,
                port: config.port,
            },
            password: config.password,
            database: config.db,
            // EIDOLON-V PHASE2: Retry configuration
            retry_delay_on_failover: config.retryDelayOnFailover,
            max_retries_per_request: config.maxRetriesPerRequest,
            // EIDOLON-V PHASE2: Connection timeout
            connectTimeout: 10000,
            lazyConnect: true,
        });
        // EIDOLON-V PHASE2: Event listeners
        this.client.on('connect', () => {
            Logger_1.logger.info('Redis client connected');
        });
        this.client.on('error', (err) => {
            Logger_1.logger.error('Redis client error', {
                error: err.message,
                stack: err.stack
            });
        });
        this.client.on('reconnecting', () => {
            Logger_1.logger.warn('Redis client reconnecting');
        });
        this.client.on('ready', () => {
            Logger_1.logger.info('Redis client ready');
        });
    }
    static getInstance() {
        if (!RedisManager.instance) {
            RedisManager.instance = new RedisManager();
        }
        return RedisManager.instance;
    }
    // EIDOLON-V PHASE2: Connect to Redis
    async connect() {
        try {
            await this.client.connect();
            Logger_1.logger.info('Redis connection established');
        }
        catch (error) {
            Logger_1.logger.error('Failed to connect to Redis', {
                host: (0, config_1.getDatabaseConfig)().redis.host,
                port: (0, config_1.getDatabaseConfig)().redis.port
            }, error instanceof Error ? error : undefined);
            throw error;
        }
    }
    // EIDOLON-V PHASE2: Get value from cache
    async get(key) {
        try {
            const fullKey = this.keyPrefix + key;
            const value = await this.client.get(fullKey);
            if (value === null) {
                return null;
            }
            // EIDOLON-V PHASE2: Parse JSON if needed
            try {
                return JSON.parse(value);
            }
            catch {
                return value;
            }
        }
        catch (error) {
            Logger_1.logger.error('Redis get failed', { key }, error instanceof Error ? error : undefined);
            return null;
        }
    }
    // EIDOLON-V PHASE2: Set value in cache
    async set(key, value, ttl) {
        try {
            const fullKey = this.keyPrefix + key;
            const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
            if (ttl) {
                await this.client.setEx(fullKey, ttl, serializedValue);
            }
            else {
                await this.client.set(fullKey, serializedValue);
            }
            Logger_1.logger.debug('Redis set completed', { key, ttl });
        }
        catch (error) {
            Logger_1.logger.error('Redis set failed', { key, ttl }, error instanceof Error ? error : undefined);
            throw error;
        }
    }
    // EIDOLON-V PHASE2: Delete key from cache
    async del(key) {
        try {
            const fullKey = this.keyPrefix + key;
            await this.client.del(fullKey);
            Logger_1.logger.debug('Redis delete completed', { key });
        }
        catch (error) {
            Logger_1.logger.error('Redis delete failed', { key }, error instanceof Error ? error : undefined);
            throw error;
        }
    }
    // EIDOLON-V PHASE2: Check if key exists
    async exists(key) {
        try {
            const fullKey = this.keyPrefix + key;
            const result = await this.client.exists(fullKey);
            return result === 1;
        }
        catch (error) {
            Logger_1.logger.error('Redis exists failed', { key }, error instanceof Error ? error : undefined);
            return false;
        }
    }
    // EIDOLON-V PHASE2: Set expiration on key
    async expire(key, ttl) {
        try {
            const fullKey = this.keyPrefix + key;
            await this.client.expire(fullKey, ttl);
            Logger_1.logger.debug('Redis expire completed', { key, ttl });
        }
        catch (error) {
            Logger_1.logger.error('Redis expire failed', { key, ttl }, error instanceof Error ? error : undefined);
            throw error;
        }
    }
    // EIDOLON-V PHASE2: Increment counter
    async increment(key, amount = 1) {
        try {
            const fullKey = this.keyPrefix + key;
            const result = await this.client.incrBy(fullKey, amount);
            Logger_1.logger.debug('Redis increment completed', { key, amount, result });
            return result;
        }
        catch (error) {
            Logger_1.logger.error('Redis increment failed', { key, amount }, error instanceof Error ? error : undefined);
            throw error;
        }
    }
    // EIDOLON-V PHASE2: Health check
    async healthCheck() {
        try {
            const start = Date.now();
            await this.client.ping();
            const latency = Date.now() - start;
            return {
                connected: true,
                latency
            };
        }
        catch (error) {
            return {
                connected: false
            };
        }
    }
    // EIDOLON-V PHASE2: Close connection
    async close() {
        try {
            await this.client.quit();
            Logger_1.logger.info('Redis connection closed');
        }
        catch (error) {
            Logger_1.logger.error('Failed to close Redis connection', undefined, error instanceof Error ? error : undefined);
        }
    }
    // EIDOLON-V PHASE2: Get Redis info
    async getInfo() {
        try {
            const info = await this.client.info();
            return info;
        }
        catch (error) {
            Logger_1.logger.error('Failed to get Redis info', undefined, error instanceof Error ? error : undefined);
            return null;
        }
    }
}
exports.RedisManager = RedisManager;
// EIDOLON-V PHASE2: Export singleton instance
exports.cache = RedisManager.getInstance();
