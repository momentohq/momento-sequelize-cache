export interface ILogger {
    info(options: Record<string, unknown>, message: string): void;
    warn(options: Record<string, unknown>, message: string): void;
    debug(options: Record<string, unknown>, message: string): void;
    error(options: Record<string, unknown>, message: string): void;
}

export interface LoggerSettings {
    logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export class LoggerFactory {
    static createLogger(settings: LoggerSettings): ILogger {
        return new SimpleLogger(settings);
    }
}

class SimpleLogger implements ILogger {
    private logLevel: number;

    constructor(settings: LoggerSettings) {
        const levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3,
        };
        this.logLevel = levels[settings.logLevel];
    }

    private log(level: string, options: Record<string, unknown>, message: string): void {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level}]: ${message} ${JSON.stringify(options)}`);
    }

    info(options: Record<string, unknown>, message: string): void {
        if (this.logLevel <= 1) {
            this.log('INFO', options, message);
        }
    }

    warn(options: Record<string, unknown>, message: string): void {
        if (this.logLevel <= 2) {
            this.log('INFO', options, message);
        }
    }


    debug(options: Record<string, unknown>, message: string): void {
        if (this.logLevel <= 0) {
            this.log('DEBUG', options, message);
        }
    }

    error(options: Record<string, unknown>, message: string): void {
        if (this.logLevel <= 3) {
            this.log('ERROR',options,  message);
        }
    }
}
