export class Logger {
  private static instance: Logger;
  private logElement: HTMLElement | null = null;

  private constructor() {
    // 初始化时尝试获取日志元素
    this.initLogElement();
  }

  private initLogElement() {
    // 等待 DOM 加载完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.logElement = document.getElementById('logOutput');
      });
    } else {
      this.logElement = document.getElementById('logOutput');
    }
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private appendToPage(level: string, message: string, ...args: any[]) {
    if (!this.logElement) {
      this.logElement = document.getElementById('logOutput');
    }

    if (this.logElement) {
      const time = new Date().toLocaleTimeString();
      const formattedArgs = args.map(arg => {
        if (typeof arg === 'object') {
          return JSON.stringify(arg, null, 2);
        }
        return String(arg);
      }).join(' ');

      const logEntry = document.createElement('div');
      logEntry.className = `log-${level}`;
      logEntry.textContent = `[${time}] ${message} ${formattedArgs}`;
      
      this.logElement.appendChild(logEntry);
      this.logElement.scrollTop = this.logElement.scrollHeight;

      // 保持最多显示100条日志
      while (this.logElement.children.length > 100) {
        this.logElement.removeChild(this.logElement.firstChild!);
      }
    }
  }

  public debug(message: string, ...args: any[]): void {
    console.debug(message, ...args);
    this.appendToPage('debug', message, ...args);
  }

  public info(message: string, ...args: any[]): void {
    console.info(message, ...args);
    this.appendToPage('info', message, ...args);
  }

  public warn(message: string, ...args: any[]): void {
    console.warn(message, ...args);
    this.appendToPage('warn', message, ...args);
  }

  public error(message: string, ...args: any[]): void {
    console.error(message, ...args);
    this.appendToPage('error', message, ...args);
  }
} 