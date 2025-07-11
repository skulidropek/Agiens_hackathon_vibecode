import util from 'util';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export type LogArgument = string | number | boolean | Error | object | null | undefined;

export class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  private formatMessage(level: string, message: string, ...args: LogArgument[]): string {
    const timestamp = new Date().toISOString();
    const formattedMessage = args.length > 0 
      ? util.format(message, ...args) 
      : message;
    
    return `[${timestamp}] [${level}] ${formattedMessage}`;
  }

  private getColorCode(level: string): string {
    switch (level) {
      case 'ERROR': return '\x1b[31m'; // Red
      case 'WARN': return '\x1b[33m';  // Yellow
      case 'INFO': return '\x1b[36m';  // Cyan
      case 'DEBUG': return '\x1b[35m'; // Magenta
      default: return '\x1b[0m';       // Reset
    }
  }

  private log(level: LogLevel, levelName: string, message: string, ...args: LogArgument[]): void {
    if (level > this.level) return;

    const formattedMessage = this.formatMessage(levelName, message, ...args);
    const colorCode = this.getColorCode(levelName);
    const resetCode = '\x1b[0m';

    console.log(`${colorCode}${formattedMessage}${resetCode}`);
  }

  public error(message: string, ...args: LogArgument[]): void {
    this.log(LogLevel.ERROR, 'ERROR', message, ...args);
  }

  public warn(message: string, ...args: LogArgument[]): void {
    this.log(LogLevel.WARN, 'WARN', message, ...args);
  }

  public info(message: string, ...args: LogArgument[]): void {
    this.log(LogLevel.INFO, 'INFO', message, ...args);
  }

  public debug(message: string, ...args: LogArgument[]): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, ...args);
  }

  public setLevel(level: LogLevel): void {
    this.level = level;
  }
}

// Создаем глобальный экземпляр логгера
const logLevelMap: { [key: string]: LogLevel } = {
  error: LogLevel.ERROR,
  warn: LogLevel.WARN,
  info: LogLevel.INFO,
  debug: LogLevel.DEBUG,
};

const envLogLevel = process.env.LOG_LEVEL?.toLowerCase() || 'info';
const logLevel = logLevelMap[envLogLevel] || LogLevel.INFO;

export const logger = new Logger(logLevel); 