/**
 * PHASE 1 EMERGENCY: Enhanced Error Handling & Logging
 * Centralized error management and structured logging
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  context?: unknown;
  userId?: string;
  sessionId?: string;
  // EIDOLON-V P3-3: Added correlation ID for request tracing
  correlationId?: string;
  roomId?: string;
  ip?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogSize = 10000; // Keep last 10k logs
  private logLevel = process.env.LOG_LEVEL
    ? LogLevel[process.env.LOG_LEVEL.toUpperCase() as keyof typeof LogLevel]
    : LogLevel.INFO;
  // EIDOLON-V P3-3: JSON output mode for production (searchable logs)
  private jsonMode = process.env.NODE_ENV === 'production' || process.env.LOG_JSON === 'true';
  // EIDOLON-V P3-3: Current correlation ID for request scoping
  private currentCorrelationId?: string;

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  // EIDOLON-V P3-3: Trace management
  setCorrelationId(id: string): void {
    this.currentCorrelationId = id;
  }

  clearCorrelationId(): void {
    this.currentCorrelationId = undefined;
  }

  // EIDOLON-V PHASE1: Core logging method
  protected log(level: LogLevel, message: string, context?: unknown, error?: Error): void {
    if (level > this.logLevel) return;

    const logEntry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      context,
      // EIDOLON-V P3-3: Inject correlation ID if available
      correlationId: this.currentCorrelationId,
      error: error
        ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
        : undefined,
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

  // EIDOLON-V PHASE1: Console output with colors OR JSON
  private outputToConsole(entry: LogEntry): void {
    if (this.jsonMode) {
      // EIDOLON-V P3-3: Production JSON format (One line per log for splitting systems)
      console.log(JSON.stringify(entry));
      return;
    }

    const timestamp = new Date(entry.timestamp).toISOString();
    const levelStr = LogLevel[entry.level].padEnd(5);
    const correlationStr = entry.correlationId ? ` [${entry.correlationId}]` : '';
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
    const logMessage = `${colorCode}[${timestamp}]${correlationStr} ${levelStr} | ${entry.message}${contextStr}${errorStr}${resetCode}`;

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
  error(message: string, context?: unknown, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  warn(message: string, context?: unknown): void {
    this.log(LogLevel.WARN, message, context);
  }

  info(message: string, context?: unknown): void {
    this.log(LogLevel.INFO, message, context);
  }

  debug(message: string, context?: unknown): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  // EIDOLON-V PHASE1: Security-specific logging
  security(event: string, details: unknown, severity: 'low' | 'medium' | 'high' = 'medium'): void {
    const level =
      severity === 'high' ? LogLevel.ERROR : severity === 'medium' ? LogLevel.WARN : LogLevel.INFO;

    // Ensure details is an object if possible
    const context =
      typeof details === 'object' && details !== null
        ? { severity, ...details }
        : { severity, details };

    this.log(level, `SECURITY: ${event}`, context);
  }

  // EIDOLON-V PHASE1: Game-specific logging
  game(event: string, details: unknown): void {
    this.log(LogLevel.INFO, `GAME: ${event}`, details);
  }

  // EIDOLON-V PHASE1: Performance logging
  performance(operation: string, duration: number, details?: unknown): void {
    this.log(LogLevel.DEBUG, `PERF: ${operation} took ${duration}ms`, details);
  }

  // EIDOLON-V PHASE1: Get recent logs
  getRecentLogs(count: number = 100, level?: LogLevel): LogEntry[] {
    let logs = this.logs.slice(-count);

    if (level !== undefined) {
      logs = logs.filter(log => log.level <= level);
    }

    return logs;
  }

  // EIDOLON-V PHASE1: Get logs by level
  getLogsByLevel(level: LogLevel, count: number = 100): LogEntry[] {
    return this.logs.filter(log => log.level === level).slice(-count);
  }

  // EIDOLON-V PHASE1: Clear logs
  clearLogs(): void {
    this.logs = [];
  }

  // EIDOLON-V PHASE1: Get log statistics
  getLogStats(): {
    total: number;
    byLevel: Record<string, number>;
    oldest: number;
    newest: number;
  } {
    const byLevel: Record<string, number> = {};

    for (const log of this.logs) {
      const levelName = LogLevel[log.level];
      byLevel[levelName] = (byLevel[levelName] || 0) + 1;
    }

    return {
      total: this.logs.length,
      byLevel,
      oldest: this.logs.length > 0 ? this.logs[0].timestamp : 0,
      newest: this.logs.length > 0 ? this.logs[this.logs.length - 1].timestamp : 0,
    };
  }
}

// EIDOLON-V PHASE1: Global error handler
export class ErrorHandler {
  private static logger = Logger.getInstance();

  // EIDOLON-V PHASE1: Handle uncaught exceptions
  static setupGlobalHandlers(): void {
    // Uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      this.logger.error(
        'Uncaught Exception',
        {
          pid: process.pid,
          uptime: process.uptime(),
        },
        error
      );

      // Give time for logging then exit
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });

    // Unhandled promise rejections
    process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
      this.logger.error('Unhandled Promise Rejection', {
        reason: typeof reason === 'object' ? reason : String(reason),
        promise: String(promise),
      });
    });

    // Warning events
    process.on('warning', (warning: Error) => {
      this.logger.warn('Process Warning', {
        name: warning.name,
        message: warning.message,
        stack: warning.stack,
      });
    });
  }

  // EIDOLON-V PHASE1: Handle async errors in Express
  static asyncErrorHandler() {
    return (error: Error, req: any, res: any, next: any) => {
      const requestId = req.id || 'unknown';
      const userId = req.user?.id || 'anonymous';
      const ip = req.ip || req.connection.remoteAddress || 'unknown';

      this.logger.error(
        'Request Error',
        {
          requestId,
          userId,
          ip,
          method: req.method,
          url: req.url,
          userAgent: req.get('User-Agent'),
        },
        error
      );

      // Don't expose internal errors to clients
      const isDevelopment = process.env.NODE_ENV !== 'production';
      const message = isDevelopment ? error.message : 'Internal server error';

      res.status(500).json({
        error: message,
        requestId,
        timestamp: Date.now(),
      });
    };
  }

  // EIDOLON-V PHASE1: Handle game room errors
  static handleGameRoomError(
    error: Error,
    context: {
      roomId: string;
      userId?: string;
      operation: string;
    }
  ): void {
    this.logger.error('Game Room Error', context, error);
  }

  // EIDOLON-V PHASE1: Handle authentication errors
  static handleAuthError(
    error: Error,
    context: {
      ip: string;
      endpoint: string;
      userId?: string;
    }
  ): void {
    this.logger.security(
      'Authentication Error',
      {
        ...context,
        error: error.message,
      },
      'medium'
    );
  }

  // EIDOLON-V PHASE1: Handle validation errors
  static handleValidationError(message: string, context: unknown): void {
    const details = typeof context === 'object' && context !== null ? context : { context };
    this.logger.warn('Validation Error', {
      message,
      ...details,
    });
  }
}

// EIDOLON-V PHASE1: Decorator for method logging
export function logMethod(level: LogLevel = LogLevel.DEBUG) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const logger = Logger.getInstance();

    descriptor.value = function (...args: any[]) {
      const startTime = Date.now();
      const className = target.constructor.name;

      logger.debug(`METHOD: ${className}.${propertyName} called`, {
        args: args.length,
        argsPreview: args
          .slice(0, 3)
          .map(arg => (typeof arg === 'object' ? '[Object]' : String(arg))),
      });

      try {
        const result = method.apply(this, args);

        if (result && typeof result.catch === 'function') {
          // Handle Promise
          return result
            .catch((error: Error) => {
              const duration = Date.now() - startTime;
              logger.error(
                `METHOD: ${className}.${propertyName} failed`,
                {
                  duration,
                  args: args.length,
                },
                error
              );
              throw error;
            })
            .then((result: any) => {
              const duration = Date.now() - startTime;
              logger.debug(`METHOD: ${className}.${propertyName} completed`, {
                duration,
                resultType: typeof result,
              });
              return result;
            });
        } else {
          const duration = Date.now() - startTime;
          logger.debug(`METHOD: ${className}.${propertyName} completed`, {
            duration,
            resultType: typeof result,
          });
          return result;
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(
          `METHOD: ${className}.${propertyName} threw error`,
          {
            duration,
            args: args.length,
          },
          error as Error
        );
        throw error;
      }
    };

    return descriptor;
  };
}

// EIDOLON-V PHASE1: Export instances
export const logger = Logger.getInstance();
export const errorHandler = ErrorHandler;
