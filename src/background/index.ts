import { BookmarkService } from '../services/BookmarkService';
import { GitService } from '../services/GitService';
import { HistoryManager } from '../services/HistoryManager';
import { RollbackManager } from '../services/RollbackManager';
import { BookmarkOperation } from '../types/bookmark';

class BackgroundService {
  private bookmarkService: BookmarkService;
  private gitService: GitService;
  private historyManager: HistoryManager;

  constructor() {
    this.historyManager = new HistoryManager();
    this.bookmarkService = new BookmarkService();
    this.gitService = new GitService({
      platform: 'gitee',
      token: '', // 从配置中读取
      owner: 'dchub',
      repo: 'sync-tags',
      branch: 'main'
    }, 'your-encryption-key');
  }

  /**
   * 初始化后台服务
   */
  async init(): Promise<void> {
    this.setupEventListeners();
    await this.startAutoSync();
  }

  /**
   * 设置事件监听
   */
  private setupEventListeners(): void {
    chrome.bookmarks.onCreated.addListener(this.handleBookmarkCreated.bind(this));
    chrome.bookmarks.onRemoved.addListener(this.handleBookmarkRemoved.bind(this));
    chrome.bookmarks.onChanged.addListener(this.handleBookmarkChanged.bind(this));
  }

  /**
   * 处理书签创建事件
   */
  private async handleBookmarkCreated(id: string, bookmark: chrome.bookmarks.BookmarkTreeNode): Promise<void> {
    try {
      await this.historyManager.recordOperation({
        type: 'create',
        timestamp: Date.now(),
        bookmark: {
          id,
          title: bookmark.title,
          url: bookmark.url,
          parentId: bookmark.parentId,
          index: bookmark.index || 0,
          dateAdded: bookmark.dateAdded || Date.now()
        }
      });
    } catch (error) {
      console.error('记录创建操作失败:', error);
    }
  }

  /**
   * 处理书签删除事件
   */
  private async handleBookmarkRemoved(id: string, removeInfo: {parentId: string, index: number, node: chrome.bookmarks.BookmarkTreeNode}): Promise<void> {
    const operation: BookmarkOperation = {
      type: 'delete',
      timestamp: Date.now(),
      bookmark: {
        id,
        title: removeInfo.node.title,
        url: removeInfo.node.url,
        parentId: removeInfo.parentId,
        dateAdded: removeInfo.node.dateAdded || Date.now(),
        index: removeInfo.index
      }
    };

    await this.historyManager.recordOperation(operation);
    await this.syncBookmarks();
  }

  /**
   * 处理书签更改事件
   */
  private async handleBookmarkChanged(id: string, changeInfo: {title: string, url?: string}): Promise<void> {
    const operation: BookmarkOperation = {
      type: 'update',
      timestamp: Date.now(),
      bookmark: {
        id,
        title: changeInfo.title,
        url: changeInfo.url,
        dateModified: Date.now(),
        index: 0 // 需要获取实际的索引
      }
    };

    await this.historyManager.recordOperation(operation);
    await this.syncBookmarks();
  }

  /**
   * 同步书签
   */
  private async syncBookmarks(): Promise<void> {
    try {
      const bookmarks = await this.bookmarkService.getAllBookmarks();
      await this.gitService.uploadBookmarks(bookmarks);
    } catch (error) {
      console.error('同步书签失败:', error);
      // 记录错误到历史记录
      await this.historyManager.recordOperation({
        type: 'error',
        timestamp: Date.now(),
        bookmark: {
          id: 'sync-error',
          title: '同步失败',
          dateAdded: Date.now(),
          index: 0
        },
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 启动自动同步
   */
  private async startAutoSync(): Promise<void> {
    // 每5分钟同步一次
    setInterval(async () => {
      await this.syncBookmarks();
    }, 5 * 60 * 1000);
  }
}

// 初始化后台服务
const backgroundService = new BackgroundService();
backgroundService.init().catch(console.error); 