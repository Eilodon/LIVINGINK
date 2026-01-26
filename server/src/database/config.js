"use strict";
/**
 * PHASE 2: Database Configuration
 * PostgreSQL + Redis setup for enterprise scalability
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabaseConfig = void 0;
const getDatabaseConfig = () => {
    const isProduction = process.env.NODE_ENV === 'production';
    const isDevelopment = process.env.NODE_ENV === 'development';
    return {
        postgres: {
            host: process.env.POSTGRES_HOST || (isDevelopment ? 'localhost' : 'postgres'),
            port: parseInt(process.env.POSTGRES_PORT || '5432'),
            database: process.env.POSTGRES_DB || 'color_jelly_rush',
            username: process.env.POSTGRES_USER || 'cjr_user',
            password: process.env.POSTGRES_PASSWORD || 'cjr_password',
            ssl: isProduction,
            pool: {
                min: parseInt(process.env.POSTGRES_POOL_MIN || '2'),
                max: parseInt(process.env.POSTGRES_POOL_MAX || '10'),
                idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000')
            }
        },
        redis: {
            host: process.env.REDIS_HOST || (isDevelopment ? 'localhost' : 'redis'),
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB || '0'),
            keyPrefix: process.env.REDIS_KEY_PREFIX || 'cjr:',
            retryDelayOnFailover: 100,
            maxRetriesPerRequest: 3
        }
    };
};
exports.getDatabaseConfig = getDatabaseConfig;
