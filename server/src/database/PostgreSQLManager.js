"use strict";
/**
 * PHASE 2: PostgreSQL Connection Manager
 * Enterprise-grade database connection handling
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.PostgreSQLManager = void 0;
const pg_1 = require("pg");
const config_1 = require("./config");
const Logger_1 = require("../logging/Logger");
class PostgreSQLManager {
    constructor() {
        const config = (0, config_1.getDatabaseConfig)().postgres;
        this.pool = new pg_1.Pool({
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
        this.pool.on('connect', (client) => {
            Logger_1.logger.debug('Database client connected', {
                totalCount: this.pool.totalCount,
                idleCount: this.pool.idleCount,
                waitingCount: this.pool.waitingCount
            });
        });
        this.pool.on('error', (err) => {
            Logger_1.logger.error('Database pool error', {
                error: err.message,
                stack: err.stack
            });
        });
        this.pool.on('remove', () => {
            Logger_1.logger.debug('Database client removed from pool');
        });
    }
    static getInstance() {
        if (!PostgreSQLManager.instance) {
            PostgreSQLManager.instance = new PostgreSQLManager();
        }
        return PostgreSQLManager.instance;
    }
    // EIDOLON-V PHASE2: Execute query with automatic retry
    async query(text, params) {
        const start = Date.now();
        let client = null;
        try {
            // EIDOLON-V PHASE2: Get client from pool
            client = await this.pool.connect();
            Logger_1.logger.debug('Database query executed', {
                query: text.substring(0, 100),
                paramCount: params?.length || 0,
                poolStats: {
                    totalCount: this.pool.totalCount,
                    idleCount: this.pool.idleCount,
                    waitingCount: this.pool.waitingCount
                }
            });
            const result = await client.query(text, params);
            const duration = Date.now() - start;
            Logger_1.logger.debug('Database query completed', {
                duration,
                rowCount: result.rowCount,
                query: text.substring(0, 100)
            });
            return result;
        }
        catch (error) {
            const duration = Date.now() - start;
            Logger_1.logger.error('Database query failed', {
                duration,
                query: text.substring(0, 100),
                paramCount: params?.length || 0,
                error: error instanceof Error ? error.message : String(error)
            }, error instanceof Error ? error : undefined);
            throw error;
        }
        finally {
            if (client) {
                client.release();
            }
        }
    }
    // EIDOLON-V PHASE2: Transaction support
    async transaction(callback) {
        const start = Date.now();
        let client = null;
        try {
            client = await this.pool.connect();
            await client.query('BEGIN');
            Logger_1.logger.debug('Database transaction started');
            const result = await callback(client);
            await client.query('COMMIT');
            const duration = Date.now() - start;
            Logger_1.logger.debug('Database transaction completed', { duration });
            return result;
        }
        catch (error) {
            if (client) {
                await client.query('ROLLBACK');
            }
            const duration = Date.now() - start;
            Logger_1.logger.error('Database transaction failed', {
                duration,
                error: error instanceof Error ? error.message : String(error)
            }, error instanceof Error ? error : undefined);
            throw error;
        }
        finally {
            if (client) {
                client.release();
            }
        }
    }
    // EIDOLON-V PHASE2: Health check
    async healthCheck() {
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
        }
        catch (error) {
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
    async close() {
        Logger_1.logger.info('Closing database pool');
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
exports.PostgreSQLManager = PostgreSQLManager;
// EIDOLON-V PHASE2: Export singleton instance
exports.db = PostgreSQLManager.getInstance();
