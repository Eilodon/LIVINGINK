/**
 * PHASE 2: Database Migration Manager
 * Handles schema migrations and database setup
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from './PostgreSQLManager';
import { logger } from '../logging/Logger';

export interface Migration {
  id: string;
  name: string;
  sql: string;
  checksum: string;
  executed_at?: Date;
}

export class MigrationManager {
  private static instance: MigrationManager;
  private migrationsPath: string;
  
  private constructor() {
    this.migrationsPath = join(__dirname, 'migrations');
  }
  
  static getInstance(): MigrationManager {
    if (!MigrationManager.instance) {
      MigrationManager.instance = new MigrationManager();
    }
    return MigrationManager.instance;
  }
  
  // EIDOLON-V PHASE2: Initialize migrations table
  private async initializeMigrationsTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    
    await db.query(sql);
    logger.info('Migrations table initialized');
  }
  
  // EIDOLON-V PHASE2: Load migration files
  private loadMigrations(): Migration[] {
    const migrations: Migration[] = [];
    
    // EIDOLON-V PHASE2: For now, hardcode the initial schema migration
    // In production, this would read from the migrations directory
    const initialSchema = readFileSync(
      join(this.migrationsPath, '001_initial_schema.sql'),
      'utf-8'
    );
    
    migrations.push({
      id: '001_initial_schema',
      name: 'Initial Database Schema',
      sql: initialSchema,
      checksum: this.calculateChecksum(initialSchema)
    });
    
    return migrations.sort((a, b) => a.id.localeCompare(b.id));
  }
  
  // EIDOLON-V PHASE2: Calculate checksum for migration
  private calculateChecksum(sql: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(sql).digest('hex');
  }
  
  // EIDOLON-V PHASE2: Get executed migrations
  private async getExecutedMigrations(): Promise<Set<string>> {
    try {
      const result = await db.query('SELECT id FROM migrations ORDER BY id');
      return new Set(result.rows.map((row: any) => row.id));
    } catch (error) {
      // Table might not exist yet
      return new Set();
    }
  }
  
  // EIDOLON-V PHASE2: Execute a single migration
  private async executeMigration(migration: Migration): Promise<void> {
    logger.info('Executing migration', { id: migration.id, name: migration.name });
    
    await db.transaction(async (client) => {
      // Execute migration SQL
      await client.query(migration.sql);
      
      // Record migration as executed
      await client.query(
        'INSERT INTO migrations (id, name, checksum) VALUES ($1, $2, $3)',
        [migration.id, migration.name, migration.checksum]
      );
    });
    
    logger.info('Migration executed successfully', { id: migration.id });
  }
  
  // EIDOLON-V PHASE2: Verify migration integrity
  private async verifyMigration(migration: Migration): Promise<boolean> {
    try {
      const result = await db.query(
        'SELECT checksum FROM migrations WHERE id = $1',
        [migration.id]
      );
      
      if (result.rows.length === 0) {
        return false;
      }
      
      const storedChecksum = result.rows[0].checksum;
      return storedChecksum === migration.checksum;
    } catch (error) {
      logger.error('Failed to verify migration', { id: migration.id }, error instanceof Error ? error : undefined);
      return false;
    }
  }
  
  // EIDOLON-V PHASE2: Run all pending migrations
  async migrate(): Promise<void> {
    try {
      logger.info('Starting database migration process');
      
      // Initialize migrations table
      await this.initializeMigrationsTable();
      
      // Load available migrations
      const migrations = this.loadMigrations();
      const executedMigrations = await this.getExecutedMigrations();
      
      logger.info('Migration status', {
        total: migrations.length,
        executed: executedMigrations.size,
        pending: migrations.length - executedMigrations.size
      });
      
      // Execute pending migrations
      for (const migration of migrations) {
        if (executedMigrations.has(migration.id)) {
          // Verify integrity of already executed migration
          const isValid = await this.verifyMigration(migration);
          if (!isValid) {
            throw new Error(`Migration ${migration.id} checksum mismatch - possible corruption`);
          }
          
          logger.debug('Migration already executed', { id: migration.id });
          continue;
        }
        
        await this.executeMigration(migration);
      }
      
      logger.info('Database migration completed successfully');
    } catch (error) {
      logger.error('Database migration failed', undefined, error instanceof Error ? error : undefined);
      throw error;
    }
  }
  
  // EIDOLON-V PHASE2: Get migration status
  async getStatus(): Promise<{
    total: number;
    executed: number;
    pending: number;
    migrations: Array<{
      id: string;
      name: string;
      status: 'executed' | 'pending';
      executed_at?: Date;
    }>;
  }> {
    try {
      await this.initializeMigrationsTable();
      
      const migrations = this.loadMigrations();
      const executedMigrations = await this.getExecutedMigrations();
      
      const migrationStatus = migrations.map(migration => {
        const isExecuted = executedMigrations.has(migration.id);
        return {
          id: migration.id,
          name: migration.name,
          status: isExecuted ? 'executed' as const : 'pending' as const
        };
      });
      
      return {
        total: migrations.length,
        executed: executedMigrations.size,
        pending: migrations.length - executedMigrations.size,
        migrations: migrationStatus
      };
    } catch (error) {
      logger.error('Failed to get migration status', undefined, error instanceof Error ? error : undefined);
      throw error;
    }
  }
  
  // EIDOLON-V PHASE2: Reset database (for development/testing only)
  async reset(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database reset is not allowed in production');
    }
    
    logger.warn('Resetting database - ALL DATA WILL BE LOST');
    
    // Drop all tables
    await db.query(`
      DROP TABLE IF EXISTS migrations CASCADE;
      DROP TABLE IF EXISTS security_events CASCADE;
      DROP TABLE IF EXISTS system_metrics CASCADE;
      DROP TABLE IF EXISTS analytics_events CASCADE;
      DROP TABLE IF EXISTS user_preferences CASCADE;
      DROP TABLE IF EXISTS leaderboard CASCADE;
      DROP TABLE IF EXISTS session_participants CASCADE;
      DROP TABLE IF EXISTS game_sessions CASCADE;
      DROP TABLE IF EXISTS user_stats CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);
    
    // Drop views
    await db.query(`
      DROP VIEW IF EXISTS active_sessions_view;
      DROP VIEW IF EXISTS leaderboard_view;
    `);
    
    // Run migrations again
    await this.migrate();
    
    logger.info('Database reset completed');
  }
}

// EIDOLON-V PHASE2: Export singleton instance
export const migrationManager = MigrationManager.getInstance();
