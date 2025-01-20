export class Logger {
  private static instance: Logger;
  private debugElement: HTMLDivElement | null = null;

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setDebugElement(element: HTMLDivElement) {
    this.debugElement = element;
  }

  private log(level: string, message: string, ...args: any[]) {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
    ).join(' ');
    
    const logMessage = `[${timestamp}] [${level}] ${message} ${formattedArgs}`;
    
    if (this.debugElement) {
      const logEntry = document.createElement('div');
      logEntry.className = `log-entry log-${level.toLowerCase()}`;
      logEntry.textContent = logMessage;
      this.debugElement.appendChild(logEntry);
      this.debugElement.scrollTop = this.debugElement.scrollHeight;
    }
    
    console.log(logMessage);
  }

  public debug(message: string, ...args: any[]) {
    this.log('DEBUG', message, ...args);
  }

  public info(message: string, ...args: any[]) {
    this.log('INFO', message, ...args);
  }

  public warn(message: string, ...args: any[]) {
    this.log('WARN', message, ...args);
  }

  public error(message: string, ...args: any[]) {
    this.log('ERROR', message, ...args);
  }
} 