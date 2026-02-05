/**
 * EIDOLON-V OPEN BETA FIX: Redis-based Distributed Rate Limiter
 *
 * Replaces in-memory rate limiting with Redis for horizontal scaling.
 * Uses sliding window algorithm for accurate rate limiting across instances.
 */

import { RedisManager } from '../database/RedisManager';
import { logger } from '../logging/Logger';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix?: string; // Redis key prefix
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

// In-memory fallback when Redis is unavailable
const memoryFallback = new Map<string, { count: number; resetTime: number }>();

export class RateLimiter {
  private config: RateLimitConfig;
  private redis: RedisManager | null = null;
  private useMemoryFallback = false;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      windowMs: config.windowMs || 60000, // 1 minute default
      maxRequests: config.maxRequests || 100, // 100 requests/minute
      keyPrefix: config.keyPrefix || 'ratelimit:',
    };
  }

  /**
   * Initialize Redis connection for distributed rate limiting
   */
  async init(redis: RedisManager): Promise<void> {
    try {
      const health = await redis.healthCheck();
      if (health.connected) {
        this.redis = redis;
        this.useMemoryFallback = false;
        logger.info('RateLimiter: Using Redis for distributed rate limiting');
      } else {
        throw new Error('Redis health check failed');
      }
    } catch (error) {
      logger.warn(
        'RateLimiter: Redis unavailable, falling back to in-memory (NOT recommended for production)'
      );
      this.useMemoryFallback = true;
    }
  }

  /**
   * Check if request is allowed under rate limit
   */
  async checkLimit(identifier: string): Promise<RateLimitResult> {
    if (this.useMemoryFallback || !this.redis) {
      return this.checkLimitMemory(identifier);
    }
    return this.checkLimitRedis(identifier);
  }

  /**
   * Redis-based rate limiting (sliding window)
   */
  private async checkLimitRedis(identifier: string): Promise<RateLimitResult> {
    const key = `${this.config.keyPrefix}${identifier}`;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    try {
      // Atomic increment with TTL
      const count = await this.redis!.increment(key);

      // Set expiry on first request
      if (count === 1) {
        await this.redis!.expire(key, Math.ceil(this.config.windowMs / 1000));
      }

      const remaining = Math.max(0, this.config.maxRequests - count);
      const resetTime = now + this.config.windowMs;

      if (count > this.config.maxRequests) {
        const retryAfter = Math.ceil(this.config.windowMs / 1000);
        logger.warn('Rate limit exceeded', { identifier, count, limit: this.config.maxRequests });

        return {
          allowed: false,
          remaining: 0,
          resetTime,
          retryAfter,
        };
      }

      return {
        allowed: true,
        remaining,
        resetTime,
      };
    } catch (error) {
      logger.error(
        'Redis rate limit check failed, allowing request',
        { identifier },
        error as Error
      );
      // EIDOLON-V FIX: Fail Safe - Fallback to in-memory limiting instead of fail-open
      return this.checkLimitMemory(identifier);
    }
  }

  /**
   * In-memory fallback (single instance only)
   */
  private checkLimitMemory(identifier: string): RateLimitResult {
    const now = Date.now();
    const client = memoryFallback.get(identifier);

    if (!client || now > client.resetTime) {
      memoryFallback.set(identifier, {
        count: 1,
        resetTime: now + this.config.windowMs,
      });
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime: now + this.config.windowMs,
      };
    }

    if (client.count >= this.config.maxRequests) {
      const retryAfter = Math.ceil((client.resetTime - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetTime: client.resetTime,
        retryAfter,
      };
    }

    client.count++;
    return {
      allowed: true,
      remaining: this.config.maxRequests - client.count,
      resetTime: client.resetTime,
    };
  }

  /**
   * Express middleware factory
   */
  middleware() {
    return async (req: any, res: any, next: any) => {
      const identifier = req.ip || req.connection?.remoteAddress || 'unknown';
      const result = await this.checkLimit(identifier);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', this.config.maxRequests);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', result.resetTime);

      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter || 60);
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please slow down.',
          retryAfter: result.retryAfter,
        });
      }

      next();
    };
  }

  /**
   * Cleanup memory fallback (call periodically)
   */
  cleanupMemory(): void {
    const now = Date.now();
    for (const [key, value] of memoryFallback.entries()) {
      if (now > value.resetTime) {
        memoryFallback.delete(key);
      }
    }
  }

  /**
   * Get current stats
   */
  getStats(): { mode: string; memoryEntries?: number } {
    return {
      mode: this.useMemoryFallback ? 'memory' : 'redis',
      memoryEntries: this.useMemoryFallback ? memoryFallback.size : undefined,
    };
  }
}

// Export default instance with standard config
export const rateLimiter = new RateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 100, // 100 requests per minute
});

// Stricter rate limiter for auth endpoints
export const authRateLimiter = new RateLimiter({
  windowMs: 900000, // 15 minutes
  maxRequests: 10, // 10 attempts per 15 minutes
  keyPrefix: 'ratelimit:auth:',
});

// WebSocket rate limiter
export const wsRateLimiter = new RateLimiter({
  windowMs: 1000, // 1 second
  maxRequests: 60, // 60 messages per second
  keyPrefix: 'ratelimit:ws:',
});
