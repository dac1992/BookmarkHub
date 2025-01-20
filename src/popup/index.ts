import { BookmarkService } from '../services/BookmarkService';
import { ProgressEventType, BookmarkChange } from '../types/bookmark';
import { Logger } from '../utils/logger';
import './styles/popup.css';

const logger = Logger.getInstance();
logger.info('Popup页面加载');

class PopupApp {
  private bookmarkService: BookmarkService;
  private statusElement!: HTMLDivElement;
  private progressElement!: HTMLDivElement;
  private messageElement!: HTMLDivElement;
  private testButton!: HTMLButtonElement;

  constructor() {
    logger.info('初始化PopupApp');
    this.bookmarkService = BookmarkService.getInstance();
    this.initializeUI();
    this.setupEventListeners();
  }

  private initializeUI(): void {
    // 获取已有的HTML元素
    this.statusElement = document.querySelector('.status') as HTMLDivElement;
    this.progressElement = document.querySelector('.progress') as HTMLDivElement;
    this.messageElement = document.querySelector('.message') as HTMLDivElement;
    this.testButton = document.querySelector('.test-button') as HTMLButtonElement;

    if (!this.statusElement || !this.progressElement || !this.messageElement || !this.testButton) {
      logger.error('无法找到必要的UI元素');
      return;
    }

    // 设置初始状态
    this.updateStatus('准备就绪');
    this.updateProgress(0);
    this.updateMessage('-');

    // 添加按钮点击事件
    this.testButton.addEventListener('click', () => {
      logger.info('点击测试按钮');
      this.loadBookmarks();
    });
  }

  private setupEventListeners(): void {
    // 监听进度事件
    this.bookmarkService.addProgressListener((notification) => {
      logger.info('收到进度通知', notification);
      switch (notification.type) {
        case 'loading':
          this.updateStatus('开始加载书签');
          this.updateProgress(0);
          break;
        case 'processing':
          this.updateStatus('正在加载书签');
          this.updateProgress(notification.progress || 0);
          break;
        case 'complete':
          this.updateStatus('加载完成');
          this.updateProgress(100);
          break;
        case 'error':
          this.updateStatus('加载失败');
          this.updateMessage(notification.error?.toString() || '未知错误');
          break;
      }
    });

    // 监听书签变化
    chrome.bookmarks.onCreated.addListener((id, bookmark) => {
      logger.info('书签创建', id, bookmark);
      this.updateMessage(`新建书签: ${bookmark.title}`);
    });

    chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
      logger.info('书签删除', id, removeInfo);
      this.updateMessage(`删除书签: ${removeInfo.node.title}`);
    });

    chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
      logger.info('书签修改', id, changeInfo);
      this.updateMessage(`修改书签: ${changeInfo.title}`);
    });
  }

  private async loadBookmarks(): Promise<void> {
    try {
      this.testButton.disabled = true;
      const bookmarks = await this.bookmarkService.getAllBookmarks();
      logger.info('书签加载成功', bookmarks);
      this.updateMessage(`成功加载 ${bookmarks.length} 个书签`);
    } catch (error) {
      logger.error('书签加载失败:', error);
      this.updateStatus('加载失败');
      this.updateMessage(error instanceof Error ? error.message : '未知错误');
    } finally {
      this.testButton.disabled = false;
    }
  }

  private updateStatus(status: string): void {
    this.statusElement.textContent = `状态: ${status}`;
  }

  private updateProgress(progress: number): void {
    this.progressElement.textContent = `进度: ${progress}%`;
    this.progressElement.setAttribute('aria-valuenow', progress.toString());
  }

  private updateMessage(message: string): void {
    this.messageElement.textContent = `消息: ${message}`;
  }
}

// 等待 DOM 加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
  logger.info('DOM加载完成');
  new PopupApp();
}); 