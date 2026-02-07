/**
 * EIDOLON-V OPEN BETA FIX: Redis-based Distributed Session Store
 *
 * Replaces in-memory session storage with Redis for:
 * - Horizontal scaling across multiple instances
 * - Session persistence across server restarts
 * - Shared session state in load-balanced environments
 */

import { RedisManager } from '../database/RedisManager';
import { logger } from '../logging/Logger';

export interface Session {
  userId: string;
  username: string;
  createdAt: number;
  lastActivity: number;
  isGuest?: boolean;
  metadata?: Record<string, any>;
}

export interface SessionStoreConfig {
  keyPrefix: string;
  sessionTTL: number; // Session timeout in seconds
}

// In-memory fallback for development/testing
const memoryStore = new Map<string, Session>();

export class SessionStore {
  private redis: RedisManager | null = null;
  private config: SessionStoreConfig;
  private useMemoryFallback = true;

  constructor(config: Partial<SessionStoreConfig> = {}) {
    this.config = {
      keyPrefix: config.keyPrefix || 'session:',
      sessionTTL: config.sessionTTL || 86400, // 24 hours default
    };
  }

  /**
   * Initialize with Redis for distributed sessions
   */
  async init(redis: RedisManager): Promise<void> {
    try {
      const health = await redis.healthCheck();
      if (health.connected) {
        this.redis = redis;
        this.useMemoryFallback = false;
        logger.info('SessionStore: Using Redis for distributed sessions');
      } else {
        throw new Error('Redis health check failed');
      }
    } catch (error) {
      logger.warn('SessionStore: Redis unavailable, using in-memory store (NOT for production)');
      this.useMemoryFallback = true;
    }
  }

  /**
   * Create a new session
   */
  async create(
    token: string,
    session: Omit<Session, 'createdAt' | 'lastActivity'>
  ): Promise<Session> {
    const fullSession: Session = {
      ...session,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    if (this.useMemoryFallback || !this.redis) {
      memoryStore.set(token, fullSession);
    } else {
      const key = this.config.keyPrefix + token;
      await this.redis.set(key, fullSession, this.config.sessionTTL);

      // Maintain user:sessions reverse index for "logout all devices"
      await this.addToUserIndex(session.userId, token);
    }

    logger.debug('Session created', { userId: session.userId, isGuest: session.isGuest });
    return fullSession;
  }

  /**
   * Get session by token
   */
  async get(token: string): Promise<Session | null> {
    if (this.useMemoryFallback || !this.redis) {
      const session = memoryStore.get(token);
      if (!session) return null;

      // Check if expired
      if (Date.now() - session.lastActivity > this.config.sessionTTL * 1000) {
        memoryStore.delete(token);
        return null;
      }
      return session;
    }

    const key = this.config.keyPrefix + token;
    return await this.redis.get<Session>(key);
  }

  /**
   * Update session activity (extends TTL)
   */
  async touch(token: string): Promise<boolean> {
    if (this.useMemoryFallback || !this.redis) {
      const session = memoryStore.get(token);
      if (!session) return false;
      session.lastActivity = Date.now();
      return true;
    }

    const key = this.config.keyPrefix + token;
    const session = await this.redis.get<Session>(key);
    if (!session) return false;

    session.lastActivity = Date.now();
    await this.redis.set(key, session, this.config.sessionTTL);
    return true;
  }

  /**
   * Delete session (logout)
   */
  async delete(token: string): Promise<boolean> {
    if (this.useMemoryFallback || !this.redis) {
      return memoryStore.delete(token);
    }

    const key = this.config.keyPrefix + token;
    const session = await this.redis.get<Session>(key);
    if (session) {
      await this.redis.del(key);
      // Remove from user:sessions reverse index
      await this.removeFromUserIndex(session.userId, token);
      logger.debug('Session deleted', { token: token.substring(0, 8) + '...' });
      return true;
    }
    return false;
  }

  /**
   * Check if session exists and is valid
   */
  async exists(token: string): Promise<boolean> {
    const session = await this.get(token);
    return session !== null;
  }

  /**
   * Get all sessions for a user (useful for "logout all devices")
   */
  async getUserSessions(userId: string): Promise<string[]> {
    if (this.useMemoryFallback) {
      const tokens: string[] = [];
      for (const [token, session] of memoryStore.entries()) {
        if (session.userId === userId) {
          tokens.push(token);
        }
      }
      return tokens;
    }

    if (!this.redis) return [];

    // Read user:sessions index and filter out expired tokens
    const indexKey = `user_sessions:${userId}`;
    const tokens = await this.redis.get<string[]>(indexKey);
    if (!tokens || tokens.length === 0) return [];

    // Validate that tokens still exist (cleanup stale references)
    const validTokens: string[] = [];
    for (const token of tokens) {
      const key = this.config.keyPrefix + token;
      if (await this.redis.exists(key)) {
        validTokens.push(token);
      }
    }

    // Update index if stale tokens were removed
    if (validTokens.length !== tokens.length) {
      if (validTokens.length > 0) {
        await this.redis.set(indexKey, validTokens, this.config.sessionTTL);
      } else {
        await this.redis.del(indexKey);
      }
    }

    return validTokens;
  }

  /**
   * Add token to user:sessions reverse index
   */
  private async addToUserIndex(userId: string, token: string): Promise<void> {
    if (!this.redis) return;
    const indexKey = `user_sessions:${userId}`;
    const tokens = await this.redis.get<string[]>(indexKey) || [];
    tokens.push(token);
    await this.redis.set(indexKey, tokens, this.config.sessionTTL);
  }

  /**
   * Remove token from user:sessions reverse index
   */
  private async removeFromUserIndex(userId: string, token: string): Promise<void> {
    if (!this.redis) return;
    const indexKey = `user_sessions:${userId}`;
    const tokens = await this.redis.get<string[]>(indexKey);
    if (!tokens) return;
    const filtered = tokens.filter(t => t !== token);
    if (filtered.length > 0) {
      await this.redis.set(indexKey, filtered, this.config.sessionTTL);
    } else {
      await this.redis.del(indexKey);
    }
  }

  /**
   * Invalidate all sessions for a user
   */
  async invalidateUserSessions(userId: string): Promise<number> {
    const tokens = await this.getUserSessions(userId);
    let count = 0;
    for (const token of tokens) {
      if (await this.delete(token)) {
        count++;
      }
    }
    logger.info('User sessions invalidated', { userId, count });
    return count;
  }

  /**
   * Cleanup expired sessions (memory fallback only)
   */
  cleanup(): number {
    if (!this.useMemoryFallback) {
      // Redis handles TTL automatically
      return 0;
    }

    const now = Date.now();
    const expireThreshold = this.config.sessionTTL * 1000;
    let cleaned = 0;

    for (const [token, session] of memoryStore.entries()) {
      if (now - session.lastActivity > expireThreshold) {
        memoryStore.delete(token);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Sessions cleaned up', { count: cleaned });
    }
    return cleaned;
  }

  /**
   * Get session statistics
   */
  getStats(): { mode: string; activeSessions?: number } {
    return {
      mode: this.useMemoryFallback ? 'memory' : 'redis',
      activeSessions: this.useMemoryFallback ? memoryStore.size : undefined,
    };
  }
}

// Export singleton instance
export const sessionStore = new SessionStore({
  sessionTTL: 86400, // 24 hours
});
