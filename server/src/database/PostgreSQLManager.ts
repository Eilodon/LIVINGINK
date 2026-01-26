/**
 * PHASE 2: PostgreSQL Connection Manager
 * Enterprise-grade database connection handling
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getDatabaseConfig } from './config';
import { logger } from '../logging/Logger';

export interface DatabaseManager {
  query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
  transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export class PostgreSQLManager implements DatabaseManager {
  private pool: Pool;
  private static instance: PostgreSQLManager;

  private constructor() {
    const config = getDatabaseConfig().postgres;

    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      min: config.pool.min,
      max: config.pool.max,
      idleTimeoutMillis: config.pool.idleTimeoutMillis,
      // EIDOLON-V PHASE2: Connection timeout settings
      connectionTimeoutMillis: 10000,
      query_timeout: 30000,
    });

    // EIDOLON-V PHASE2: Pool event listeners
    this.pool.on('connect', (client: PoolClient) => {
      logger.debug('Database client connected', {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount
      });
    });

    this.pool.on('error', (err: Error) => {
      logger.error('Database pool error', {
        error: err.message,
        stack: err.stack
      });
    });

    this.pool.on('remove', () => {
      logger.debug('Database client removed from pool');
    });
  }

  static getInstance(): PostgreSQLManager {
    if (!PostgreSQLManager.instance) {
      PostgreSQLManager.instance = new PostgreSQLManager();
    }
    return PostgreSQLManager.instance;
  }

  // EIDOLON-V PHASE2: Execute query with automatic retry
  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const start = Date.now();
    let client: PoolClient | null = null;

    try {
      // EIDOLON-V PHASE2: Get client from pool
      client = await this.pool.connect();

      logger.debug('Database query executed', {
        query: text.substring(0, 100),
        paramCount: params?.length || 0,
        poolStats: {
          totalCount: this.pool.totalCount,
          idleCount: this.pool.idleCount,
          waitingCount: this.pool.waitingCount
        }
      });

      const result = await client.query<T>(text, params);
      const duration = Date.now() - start;

      logger.debug('Database query completed', {
        duration,
        rowCount: result.rowCount,
        query: text.substring(0, 100)
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Database query failed', {
        duration,
        query: text.substring(0, 100),
        paramCount: params?.length || 0,
        error: error instanceof Error ? error.message : String(error)
      }, error instanceof Error ? error : undefined);

      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  // EIDOLON-V PHASE2: Transaction support
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const start = Date.now();
    let client: PoolClient | null = null;

    try {
      client = await this.pool.connect();
      await client.query('BEGIN');

      logger.debug('Database transaction started');

      const result = await callback(client);

      await client.query('COMMIT');
      const duration = Date.now() - start;

      logger.debug('Database transaction completed', { duration });

      return result;
    } catch (error) {
      if (client) {
        await client.query('ROLLBACK');
      }

      const duration = Date.now() - start;
      logger.error('Database transaction failed', {
        duration,
        error: error instanceof Error ? error.message : String(error)
      }, error instanceof Error ? error : undefined);

      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  // EIDOLON-V PHASE2: Health check
  async healthCheck(): Promise<{
    connected: boolean;
    poolStats: any;
    latency?: number;
  }> {
    try {
      const start = Date.now();
      await this.query('SELECT 1');
      const latency = Date.now() - start;

      return {
        connected: true,
        poolStats: {
          totalCount: this.pool.totalCount,
          idleCount: this.pool.idleCount,
          waitingCount: this.pool.waitingCount
        },
        latency
      };
    } catch (error) {
      return {
        connected: false,
        poolStats: {
          totalCount: this.pool.totalCount,
          idleCount: this.pool.idleCount,
          waitingCount: this.pool.waitingCount
        }
      };
    }
  }

  // EIDOLON-V PHASE2: Close all connections
  async close(): Promise<void> {
    logger.info('Closing database pool');
    await this.pool.end();
  }

  // EIDOLON-V PHASE2: Get pool statistics
  getPoolStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };
  }
}

// EIDOLON-V PHASE2: Export singleton instance
export const db = PostgreSQLManager.getInstance();
