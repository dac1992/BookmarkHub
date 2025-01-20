import { BookmarkService } from '../services/BookmarkService';

class DebugPage {
  private logContainer: HTMLDivElement;
  private clearButton: HTMLButtonElement;
  private testButton: HTMLButtonElement;
  private autoScrollCheckbox: HTMLInputElement;
  private bookmarkService: BookmarkService;

  constructor() {
    this.logContainer = document.getElementById('logContainer') as HTMLDivElement;
    this.clearButton = document.getElementById('clearLogs') as HTMLButtonElement;
    this.testButton = document.getElementById('testBookmarks') as HTMLButtonElement;
    this.autoScrollCheckbox = document.getElementById('autoScroll') as HTMLInputElement;
    this.bookmarkService = BookmarkService.getInstance();

    this.initializeEventListeners();
    this.overrideConsole();
    this.log('info', '调试页面已初始化');
  }

  private initializeEventListeners(): void {
    this.clearButton.addEventListener('click', () => {
      this.logContainer.innerHTML = '';
      this.log('info', '日志已清除');
    });

    this.testButton.addEventListener('click', async () => {
      this.log('info', '开始测试书签读取');
      try {
        const bookmarks = await this.bookmarkService.getAllBookmarks();
        this.log('info', `成功读取 ${bookmarks.length} 个书签`);
        this.log('debug', '书签数据:', bookmarks);
      } catch (error) {
        this.log('error', '读取书签失败:', error);
      }
    });

    // 监听书签变化
    chrome.bookmarks.onCreated.addListener((id, bookmark) => {
      this.log('info', '书签创建:', { id, bookmark });
    });

    chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
      this.log('info', '书签删除:', { id, removeInfo });
    });

    chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
      this.log('info', '书签修改:', { id, changeInfo });
    });
  }

  private overrideConsole(): void {
    const originalConsole = {
      log: console.log,
      info: console.info,
      error: console.error,
      debug: console.debug
    };

    // 重写console方法
    console.log = (...args) => {
      originalConsole.log.apply(console, args);
      this.log('info', ...args);
    };

    console.info = (...args) => {
      originalConsole.info.apply(console, args);
      this.log('info', ...args);
    };

    console.error = (...args) => {
      originalConsole.error.apply(console, args);
      this.log('error', ...args);
    };

    console.debug = (...args) => {
      originalConsole.debug.apply(console, args);
      this.log('debug', ...args);
    };
  }

  private log(level: 'info' | 'error' | 'debug', ...args: any[]): void {
    const entry = document.createElement('div');
    entry.className = `log-entry ${level}`;
    
    const time = new Date().toISOString();
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');

    entry.textContent = `[${time}] ${message}`;
    this.logContainer.appendChild(entry);

    if (this.autoScrollCheckbox.checked) {
      this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }
  }
}

// 初始化调试页面
document.addEventListener('DOMContentLoaded', () => {
  new DebugPage();
}); 