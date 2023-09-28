import { ILogger, LoggerSettings, LoggerFactory } from './logger-factory'; // assuming all your logger related interfaces and classes are in index.ts

export class LoggerManager {
    private static logger: ILogger | null = null;

    static getLogger(): ILogger {
        if (!this.logger) {
            // Fallback to default logger settings
            const settings: LoggerSettings = { logLevel: 'info' };
            this.logger = LoggerFactory.createLogger(settings);
        }
        return this.logger;
    }

    static setLogger(logger: ILogger): void {
        this.logger = logger;
    }
}
