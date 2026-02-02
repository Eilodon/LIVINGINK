/**
 * Client Logger - Structured logging for client-side
 * EIDOLON-V: Centralized logging with dev/prod modes
 */

const IS_DEV = import.meta.env?.DEV ?? process.env.NODE_ENV !== 'production';

export interface LogContext {
    [key: string]: unknown;
}

class ClientLogger {
    private prefix = '[CJR]';

    info(message: string, context?: LogContext): void {
        if (IS_DEV) {
            console.log(`${this.prefix} ${message}`, context ?? '');
        }
    }

    warn(message: string, context?: LogContext): void {
        console.warn(`${this.prefix} ${message}`, context ?? '');
    }

    error(message: string, context?: LogContext, error?: Error): void {
        console.error(`${this.prefix} ${message}`, context ?? '', error ?? '');
    }

    debug(message: string, context?: LogContext): void {
        if (IS_DEV) {
            console.debug(`${this.prefix} ${message}`, context ?? '');
        }
    }
}

export const clientLogger = new ClientLogger();
