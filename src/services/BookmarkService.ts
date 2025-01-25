import { BookmarkNode, BookmarkChange, ProgressNotification, ProgressEventType } from '../types/bookmark';
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
  private logger: Logger;

  private constructor() {
    this.logger = Logger.getInstance();
    this.initializeEventListeners();
  }

  public static getInstance(): BookmarkService {
    if (!BookmarkService.instance) {
      BookmarkService.instance = new BookmarkService();
    }
    return BookmarkService.instance;
  }

  private initializeEventListeners(): void {
    // 监听创建事件
    chrome.bookmarks.onCreated.addListener((id, bookmark) => {
      const change: BookmarkChange = {
        type: 'create',
        id,
        title: bookmark.title || '',
        url: bookmark.url,
        parentId: bookmark.parentId || '0',
        index: bookmark.index || 0
      };
      this.notifyChange(change);
    });

    // 监听更新事件
    chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
      const change: BookmarkChange = {
        type: 'update',
        id,
        title: changeInfo.title,
        url: changeInfo.url
      };
      this.notifyChange(change);
    });

    // 监听删除事件
    chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
      const change: BookmarkChange = {
        type: 'remove',
        id,
        parentId: removeInfo.parentId || '0',
        index: removeInfo.index || 0,
        title: '',  // 删除时可能无法获取原标题
        url: undefined
      };
      this.notifyChange(change);
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
      this.notifyChange(this.handleBookmarkMoved(id, moveInfo));
    });
  }

  public addChangeListener(listener: (change: BookmarkChange) => void): void {
    this.changeListeners.push(listener);
  }

  public removeChangeListener(listener: (change: BookmarkChange) => void): void {
    const index = this.changeListeners.indexOf(listener);
    if (index !== -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  private notifyChange(change: BookmarkChange): void {
    this.changeListeners.forEach(listener => listener(change));
  }

  public addProgressListener(listener: (notification: ProgressNotification) => void): void {
    this.progressListeners.push(listener);
  }

  public removeProgressListener(listener: (notification: ProgressNotification) => void): void {
    const index = this.progressListeners.indexOf(listener);
    if (index !== -1) {
      this.progressListeners.splice(index, 1);
    }
  }

  private notifyProgress(notification: ProgressNotification): void {
    this.progressListeners.forEach(listener => listener(notification));
  }

  public async getAllBookmarks(): Promise<BookmarkNode[]> {
    try {
      const treeNodes = await chrome.bookmarks.getTree();
      const bookmarks = this.convertToBookmarkNodes(treeNodes);
      return bookmarks;
    } catch (error) {
      this.logger.error('获取书签失败:', error);
      throw error;
    }
  }

  private convertToBookmarkNodes(treeNodes: chrome.bookmarks.BookmarkTreeNode[]): BookmarkNode[] {
    const allNodes: BookmarkNode[] = [];
    
    const convert = (node: chrome.bookmarks.BookmarkTreeNode): BookmarkNode | null => {
      // 跳过根节点
      if (node.id === '0') {
        if (node.children) {
          return node.children.map(child => convert(child))
            .filter((n): n is BookmarkNode => n !== null)[0];
        }
        return null;
      }

      // 跳过空的默认文件夹（"书签栏"和"其他书签"）
      if ((node.id === '1' || node.id === '2') && (!node.children || node.children.length === 0)) {
        return null;
      }

      const convertedNode: BookmarkNode = {
        id: node.id,
        parentId: node.parentId || '',
        title: node.title,
        url: node.url || '',
        dateAdded: node.dateAdded || Date.now(),
        index: node.index || 0,
        children: []
      };

      if (node.children) {
        convertedNode.children = node.children
          .map(child => convert(child))
          .filter((n): n is BookmarkNode => n !== null);
      }

      // 只有非根节点且不是空的默认文件夹才添加到结果中
      if (node.id !== '0' && (node.url || (node.children && node.children.length > 0))) {
        allNodes.push(convertedNode);
      }

      return convertedNode;
    };

    // 处理根节点
    treeNodes.forEach(node => convert(node));
    
    return allNodes;
  }

  public async updateAllBookmarks(bookmarks: BookmarkNode[]): Promise<void> {
    this.notifyProgress({
      type: ProgressEventType.START,
      message: '开始更新本地书签...'
    });

    try {
      // 获取根节点
      const [root] = await chrome.bookmarks.getTree();
      
      // 创建书签映射以检查重复
      const bookmarkMap = new Map<string, BookmarkNode>();
      const buildMap = (nodes: BookmarkNode[]) => {
        for (const node of nodes) {
          bookmarkMap.set(node.id, node);
          if (node.children) {
            buildMap(node.children);
          }
        }
      };
      buildMap(bookmarks);

      // 删除所有现有书签
      for (const child of root.children || []) {
        if (child.id !== '0') {  // 保留根节点
          await chrome.bookmarks.removeTree(child.id);
        }
      }

      // 递归创建新书签
      const createBookmarkTree = async (
        node: BookmarkNode,
        parentId: string
      ): Promise<void> => {
        try {
          if (node.url) {
            // 检查是否已存在相同URL的书签
            const existingBookmarks = await chrome.bookmarks.search({ url: node.url });
            if (existingBookmarks.length > 0) {
              this.logger.info(`跳过重复书签: ${node.title} (${node.url})`);
              return;
            }

            // 创建书签
            await chrome.bookmarks.create({
              parentId,
              title: node.title,
              url: node.url
            });
          } else {
            // 创建文件夹
            const folder = await chrome.bookmarks.create({
              parentId,
              title: node.title
            });
            
            // 递归创建子节点
            if (node.children) {
              for (const child of node.children) {
                await createBookmarkTree(child, folder.id);
              }
            }
          }
        } catch (error: any) {
          this.logger.error(`创建书签失败: ${node.title}`, error);
          throw error;
        }
      };

      // 开始创建新书签
      let progress = 0;
      const totalBookmarks = bookmarks.length;
      for (const bookmark of bookmarks) {
        await createBookmarkTree(bookmark, '0');
        progress += (1 / totalBookmarks) * 100;
        this.notifyProgress({
          type: ProgressEventType.PROGRESS,
          message: `正在更新书签... ${Math.round(progress)}%`,
          progress: Math.round(progress)
        });
      }

      this.notifyProgress({
        type: ProgressEventType.SUCCESS,
        message: '本地书签更新完成'
      });
    } catch (error: any) {
      this.notifyProgress({
        type: ProgressEventType.ERROR,
        message: `更新本地书签失败: ${error.message}`,
        error: error
      });
      throw error;
    }
  }

  public async fetchBookmarksFromChrome(): Promise<BookmarkNode[]> {
    try {
      const bookmarks = await chrome.bookmarks.getTree();
      return this.normalizeBookmarks(bookmarks);
    } catch (error) {
      this.logger.error('获取书签失败:', error);
      throw error;
    }
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
    let validBookmarkCount = 0;
    let validFolderCount = 0;
    
    const processNode = (node: chrome.bookmarks.BookmarkTreeNode): BookmarkNode | undefined => {
      // 跳过根节点，但处理其子节点
      if (node.id === '0') {
        if (node.children) {
          node.children.forEach(child => {
            const processed = processNode(child);
            if (processed) {
              result.push(processed);
            }
          });
        }
        return undefined;
      }

      // 创建新的节点对象
      const normalizedNode: BookmarkNode = {
        id: node.id,
        title: node.title,
        parentId: node.parentId || '',
        index: node.index || 0,
        dateAdded: node.dateAdded || Date.now(),
        url: node.url,
        children: []
      };

      // 统计有效书签和文件夹
      if (node.url && node.url.trim() !== '') {
        validBookmarkCount++;
      } else if (!node.url && node.id !== '0' && 
                !(node.id === '1' && (!node.children || node.children.length === 0)) && 
                !(node.id === '2' && (!node.children || node.children.length === 0))) {
        validFolderCount++;
      }

      // 处理子节点
      if (node.children) {
        normalizedNode.children = node.children
          .map(child => processNode(child))
          .filter((child): child is BookmarkNode => child !== undefined);
      }

      return normalizedNode;
    };

    // 处理根节点
    nodes.forEach(node => {
      processNode(node);
    });

    // 添加详细的调试日志
    this.logger.debug('书签统计详情:', {
      总节点数: result.length,
      有效书签数: validBookmarkCount,
      有效文件夹数: validFolderCount,
      原始数据长度: nodes.length
    });

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

  private handleBookmarkCreated(id: string, bookmark: chrome.bookmarks.BookmarkTreeNode): BookmarkChange {
      return {
          type: 'create',
          id,
          title: bookmark.title,
          url: bookmark.url || '',
          parentId: bookmark.parentId || '0',
          index: bookmark.index || 0
      };
  }

  private handleBookmarkChanged(id: string, changeInfo: chrome.bookmarks.BookmarkChangeInfo): BookmarkChange {
      return {
          type: 'update',
          id,
          title: changeInfo.title || '',
          url: changeInfo.url || ''
      };
  }

  private handleBookmarkRemoved(id: string, removeInfo: chrome.bookmarks.BookmarkRemoveInfo): BookmarkChange {
      return {
          type: 'remove',
          id,
          parentId: removeInfo.parentId || '0',
          index: removeInfo.index || 0,
          title: '',  // 删除时可能无法获取原标题
          url: undefined
      };
  }

  private handleBookmarkMoved(id: string, moveInfo: chrome.bookmarks.BookmarkMoveInfo): BookmarkChange {
      return {
          type: 'move',
          id,
          oldParentId: moveInfo.oldParentId || '0',
          oldIndex: moveInfo.oldIndex || 0,
          newParentId: moveInfo.parentId || '0',
          newIndex: moveInfo.index || 0
      };
  }

  public async getBookmarkStats(): Promise<{ bookmarkCount: number; folderCount: number }> {
    // 获取完整的书签树
    const bookmarkTree = await chrome.bookmarks.getTree();
    let bookmarkCount = 0;
    let folderCount = 0;

    const countNodes = (nodes: BookmarkNode[]) => {
      for (const node of nodes) {
        // 只统计有URL的节点作为书签
        if (node.url && node.url.trim() !== '') {
          bookmarkCount++;
        } 
        // 统计文件夹（排除根文件夹和空的默认文件夹）
        else if (!node.url && node.id !== '0' && 
                !(node.id === '1' && (!node.children || node.children.length === 0)) && 
                !(node.id === '2' && (!node.children || node.children.length === 0))) {
          folderCount++;
        }

        // 递归处理子节点
        if (node.children && node.children.length > 0) {
          countNodes(node.children);
        }
      }
    };

    // 使用 normalizeBookmarks 处理书签树
    const normalizedTree = this.normalizeBookmarks(bookmarkTree);
    countNodes(normalizedTree);

    // 添加调试日志
    this.logger.debug('getBookmarkStats统计:', {
      书签数: bookmarkCount,
      文件夹数: folderCount,
      总节点数: normalizedTree.length
    });

    return { bookmarkCount, folderCount };
  }
}

export default BookmarkService; 