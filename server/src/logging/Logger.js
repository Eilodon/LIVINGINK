"use strict";
/**
 * PHASE 1 EMERGENCY: Enhanced Error Handling & Logging
 * Centralized error management and structured logging
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.logger = exports.ErrorHandler = exports.Logger = exports.LogLevel = void 0;
exports.logMethod = logMethod;
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["ERROR"] = 0] = "ERROR";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 3] = "DEBUG";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger {
    constructor() {
        this.logs = [];
        this.maxLogSize = 10000; // Keep last 10k logs
        this.logLevel = process.env.LOG_LEVEL ?
            LogLevel[process.env.LOG_LEVEL.toUpperCase()] :
            LogLevel.INFO;
    }
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    // EIDOLON-V PHASE1: Core logging method
    log(level, message, context, error) {
        if (level > this.logLevel)
            return;
        const logEntry = {
            timestamp: Date.now(),
            level,
            message,
            context,
            error: error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : undefined
        };
        // Add to memory buffer
        this.logs.push(logEntry);
        // Trim if too many logs
        if (this.logs.length > this.maxLogSize) {
            this.logs = this.logs.slice(-this.maxLogSize);
        }
        // Output to console with formatting
        this.outputToConsole(logEntry);
    }
    // EIDOLON-V PHASE1: Console output with colors
    outputToConsole(entry) {
        const timestamp = new Date(entry.timestamp).toISOString();
        const levelStr = LogLevel[entry.level].padEnd(5);
        const contextStr = entry.context ? ` | ${JSON.stringify(entry.context)}` : '';
        const errorStr = entry.error ? ` | ${entry.error.message}` : '';
        let colorCode = '';
        switch (entry.level) {
            case LogLevel.ERROR:
                colorCode = '\x1b[31m'; // Red
                break;
            case LogLevel.WARN:
                colorCode = '\x1b[33m'; // Yellow
                break;
            case LogLevel.INFO:
                colorCode = '\x1b[36m'; // Cyan
                break;
            case LogLevel.DEBUG:
                colorCode = '\x1b[37m'; // White
                break;
        }
        const resetCode = '\x1b[0m';
        const logMessage = `${colorCode}[${timestamp}] ${levelStr} | ${entry.message}${contextStr}${errorStr}${resetCode}`;
        switch (entry.level) {
            case LogLevel.ERROR:
                console.error(logMessage);
                if (entry.error?.stack) {
                    console.error(entry.error.stack);
                }
                break;
            case LogLevel.WARN:
                console.warn(logMessage);
                break;
            case LogLevel.INFO:
                console.info(logMessage);
                break;
            case LogLevel.DEBUG:
                console.debug(logMessage);
                break;
        }
    }
    // EIDOLON-V PHASE1: Public logging methods
    error(message, context, error) {
        this.log(LogLevel.ERROR, message, context, error);
    }
    warn(message, context) {
        this.log(LogLevel.WARN, message, context);
    }
    info(message, context) {
        this.log(LogLevel.INFO, message, context);
    }
    debug(message, context) {
        this.log(LogLevel.DEBUG, message, context);
    }
    // EIDOLON-V PHASE1: Security-specific logging
    security(event, details, severity = 'medium') {
        const level = severity === 'high' ? LogLevel.ERROR :
            severity === 'medium' ? LogLevel.WARN : LogLevel.INFO;
        this.log(level, `SECURITY: ${event}`, {
            severity,
            ...details
        });
    }
    // EIDOLON-V PHASE1: Game-specific logging
    game(event, details) {
        this.log(LogLevel.INFO, `GAME: ${event}`, details);
    }
    // EIDOLON-V PHASE1: Performance logging
    performance(operation, duration, details) {
        this.log(LogLevel.DEBUG, `PERF: ${operation} took ${duration}ms`, details);
    }
    // EIDOLON-V PHASE1: Get recent logs
    getRecentLogs(count = 100, level) {
        let logs = this.logs.slice(-count);
        if (level !== undefined) {
            logs = logs.filter(log => log.level <= level);
        }
        return logs;
    }
    // EIDOLON-V PHASE1: Get logs by level
    getLogsByLevel(level, count = 100) {
        return this.logs
            .filter(log => log.level === level)
            .slice(-count);
    }
    // EIDOLON-V PHASE1: Clear logs
    clearLogs() {
        this.logs = [];
    }
    // EIDOLON-V PHASE1: Get log statistics
    getLogStats() {
        const byLevel = {};
        for (const log of this.logs) {
            const levelName = LogLevel[log.level];
            byLevel[levelName] = (byLevel[levelName] || 0) + 1;
        }
        return {
            total: this.logs.length,
            byLevel,
            oldest: this.logs.length > 0 ? this.logs[0].timestamp : 0,
            newest: this.logs.length > 0 ? this.logs[this.logs.length - 1].timestamp : 0
        };
    }
}
exports.Logger = Logger;
// EIDOLON-V PHASE1: Global error handler
class ErrorHandler {
    // EIDOLON-V PHASE1: Handle uncaught exceptions
    static setupGlobalHandlers() {
        // Uncaught exceptions
        process.on('uncaughtException', (error) => {
            this.logger.error('Uncaught Exception', {
                pid: process.pid,
                uptime: process.uptime()
            }, error);
            // Give time for logging then exit
            setTimeout(() => {
                process.exit(1);
            }, 1000);
        });
        // Unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            this.logger.error('Unhandled Promise Rejection', {
                reason: reason?.toString?.() || reason,
                promise: promise.toString()
            });
        });
        // Warning events
        process.on('warning', (warning) => {
            this.logger.warn('Process Warning', {
                name: warning.name,
                message: warning.message,
                stack: warning.stack
            });
        });
    }
    // EIDOLON-V PHASE1: Handle async errors in Express
    static asyncErrorHandler() {
        return (error, req, res, next) => {
            const requestId = req.id || 'unknown';
            const userId = req.user?.id || 'anonymous';
            const ip = req.ip || req.connection.remoteAddress || 'unknown';
            this.logger.error('Request Error', {
                requestId,
                userId,
                ip,
                method: req.method,
                url: req.url,
                userAgent: req.get('User-Agent')
            }, error);
            // Don't expose internal errors to clients
            const isDevelopment = process.env.NODE_ENV !== 'production';
            const message = isDevelopment ? error.message : 'Internal server error';
            res.status(500).json({
                error: message,
                requestId,
                timestamp: Date.now()
            });
        };
    }
    // EIDOLON-V PHASE1: Handle game room errors
    static handleGameRoomError(error, context) {
        this.logger.error('Game Room Error', context, error);
    }
    // EIDOLON-V PHASE1: Handle authentication errors
    static handleAuthError(error, context) {
        this.logger.security('Authentication Error', {
            ...context,
            error: error.message
        }, 'medium');
    }
    // EIDOLON-V PHASE1: Handle validation errors
    static handleValidationError(message, context) {
        this.logger.warn('Validation Error', {
            message,
            ...context
        });
    }
}
exports.ErrorHandler = ErrorHandler;
ErrorHandler.logger = Logger.getInstance();
// EIDOLON-V PHASE1: Decorator for method logging
function logMethod(level = LogLevel.DEBUG) {
    return function (target, propertyName, descriptor) {
        const method = descriptor.value;
        const logger = Logger.getInstance();
        descriptor.value = function (...args) {
            const startTime = Date.now();
            const className = target.constructor.name;
            logger.debug(`METHOD: ${className}.${propertyName} called`, {
                args: args.length,
                argsPreview: args.slice(0, 3).map(arg => typeof arg === 'object' ? '[Object]' : String(arg))
            });
            try {
                const result = method.apply(this, args);
                if (result && typeof result.catch === 'function') {
                    // Handle Promise
                    return result.catch((error) => {
                        const duration = Date.now() - startTime;
                        logger.error(`METHOD: ${className}.${propertyName} failed`, {
                            duration,
                            args: args.length
                        }, error);
                        throw error;
                    }).then((result) => {
                        const duration = Date.now() - startTime;
                        logger.debug(`METHOD: ${className}.${propertyName} completed`, {
                            duration,
                            resultType: typeof result
                        });
                        return result;
                    });
                }
                else {
                    const duration = Date.now() - startTime;
                    logger.debug(`METHOD: ${className}.${propertyName} completed`, {
                        duration,
                        resultType: typeof result
                    });
                    return result;
                }
            }
            catch (error) {
                const duration = Date.now() - startTime;
                logger.error(`METHOD: ${className}.${propertyName} threw error`, {
                    duration,
                    args: args.length
                }, error);
                throw error;
            }
        };
        return descriptor;
    };
}
// EIDOLON-V PHASE1: Export instances
exports.logger = Logger.getInstance();
exports.errorHandler = ErrorHandler;
