/**
 * PHASE 2: Cache Service Layer
 * High-performance caching with Redis for game state and sessions
 */

import { cache } from './RedisManager';
import { logger } from '../logging/Logger';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Key prefix
}

export class CacheService {
  private static instance: CacheService;
  private defaultTTL = 3600; // 1 hour default
  
  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }
  
  // EIDOLON-V PHASE2: Session caching
  async setSession(sessionId: string, sessionData: any, ttl: number = 86400): Promise<void> {
    const key = `session:${sessionId}`;
    await cache.set(key, sessionData, ttl);
    logger.debug('Session cached', { sessionId, ttl });
  }
  
  async getSession(sessionId: string): Promise<any | null> {
    const key = `session:${sessionId}`;
    return await cache.get(key);
  }
  
  async removeSession(sessionId: string): Promise<void> {
    const key = `session:${sessionId}`;
    await cache.del(key);
    logger.debug('Session removed from cache', { sessionId });
  }
  
  // EIDOLON-V PHASE2: User data caching
  async setUser(userId: string, userData: any, ttl: number = 3600): Promise<void> {
    const key = `user:${userId}`;
    await cache.set(key, userData, ttl);
    logger.debug('User data cached', { userId, ttl });
  }
  
  async getUser(userId: string): Promise<any | null> {
    const key = `user:${userId}`;
    return await cache.get(key);
  }
  
  async invalidateUser(userId: string): Promise<void> {
    const key = `user:${userId}`;
    await cache.del(key);
    logger.debug('User cache invalidated', { userId });
  }
  
  // EIDOLON-V PHASE2: Game state caching
  async setGameState(roomId: string, gameState: any, ttl: number = 300): Promise<void> {
    const key = `game_state:${roomId}`;
    await cache.set(key, gameState, ttl);
    logger.debug('Game state cached', { roomId, ttl });
  }
  
  async getGameState(roomId: string): Promise<any | null> {
    const key = `game_state:${roomId}`;
    return await cache.get(key);
  }
  
  async updateGameState(roomId: string, updates: Partial<any>): Promise<void> {
    const key = `game_state:${roomId}`;
    const currentState = await this.getGameState(roomId);
    
    if (currentState) {
      const updatedState = { ...currentState, ...updates };
      await cache.set(key, updatedState, 300); // Reset TTL to 5 minutes
      logger.debug('Game state updated', { roomId });
    }
  }
  
  // EIDOLON-V PHASE2: Leaderboard caching
  async setLeaderboard(leaderboardType: string, data: any[], ttl: number = 600): Promise<void> {
    const key = `leaderboard:${leaderboardType}`;
    await cache.set(key, data, ttl);
    logger.debug('Leaderboard cached', { leaderboardType, count: data.length });
  }
  
  async getLeaderboard(leaderboardType: string): Promise<any[] | null> {
    const key = `leaderboard:${leaderboardType}`;
    return await cache.get(key);
  }
  
  // EIDOLON-V PHASE2: Rate limiting
  async checkRateLimit(identifier: string, limit: number, window: number): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    const key = `rate_limit:${identifier}`;
    const now = Date.now();
    const windowStart = now - (window * 1000);
    
    // Get current count
    const current = (await cache.get(key)) || { count: 0, resetTime: now + (window * 1000) };
    
    if (now > (current as any).resetTime) {
      // Reset window
      const newCount = 1;
      const resetTime = now + (window * 1000);
      await cache.set(key, { count: newCount, resetTime }, window);
      
      return {
        allowed: true,
        remaining: limit - newCount,
        resetTime
      };
    }
    
    if ((current as any).count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: (current as any).resetTime
      };
    }
    
    // Increment count
    const newCount = (current as any).count + 1;
    await cache.set(key, { count: newCount, resetTime: (current as any).resetTime }, window);
    
    return {
      allowed: true,
      remaining: limit - newCount,
      resetTime: (current as any).resetTime
    };
  }
  
  // EIDOLON-V PHASE2: Analytics event buffering
  async bufferAnalyticsEvent(event: any): Promise<void> {
    const key = `analytics_buffer`;
    const buffer = (await cache.get(key)) as any[] || [];
    
    buffer.push({
      ...event,
      timestamp: Date.now()
    });
    
    // Keep only last 1000 events
    if (buffer.length > 1000) {
      buffer.splice(0, buffer.length - 1000);
    }
    
    await cache.set(key, buffer, 300); // 5 minutes TTL
    logger.debug('Analytics event buffered', { eventType: event.type, bufferSize: buffer.length });
  }
  
  async getAnalyticsBuffer(): Promise<any[]> {
    const key = `analytics_buffer`;
    return (await cache.get(key)) as any[] || [];
  }
  
  async clearAnalyticsBuffer(): Promise<void> {
    const key = `analytics_buffer`;
    await cache.del(key);
    logger.debug('Analytics buffer cleared');
  }
  
  // EIDOLON-V PHASE2: Cache warming
  async warmCache(): Promise<void> {
    logger.info('Starting cache warming');
    
    try {
      // Warm common data
      await this.warmLeaderboards();
      await this.warmCommonGameData();
      
      logger.info('Cache warming completed');
    } catch (error) {
      logger.error('Cache warming failed', undefined, error instanceof Error ? error : undefined);
    }
  }
  
  private async warmLeaderboards(): Promise<void> {
    // EIDOLON-V PHASE2: Pre-load leaderboards
    const leaderboardTypes = ['global', 'daily', 'weekly'];
    
    for (const type of leaderboardTypes) {
      try {
        // This would fetch from database and cache
        // For now, just check if cache exists
        const cached = await this.getLeaderboard(type);
        if (!cached) {
          logger.debug('Leaderboard cache miss', { type });
        }
      } catch (error) {
        logger.warn('Failed to warm leaderboard cache', { type, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  
  private async warmCommonGameData(): Promise<void> {
    // EIDOLON-V PHASE2: Pre-load common game data
    const commonKeys = [
      'game_config',
      'map_data',
      'item_definitions'
    ];
    
    for (const key of commonKeys) {
      try {
        const cached = await cache.get(key);
        if (!cached) {
          logger.debug('Common game data cache miss', { key });
        }
      } catch (error) {
        logger.warn('Failed to warm game data cache', { key, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  
  // EIDOLON-V PHASE2: Cache statistics
  async getCacheStats(): Promise<{
    connected: boolean;
    latency?: number;
    info?: any;
  }> {
    const healthCheck = await cache.healthCheck();
    const info = await (cache as any).getInfo?.();
    
    return {
      connected: healthCheck.connected,
      latency: healthCheck.latency,
      info
    };
  }
  
  // EIDOLON-V PHASE2: Generic cache operations
  async set(key: string, value: any, options?: CacheOptions): Promise<void> {
    const fullKey = options?.prefix ? `${options.prefix}:${key}` : key;
    await cache.set(fullKey, value, options?.ttl || this.defaultTTL);
  }
  
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    const fullKey = options?.prefix ? `${options.prefix}:${key}` : key;
    return await cache.get<T>(fullKey);
  }
  
  async del(key: string, options?: CacheOptions): Promise<void> {
    const fullKey = options?.prefix ? `${options.prefix}:${key}` : key;
    await cache.del(fullKey);
  }
  
  async exists(key: string, options?: CacheOptions): Promise<boolean> {
    const fullKey = options?.prefix ? `${options.prefix}:${key}` : key;
    return await cache.exists(fullKey);
  }
  
  // EIDOLON-V PHASE2: Cache invalidation patterns
  async invalidatePattern(pattern: string): Promise<void> {
    // EIDOLON-V PHASE2: This would require Redis SCAN or KEYS command
    // For now, implement common patterns
    if (pattern === 'sessions') {
      // Invalidate all sessions (would need SCAN in production)
      logger.warn('Invalidating all sessions - this is expensive');
    } else if (pattern === 'leaderboards') {
      await this.del('leaderboard:global');
      await this.del('leaderboard:daily');
      await this.del('leaderboard:weekly');
    }
  }
}

// EIDOLON-V PHASE2: Export singleton instance
export const cacheService = CacheService.getInstance();
