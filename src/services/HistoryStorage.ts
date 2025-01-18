import { BookmarkOperation } from '../types/bookmark';

export class HistoryStorage {
  private readonly storageKey = 'bookmark_history';

  /**
   * 获取历史记录
   */
  async getHistory(): Promise<BookmarkOperation[]> {
    const result = await chrome.storage.local.get(this.storageKey);
    return result[this.storageKey] || [];
  }

  /**
   * 保存历史记录
   */
  async saveHistory(operations: BookmarkOperation[]): Promise<void> {
    await chrome.storage.local.set({
      [this.storageKey]: operations
    });
  }
} 