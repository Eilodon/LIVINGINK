/**
 * PHASE 2: Database Migration Scripts
 * Zero-downtime data migration utilities
 */

import { db } from './PostgreSQLManager';
import { cache } from './RedisManager';
import { migrationManager } from './MigrationManager';
import { logger } from '../logging/Logger';

export interface MigrationScript {
  id: string;
  name: string;
  version: string;
  description: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
  estimatedTime: number; // minutes
  requiresDowntime: boolean;
}

export class DataMigrationService {
  private static instance: DataMigrationService;
  private migrations: Map<string, MigrationScript> = new Map();
  
  static getInstance(): DataMigrationService {
    if (!DataMigrationService.instance) {
      DataMigrationService.instance = new DataMigrationService();
    }
    return DataMigrationService.instance;
  }
  
  // EIDOLON-V PHASE2: Register migration scripts
  registerMigration(script: MigrationScript): void {
    this.migrations.set(script.id, script);
    logger.info('Migration script registered', { id: script.id, name: script.name });
  }
  
  // EIDOLON-V PHASE2: Run specific migration
  async runMigration(migrationId: string): Promise<void> {
    const migration = this.migrations.get(migrationId);
    if (!migration) {
      throw new Error(`Migration not found: ${migrationId}`);
    }
    
    logger.info('Starting migration', {
      id: migration.id,
      name: migration.name,
      version: migration.version,
      estimatedTime: migration.estimatedTime,
      requiresDowntime: migration.requiresDowntime
    });
    
    const startTime = Date.now();
    
    try {
      // Check if migration requires downtime
      if (migration.requiresDowntime) {
        logger.warn('Migration requires downtime', { id: migration.id });
        // In production, this would trigger maintenance mode
      }
      
      // Create backup before migration
      await this.createBackup(migration.id);
      
      // Run migration
      await migration.up();
      
      // Record migration completion
      await this.recordMigrationCompletion(migration);
      
      const duration = (Date.now() - startTime) / 1000;
      logger.info('Migration completed successfully', {
        id: migration.id,
        duration: `${duration}s`
      });
      
    } catch (error) {
      logger.error('Migration failed', { id: migration.id }, error instanceof Error ? error : undefined);
      
      // Attempt rollback
      try {
        await this.rollbackMigration(migrationId);
        logger.info('Migration rolled back', { id: migration.id });
      } catch (rollbackError) {
        logger.error('Rollback failed', { id: migration.id }, rollbackError instanceof Error ? rollbackError : undefined);
      }
      
      throw error;
    }
  }
  
  // EIDOLON-V PHASE2: Rollback migration
  async rollbackMigration(migrationId: string): Promise<void> {
    const migration = this.migrations.get(migrationId);
    if (!migration) {
      throw new Error(`Migration not found: ${migrationId}`);
    }
    
    logger.warn('Rolling back migration', { id: migration.id });
    
    try {
      await migration.down();
      
      // Remove migration record
      await this.removeMigrationRecord(migrationId);
      
      logger.info('Migration rolled back successfully', { id: migration.id });
    } catch (error) {
      logger.error('Rollback failed', { id: migration.id }, error instanceof Error ? error : undefined);
      throw error;
    }
  }
  
  // EIDOLON-V PHASE2: Run all pending migrations
  async runPendingMigrations(): Promise<void> {
    logger.info('Running pending migrations');
    
    const status = await migrationManager.getStatus();
    const executedMigrations = new Set(status.migrations.filter(m => m.status === 'executed').map(m => m.id));
    
    for (const [migrationId, migration] of this.migrations) {
      if (!executedMigrations.has(migrationId)) {
        await this.runMigration(migrationId);
      }
    }
    
    logger.info('All pending migrations completed');
  }
  
  // EIDOLON-V PHASE2: Create backup
  private async createBackup(migrationId: string): Promise<void> {
    const backupName = `backup_${migrationId}_${Date.now()}`;
    
    try {
      // In production, this would create a proper database backup
      logger.info('Creating backup', { migrationId, backupName });
      
      // For now, just record the backup
      await db.query(`
        INSERT INTO system_metrics (metric_name, metric_value, metric_unit, tags)
        VALUES ($1, $2, $3, $4)
      `, [
        'migration_backup',
        1,
        'count',
        JSON.stringify({ migrationId, backupName, timestamp: new Date().toISOString() })
      ]);
      
    } catch (error) {
      logger.error('Failed to create backup', { migrationId }, error instanceof Error ? error : undefined);
      throw error;
    }
  }
  
  // EIDOLON-V PHASE2: Record migration completion
  private async recordMigrationCompletion(migration: MigrationScript): Promise<void> {
    try {
      await db.query(`
        INSERT INTO migrations (id, name, checksum)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          checksum = EXCLUDED.checksum,
          executed_at = NOW()
      `, [migration.id, migration.name, this.generateChecksum(migration)]);
      
    } catch (error) {
      logger.error('Failed to record migration', { id: migration.id }, error instanceof Error ? error : undefined);
      throw error;
    }
  }
  
  // EIDOLON-V PHASE2: Remove migration record
  private async removeMigrationRecord(migrationId: string): Promise<void> {
    try {
      await db.query('DELETE FROM migrations WHERE id = $1', [migrationId]);
    } catch (error) {
      logger.error('Failed to remove migration record', { id: migrationId }, error instanceof Error ? error : undefined);
      throw error;
    }
  }
  
  // EIDOLON-V PHASE2: Generate checksum
  private generateChecksum(migration: MigrationScript): string {
    const crypto = require('crypto');
    const content = `${migration.id}:${migration.name}:${migration.version}`;
    return crypto.createHash('sha256').update(content).digest('hex');
  }
  
  // EIDOLON-V PHASE2: Get migration status
  async getMigrationStatus(): Promise<{
    total: number;
    executed: number;
    pending: number;
    migrations: Array<{
      id: string;
      name: string;
      version: string;
      status: 'executed' | 'pending';
      executed_at?: Date;
    }>;
  }> {
    const status = await migrationManager.getStatus();
    const executedMigrations = new Set(status.migrations.filter(m => m.status === 'executed').map(m => m.id));
    
    const migrationStatus = Array.from(this.migrations.entries()).map(([id, migration]) => ({
      id,
      name: migration.name,
      version: migration.version,
      status: executedMigrations.has(id) ? 'executed' as const : 'pending' as const
    }));
    
    return {
      total: this.migrations.size,
      executed: executedMigrations.size,
      pending: this.migrations.size - executedMigrations.size,
      migrations: migrationStatus
    };
  }
  
  // EIDOLON-V PHASE2: Initialize default migrations
  initializeDefaultMigrations(): void {
    // Migration 001: User data migration
    this.registerMigration({
      id: '001_user_data_migration',
      name: 'User Data Migration',
      version: '1.0.0',
      description: 'Migrate user data from in-memory to database',
      estimatedTime: 5,
      requiresDowntime: false,
      up: async () => {
        logger.info('Running user data migration');
        
        // This would migrate user data from in-memory to database
        // For now, just create some sample data
        await db.query(`
          INSERT INTO users (username, email, password_hash, salt, is_active, is_guest)
          VALUES 
            ('player1', 'player1@example.com', '$2b$10$example', 'salt1', true, false),
            ('player2', 'player2@example.com', '$2b$10$example', 'salt2', true, false),
            ('player3', 'player3@example.com', '$2b$10$example', 'salt3', true, false)
          ON CONFLICT (username) DO NOTHING
        `);
        
        // Create user stats
        await db.query(`
          INSERT INTO user_stats (user_id, games_played, total_score, highest_score, level)
          SELECT 
            u.id,
            FLOOR(RANDOM() * 100) + 1,
            FLOOR(RANDOM() * 10000) + 1000,
            FLOOR(RANDOM() * 5000) + 2000,
            FLOOR(RANDOM() * 10) + 1
          FROM users u
          WHERE u.is_guest = false
          ON CONFLICT (user_id) DO UPDATE SET
            games_played = user_stats.games_played + 1
        `);
      },
      down: async () => {
        logger.info('Rolling back user data migration');
        
        // Remove sample data
        await db.query('DELETE FROM user_stats WHERE user_id IN (SELECT id FROM users WHERE username LIKE \'player%\'');
        await db.query('DELETE FROM users WHERE username LIKE \'player%\'');
      }
    });
    
    // Migration 002: Analytics data migration
    this.registerMigration({
      id: '002_analytics_migration',
      name: 'Analytics Data Migration',
      version: '1.0.0',
      description: 'Set up analytics tables and initial data',
      estimatedTime: 3,
      requiresDowntime: false,
      up: async () => {
        logger.info('Running analytics migration');
        
        // Create sample analytics events
        await db.query(`
          INSERT INTO analytics_events (event_type, event_data, server_timestamp)
          VALUES 
            ('user_login', '{"userId": "user1", "method": "password"}', NOW()),
            ('game_start', '{"userId": "user1", "gameMode": "battle_royale"}', NOW()),
            ('game_end', '{"userId": "user1", "score": 1500, "duration": 300}', NOW()),
            ('user_logout', '{"userId": "user1", "sessionDuration": 600}', NOW())
        `);
      },
      down: async () => {
        logger.info('Rolling back analytics migration');
        
        await db.query('DELETE FROM analytics_events WHERE event_type IN (\'user_login\', \'game_start\', \'game_end\', \'user_logout\')');
      }
    });
    
    // Migration 003: Performance optimization
    this.registerMigration({
      id: '003_performance_optimization',
      name: 'Performance Optimization',
      version: '1.0.0',
      description: 'Add indexes and optimize database performance',
      estimatedTime: 2,
      requiresDowntime: false,
      up: async () => {
        logger.info('Running performance optimization migration');
        
        // Create additional indexes for performance
        await db.query('CREATE INDEX IF NOT EXISTS idx_users_created_at_desc ON users(created_at DESC)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_analytics_events_user_timestamp ON analytics_events(user_id, server_timestamp DESC)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_user_stats_score_level ON user_stats(total_score DESC, level DESC)');
        
        // Update table statistics
        await db.query('ANALYZE users');
        await db.query('ANALYZE user_stats');
        await db.query('ANALYZE analytics_events');
      },
      down: async () => {
        logger.info('Rolling back performance optimization migration');
        
        // Drop additional indexes
        await db.query('DROP INDEX IF EXISTS idx_users_created_at_desc');
        await db.query('DROP INDEX IF EXISTS idx_analytics_events_user_timestamp');
        await db.query('DROP INDEX IF EXISTS idx_user_stats_score_level');
      }
    });
  }
  
  // EIDOLON-V PHASE2: Validate migration integrity
  async validateMigrationIntegrity(): Promise<{
    isValid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    try {
      // Check database connection
      const healthCheck = await db.healthCheck();
      if (!healthCheck.connected) {
        issues.push('Database connection failed');
      }
      
      // Check Redis connection
      const redisHealth = await cache.healthCheck();
      if (!redisHealth.connected) {
        issues.push('Redis connection failed');
      }
      
      // Check migration table
      const migrationStatus = await this.getMigrationStatus();
      const totalMigrations = this.migrations.size;
      
      if (totalMigrations === 0) {
        issues.push('No migrations registered');
      }
      
      // Check for missing migrations
      const registeredIds = new Set(this.migrations.keys());
      const executedIds = new Set(migrationStatus.migrations.filter(m => m.status === 'executed').map(m => m.id));
      
      for (const migrationId of registeredIds) {
        if (!executedIds.has(migrationId)) {
          issues.push(`Pending migration: ${migrationId}`);
        }
      }
      
      return {
        isValid: issues.length === 0,
        issues
      };
      
    } catch (error) {
      logger.error('Migration validation failed', undefined, error instanceof Error ? error : undefined);
      return {
        isValid: false,
        issues: ['Validation error: ' + (error instanceof Error ? error.message : String(error))]
      };
    }
  }
}

// EIDOLON-V PHASE2: Export singleton instance
export const dataMigrationService = DataMigrationService.getInstance();
