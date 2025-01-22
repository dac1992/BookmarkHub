import { BookmarkService } from '../services/BookmarkService';
import { BookmarkNode } from '../types/bookmark';
import { Logger } from '../utils/logger';

export class PopupPage {
  private bookmarkService: BookmarkService;
  private logger: Logger;

  constructor() {
    this.bookmarkService = BookmarkService.getInstance();
    this.logger = Logger.getInstance();
    this.initializeUI();
  }

  private async initializeUI(): Promise<void> {
    try {
      const bookmarks = await this.bookmarkService.getAllBookmarks();
      this.updateBookmarkCount(bookmarks);
    } catch (error) {
      this.logger.error('初始化UI失败:', error);
    }
  }

  private updateBookmarkCount(bookmarks: BookmarkNode[]): void {
    // 递归计算书签数量
    const countBookmarks = (nodes: BookmarkNode[]): { total: number; folders: number; bookmarks: number } => {
      let total = 0;
      let folders = 0;
      let bookmarks = 0;

      const processNode = (node: BookmarkNode) => {
        if (node.url) {
          bookmarks++;
        } else {
          folders++;
          node.children?.forEach(processNode);
        }
        total++;
      };

      nodes.forEach(processNode);
      return { total, folders, bookmarks };
    };

    const stats = countBookmarks(bookmarks);

    const countElement = document.getElementById('bookmarkCount');
    if (countElement) {
      countElement.textContent = String(stats.bookmarks);
    }

    // 更新其他统计信息显示
    const totalElement = document.getElementById('totalCount');
    const foldersElement = document.getElementById('folderCount');
    
    if (totalElement) {
      totalElement.textContent = String(stats.total);
    }
    if (foldersElement) {
      foldersElement.textContent = String(stats.folders);
    }
  }

  private async startSync(): Promise<void> {
    // 实现同步逻辑
  }

  private handleError(error: unknown): void {
    if (error instanceof Error) {
      console.error('同步失败:', error.message);
    } else {
      console.error('同步失败:', String(error));
    }
  }

  public async handleSync(): Promise<void> {
    try {
      await this.startSync();
      await this.updateBookmarkCount(await this.bookmarkService.getAllBookmarks()); // 同步完成后更新书签数量
    } catch (error) {
      this.handleError(error);
    }
  }
} 