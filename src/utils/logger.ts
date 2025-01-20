export class Logger {
  private static instance: Logger;

  private constructor() {
    console.log('[Logger] 初始化');
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public debug(message: string, ...args: any[]): void {
    console.log(`[DEBUG] ${message}`, ...args);
  }

  public error(message: string, ...args: any[]): void {
    console.error(`[ERROR] ${message}`, ...args);
  }

  public info(message: string, ...args: any[]): void {
    console.info(`[INFO] ${message}`, ...args);
  }
} 