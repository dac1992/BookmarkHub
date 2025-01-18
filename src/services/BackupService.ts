import { BookmarkNode, ChromeBookmarkNode, convertToBookmarkNode } from '../types/bookmark';
import { ErrorLog } from '../types/error';

interface BackupData {
  version: string;
  timestamp: number;
  bookmarks: BookmarkNode[];
  errorLogs: ErrorLog[];
  settings: any;
}

export class BackupService {
  private readonly VERSION = '1.0.0';

  /**
   * 创建备份
   */
  async createBackup(): Promise<string> {
    const backup: BackupData = {
      version: this.VERSION,
      timestamp: Date.now(),
      bookmarks: await this.getBookmarks(),
      errorLogs: await this.getErrorLogs(),
      settings: await this.getSettings()
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json'
    });

    return URL.createObjectURL(blob);
  }

  /**
   * 恢复备份
   */
  async restoreBackup(file: File): Promise<void> {
    try {
      const content = await this.readFile(file);
      const backup = JSON.parse(content) as BackupData;

      // 验证备份文件格式
      if (!this.isValidBackup(backup)) {
        throw new Error('无效的备份文件格式');
      }

      // 恢复数据
      await Promise.all([
        this.restoreBookmarks(backup.bookmarks),
        this.restoreErrorLogs(backup.errorLogs),
        this.restoreSettings(backup.settings)
      ]);
    } catch (error) {
      console.error('恢复备份失败:', error);
      throw new Error('恢复备份失败，请检查文件格式是否正确');
    }
  }

  private async getBookmarks(): Promise<BookmarkNode[]> {
    return new Promise((resolve) => {
      chrome.bookmarks.getTree((results) => {
        const converted = results.map(node => 
          convertToBookmarkNode(node as ChromeBookmarkNode)
        );
        resolve(converted);
      });
    });
  }

  private async getErrorLogs(): Promise<ErrorLog[]> {
    const result = await chrome.storage.local.get('error_logs');
    return result.error_logs || [];
  }

  private async getSettings(): Promise<any> {
    const result = await chrome.storage.local.get('settings');
    return result.settings || {};
  }

  private async restoreBookmarks(bookmarks: BookmarkNode[]): Promise<void> {
    // 清除现有书签
    const existing = await this.getBookmarks();
    for (const node of existing) {
      if (node.id) {
        await chrome.bookmarks.remove(node.id);
      }
    }

    // 恢复备份的书签
    for (const node of bookmarks) {
      await this.createBookmarkNode(node);
    }
  }

  private async createBookmarkNode(node: BookmarkNode, parentId?: string): Promise<void> {
    const createInfo: chrome.bookmarks.BookmarkCreateArg = {
      parentId,
      title: node.title,
      url: node.url,
      index: node.index
    };

    const created = await chrome.bookmarks.create(createInfo);

    if (node.children?.length) {
      for (const child of node.children) {
        await this.createBookmarkNode(child, created.id);
      }
    }
  }

  private async restoreErrorLogs(logs: ErrorLog[]): Promise<void> {
    await chrome.storage.local.set({ error_logs: logs });
  }

  private async restoreSettings(settings: any): Promise<void> {
    await chrome.storage.local.set({ settings });
  }

  private async readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  private isValidBackup(data: any): data is BackupData {
    return (
      typeof data === 'object' &&
      typeof data.version === 'string' &&
      typeof data.timestamp === 'number' &&
      Array.isArray(data.bookmarks) &&
      Array.isArray(data.errorLogs) &&
      typeof data.settings === 'object'
    );
  }
} 