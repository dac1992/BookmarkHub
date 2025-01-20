import { BookmarkNode, BookmarkChange, BookmarkOperationType, ProgressNotification, ProgressEventType } from '../types/bookmark';
import { Logger } from '../utils/logger';

const logger = Logger.getInstance();

interface BookmarkCache {
  data: BookmarkNode[];
  timestamp: number;
  version: string;
}

export class BookmarkService {
  private static instance: BookmarkService;
  private changeListeners: ((change: BookmarkChange) => void)[] = [];
  private progressListeners: ((notification: ProgressNotification) => void)[] = [];
  private readonly CACHE_KEY = 'bookmark_cache';
  private readonly CACHE_VERSION = '1.0.0';
  private readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24小时

  private constructor() {
    logger.debug('BookmarkService: 构造函数开始');
    this.initializeEventListeners();
    logger.debug('BookmarkService: 构造函数完成');
  }

  public static getInstance(): BookmarkService {
    logger.debug('BookmarkService: 获取实例');
    if (!BookmarkService.instance) {
      BookmarkService.instance = new BookmarkService();
    }
    return BookmarkService.instance;
  }

  private initializeEventListeners(): void {
    logger.debug('BookmarkService: 初始化事件监听器');
    // 监听创建事件
    chrome.bookmarks.onCreated.addListener((id, bookmark) => {
      logger.debug('BookmarkService: 书签创建', id, bookmark);
      const node = this.normalizeNode(bookmark);
      this.notifyChange({
        type: BookmarkOperationType.CREATE,
        timestamp: Date.now(),
        node
      });
    });

    // 监听更新事件
    chrome.bookmarks.onChanged.addListener(async (id, changeInfo) => {
      logger.debug('BookmarkService: 书签更新', id, changeInfo);
      const [bookmark] = await chrome.bookmarks.get(id);
      const node = this.normalizeNode(bookmark);
      this.notifyChange({
        type: BookmarkOperationType.UPDATE,
        timestamp: Date.now(),
        node
      });
    });

    // 监听删除事件
    chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
      logger.debug('BookmarkService: 书签删除', id, removeInfo);
      const node: BookmarkNode = {
        id,
        parentId: removeInfo.parentId,
        title: removeInfo.node.title,
        url: removeInfo.node.url,
        dateAdded: removeInfo.node.dateAdded || Date.now(),
        index: removeInfo.node.index || 0
      };
      this.notifyChange({
        type: BookmarkOperationType.DELETE,
        timestamp: Date.now(),
        node
      });
    });

    // 监听移动事件
    chrome.bookmarks.onMoved.addListener(async (id, moveInfo) => {
      logger.debug('BookmarkService: 书签移动', id, moveInfo);
      const [bookmark] = await chrome.bookmarks.get(id);
      const node = this.normalizeNode(bookmark);
      const oldNode: BookmarkNode = {
        ...node,
        parentId: moveInfo.oldParentId,
        index: moveInfo.oldIndex
      };
      this.notifyChange({
        type: BookmarkOperationType.MOVE,
        timestamp: Date.now(),
        node,
        oldNode
      });
    });
  }

  public addChangeListener(listener: (change: BookmarkChange) => void): void {
    logger.debug('BookmarkService: 添加变更监听器');
    this.changeListeners.push(listener);
  }

  public removeChangeListener(listener: (change: BookmarkChange) => void): void {
    logger.debug('BookmarkService: 移除变更监听器');
    const index = this.changeListeners.indexOf(listener);
    if (index > -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  private async notifyChange(change: BookmarkChange): Promise<void> {
    logger.debug('BookmarkService: 通知变更', change);
    this.changeListeners.forEach(listener => {
      try {
        listener(change);
      } catch (error) {
        logger.error('BookmarkService: 书签变更监听器执行失败:', error);
      }
    });

    // 更新缓存
    await this.updateCache(change);
  }

  public addProgressListener(listener: (notification: ProgressNotification) => void): void {
    logger.debug('BookmarkService: 添加进度监听器');
    this.progressListeners.push(listener);
  }

  public removeProgressListener(listener: (notification: ProgressNotification) => void): void {
    logger.debug('BookmarkService: 移除进度监听器');
    const index = this.progressListeners.indexOf(listener);
    if (index > -1) {
      this.progressListeners.splice(index, 1);
    }
  }

  private notifyProgress(notification: ProgressNotification): void {
    logger.debug('BookmarkService: 通知进度', notification);
    this.progressListeners.forEach(listener => {
      try {
        listener(notification);
      } catch (error) {
        logger.error('BookmarkService: 进度监听器执行失败:', error);
      }
    });
  }

  public async getAllBookmarks(): Promise<BookmarkNode[]> {
    logger.debug('BookmarkService: 开始获取所有书签');
    try {
      this.notifyProgress({
        type: ProgressEventType.LOADING,
        message: '正在加载书签数据...'
      });

      // 从Chrome API获取
      logger.debug('BookmarkService: 从浏览器获取书签');
      const bookmarks = await this.fetchBookmarksFromChrome();
      logger.debug('BookmarkService: 获取到书签数据', bookmarks);

      this.notifyProgress({
        type: ProgressEventType.COMPLETE,
        message: '书签数据加载完成'
      });
      return bookmarks;
    } catch (error) {
      logger.error('BookmarkService: 获取书签失败:', error);
      this.notifyProgress({
        type: ProgressEventType.ERROR,
        message: '加载书签失败',
        error: error instanceof Error ? error : new Error(String(error))
      });
      throw error;
    }
  }

  private async fetchBookmarksFromChrome(): Promise<BookmarkNode[]> {
    logger.debug('BookmarkService: 从Chrome API获取书签');
    return new Promise((resolve, reject) => {
      chrome.bookmarks.getTree((results) => {
        if (chrome.runtime.lastError) {
          logger.error('BookmarkService: Chrome API错误:', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          logger.debug('BookmarkService: Chrome API返回结果', results);
          const bookmarks = this.normalizeBookmarks(results);
          logger.debug('BookmarkService: 标准化后的书签数据', bookmarks);
          resolve(bookmarks);
        }
      });
    });
  }

  private normalizeNode(node: chrome.bookmarks.BookmarkTreeNode): BookmarkNode {
    return {
      id: node.id,
      parentId: node.parentId || '',
      title: node.title,
      url: node.url || '',
      dateAdded: node.dateAdded || Date.now(),
      index: node.index || 0
    };
  }

  private normalizeBookmarks(nodes: chrome.bookmarks.BookmarkTreeNode[]): BookmarkNode[] {
    const result: BookmarkNode[] = [];
    const processNode = (node: chrome.bookmarks.BookmarkTreeNode) => {
      result.push(this.normalizeNode(node));
      if (node.children) {
        node.children.forEach(processNode);
      }
    };
    nodes.forEach(processNode);
    return result;
  }

  private async updateCache(change: BookmarkChange): Promise<void> {
    logger.debug('BookmarkService: 更新缓存', change);
    try {
      const bookmarks = await this.getAllBookmarks();
      await this.saveToCache(bookmarks);
    } catch (error) {
      logger.error('BookmarkService: 更新缓存失败:', error);
    }
  }

  private async saveToCache(bookmarks: BookmarkNode[]): Promise<void> {
    logger.debug('BookmarkService: 保存到缓存', bookmarks.length);
    try {
      const cache: BookmarkCache = {
        data: bookmarks,
        timestamp: Date.now(),
        version: this.CACHE_VERSION
      };
      await chrome.storage.local.set({ [this.CACHE_KEY]: cache });
      logger.debug('BookmarkService: 缓存保存成功');
    } catch (error) {
      logger.error('BookmarkService: 保存缓存失败:', error);
      throw error;
    }
  }

  private async clearCache(): Promise<void> {
    logger.debug('BookmarkService: 清除缓存');
    try {
      await chrome.storage.local.remove(this.CACHE_KEY);
      logger.debug('BookmarkService: 缓存清除成功');
    } catch (error) {
      logger.error('BookmarkService: 清除缓存失败:', error);
      throw error;
    }
  }
}

export default BookmarkService; 