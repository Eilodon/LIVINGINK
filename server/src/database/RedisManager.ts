/**
 * PHASE 2: Redis Cache Manager
 * High-performance caching layer for session data and game state
 */

import { createClient, RedisClientType } from 'redis';
import { getDatabaseConfig } from './config';
import { logger } from '../logging/Logger';

export interface CacheManager {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  expire(key: string, ttl: number): Promise<void>;
  increment(key: string, amount?: number): Promise<number>;
  healthCheck(): Promise<{ connected: boolean; latency?: number }>;
  close(): Promise<void>;
}

export class RedisManager implements CacheManager {
  private client: RedisClientType;
  private static instance: RedisManager;
  private keyPrefix: string;

  private constructor() {
    const config = getDatabaseConfig().redis;
    this.keyPrefix = config.keyPrefix;

    this.client = createClient({
      socket: {
        host: config.host,
        port: config.port,
        connectTimeout: 10000,
      },
      password: config.password,
      database: config.db,
      // EIDOLON-V PHASE2: Retry configuration
      // retry_delay_on_failover: config.retryDelayOnFailover,
      // max_retries_per_request: config.maxRetriesPerRequest,
      // EIDOLON-V PHASE2: Connection timeout
      // lazyConnect: true,
    });

    // EIDOLON-V PHASE2: Event listeners
    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.client.on('error', (err: Error) => {
      logger.error('Redis client error', {
        error: err.message,
        stack: err.stack
      });
    });

    this.client.on('reconnecting', () => {
      logger.warn('Redis client reconnecting');
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
    });
  }

  static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  // EIDOLON-V PHASE2: Connect to Redis
  async connect(): Promise<void> {
    try {
      await this.client.connect();
      logger.info('Redis connection established');
    } catch (error) {
      logger.error('Failed to connect to Redis', {
        host: getDatabaseConfig().redis.host,
        port: getDatabaseConfig().redis.port
      }, error instanceof Error ? error : undefined);
      throw error;
    }
  }

  // EIDOLON-V PHASE2: Get value from cache
  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.keyPrefix + key;
      const value = await this.client.get(fullKey);

      if (value === null) {
        return null;
      }

      // EIDOLON-V PHASE2: Parse JSON if needed
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error) {
      logger.error('Redis get failed', { key }, error instanceof Error ? error : undefined);
      return null;
    }
  }

  // EIDOLON-V PHASE2: Set value in cache
  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const fullKey = this.keyPrefix + key;
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);

      if (ttl) {
        await this.client.setEx(fullKey, ttl, serializedValue);
      } else {
        await this.client.set(fullKey, serializedValue);
      }

      logger.debug('Redis set completed', { key, ttl });
    } catch (error) {
      logger.error('Redis set failed', { key, ttl }, error instanceof Error ? error : undefined);
      throw error;
    }
  }

  // EIDOLON-V PHASE2: Delete key from cache
  async del(key: string): Promise<void> {
    try {
      const fullKey = this.keyPrefix + key;
      await this.client.del(fullKey);

      logger.debug('Redis delete completed', { key });
    } catch (error) {
      logger.error('Redis delete failed', { key }, error instanceof Error ? error : undefined);
      throw error;
    }
  }

  // EIDOLON-V PHASE2: Check if key exists
  async exists(key: string): Promise<boolean> {
    try {
      const fullKey = this.keyPrefix + key;
      const result = await this.client.exists(fullKey);
      return result === 1;
    } catch (error) {
      logger.error('Redis exists failed', { key }, error instanceof Error ? error : undefined);
      return false;
    }
  }

  // EIDOLON-V PHASE2: Set expiration on key
  async expire(key: string, ttl: number): Promise<void> {
    try {
      const fullKey = this.keyPrefix + key;
      await this.client.expire(fullKey, ttl);

      logger.debug('Redis expire completed', { key, ttl });
    } catch (error) {
      logger.error('Redis expire failed', { key, ttl }, error instanceof Error ? error : undefined);
      throw error;
    }
  }

  // EIDOLON-V PHASE2: Increment counter
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      const fullKey = this.keyPrefix + key;
      const result = await this.client.incrBy(fullKey, amount);

      logger.debug('Redis increment completed', { key, amount, result });
      return result;
    } catch (error) {
      logger.error('Redis increment failed', { key, amount }, error instanceof Error ? error : undefined);
      throw error;
    }
  }

  // EIDOLON-V PHASE2: Health check
  async healthCheck(): Promise<{ connected: boolean; latency?: number }> {
    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;

      return {
        connected: true,
        latency
      };
    } catch (error) {
      return {
        connected: false
      };
    }
  }

  // EIDOLON-V PHASE2: Close connection
  async close(): Promise<void> {
    try {
      await this.client.quit();
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Failed to close Redis connection', undefined, error instanceof Error ? error : undefined);
    }
  }

  // EIDOLON-V PHASE2: Get Redis info
  async getInfo(): Promise<any> {
    try {
      const info = await this.client.info();
      return info;
    } catch (error) {
      logger.error('Failed to get Redis info', undefined, error instanceof Error ? error : undefined);
      return null;
    }
  }
}

// EIDOLON-V PHASE2: Export singleton instance
export const cache = RedisManager.getInstance();
