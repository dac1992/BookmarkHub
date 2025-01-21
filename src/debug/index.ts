import { BookmarkService } from '../services/BookmarkService';
import { GitHubService } from '../services/GitHubService';
import { Logger } from '../utils/logger';

class DebugPage {
  private static instance: DebugPage | null = null;
  private logContainer: HTMLDivElement;
  private clearButton: HTMLButtonElement;
  private testButton: HTMLButtonElement;
  private autoScrollCheckbox: HTMLInputElement;
  private testGitHubAuthButton: HTMLButtonElement;
  private clearGitHubTokenButton: HTMLButtonElement;
  private bookmarkService: BookmarkService;
  private githubService: GitHubService;
  private logger: Logger;
  private static initialized: boolean = false;
  private static consoleOverridden: boolean = false;

  private constructor() {
    this.logContainer = document.getElementById('logContainer') as HTMLDivElement;
    this.clearButton = document.getElementById('clearLogs') as HTMLButtonElement;
    this.testButton = document.getElementById('testBookmarks') as HTMLButtonElement;
    this.autoScrollCheckbox = document.getElementById('autoScroll') as HTMLInputElement;
    this.testGitHubAuthButton = document.getElementById('testGitHubAuth') as HTMLButtonElement;
    this.clearGitHubTokenButton = document.getElementById('clearGitHubToken') as HTMLButtonElement;
    
    this.bookmarkService = BookmarkService.getInstance();
    this.githubService = GitHubService.getInstance();
    this.logger = Logger.getInstance();

    if (!DebugPage.initialized) {
      this.initializeEventListeners();
      if (!DebugPage.consoleOverridden) {
        this.overrideConsole();
        DebugPage.consoleOverridden = true;
      }
      DebugPage.initialized = true;
      this.log('info', '调试页面已初始化');
    }
  }

  public static getInstance(): DebugPage {
    if (!DebugPage.instance) {
      DebugPage.instance = new DebugPage();
    }
    return DebugPage.instance;
  }

  private initializeEventListeners(): void {
    // 移除所有现有的事件监听器
    this.clearButton.replaceWith(this.clearButton.cloneNode(true));
    this.testButton.replaceWith(this.testButton.cloneNode(true));
    this.testGitHubAuthButton.replaceWith(this.testGitHubAuthButton.cloneNode(true));
    this.clearGitHubTokenButton.replaceWith(this.clearGitHubTokenButton.cloneNode(true));

    // 重新获取元素引用
    this.clearButton = document.getElementById('clearLogs') as HTMLButtonElement;
    this.testButton = document.getElementById('testBookmarks') as HTMLButtonElement;
    this.testGitHubAuthButton = document.getElementById('testGitHubAuth') as HTMLButtonElement;
    this.clearGitHubTokenButton = document.getElementById('clearGitHubToken') as HTMLButtonElement;

    // 添加新的事件监听器
    this.clearButton.addEventListener('click', () => {
      this.logContainer.innerHTML = '';
      this.log('info', '日志已清除');
    });

    this.testButton.addEventListener('click', async () => {
      this.log('info', '开始测试书签读取');
      try {
        const bookmarks = await this.bookmarkService.fetchBookmarksFromChrome();
        this.log('info', `成功读取 ${bookmarks.length} 个书签`);
        this.log('debug', '书签数据:', bookmarks);
      } catch (error) {
        this.log('error', '读取书签失败:', error);
      }
    });

    this.testGitHubAuthButton.addEventListener('click', async () => {
      this.log('info', '开始测试GitHub认证');
      try {
        await this.githubService.authenticate();
        this.log('info', 'GitHub认证成功');
      } catch (error) {
        this.log('error', 'GitHub认证失败:', error);
      }
    });

    this.clearGitHubTokenButton.addEventListener('click', async () => {
      this.log('info', '开始清除GitHub令牌');
      try {
        await this.githubService.clearToken();
        this.log('info', 'GitHub令牌已清除');
      } catch (error) {
        this.log('error', '清除GitHub令牌失败:', error);
      }
    });

    // 移除现有的书签监听器
    chrome.bookmarks.onCreated.removeListener(() => {});
    chrome.bookmarks.onRemoved.removeListener(() => {});
    chrome.bookmarks.onChanged.removeListener(() => {});

    // 添加新的书签监听器
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
      log: console.log.bind(console),
      info: console.info.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console)
    };

    const self = this;
    const logOnce = (level: 'info' | 'error' | 'debug', ...args: any[]) => {
      originalConsole[level](...args);
      // 检查是否已经记录过这条日志
      const time = new Date().toISOString();
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      const logEntry = `[${time}] ${message}`;
      
      const lastEntry = self.logContainer.lastElementChild;
      if (lastEntry && lastEntry.textContent === logEntry) {
        return; // 跳过重复的日志
      }
      
      self.log(level, ...args);
    };

    // 重写console方法
    console.log = (...args: any[]) => logOnce('info', ...args);
    console.info = (...args: any[]) => logOnce('info', ...args);
    console.error = (...args: any[]) => logOnce('error', ...args);
    console.debug = (...args: any[]) => logOnce('debug', ...args);
  }

  private log(...args: any[]): void {
    const output = document.getElementById('output');
    if (output) {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      output.textContent = `${new Date().toISOString()} ${message}\n${output.textContent}`;
    }
    this.logger.debug(args.join(' '));
  }
}

// 初始化调试页面
document.addEventListener('DOMContentLoaded', () => {
  DebugPage.getInstance();
}); 