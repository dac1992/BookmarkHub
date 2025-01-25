import { SyncStatus } from '../types/bookmark';
import { Logger } from '../utils/logger';

export class SyncStatusService {
  private static instance: SyncStatusService;
  private readonly storageKey = 'sync_status';
  private logger: Logger;

  private constructor() {
    this.logger = Logger.getInstance();
  }

  public static getInstance(): SyncStatusService {
    if (!SyncStatusService.instance) {
      SyncStatusService.instance = new SyncStatusService();
    }
    return SyncStatusService.instance;
  }

  /**
   * 获取同步状态
   */
  async getStatus(): Promise<SyncStatus> {
    const result = await chrome.storage.local.get([this.storageKey, 'lastSyncBookmarkCount']);
    const status = result[this.storageKey] || {
      lastSync: 0,
      status: 'success'
    };

    // 添加书签数量到状态中
    if (result.lastSyncBookmarkCount !== undefined) {
      status.bookmarkCount = result.lastSyncBookmarkCount;
    }

    return status;
  }

  /**
   * 更新同步状态
   */
  async updateStatus(status: Partial<SyncStatus>): Promise<void> {
    const currentStatus = await this.getStatus();
    const newStatus = {
      ...currentStatus,
      ...status,
      lastSync: status.status ? Date.now() : currentStatus.lastSync
    };

    await chrome.storage.local.set({
      [this.storageKey]: newStatus
    });

    // 如果提供了书签数量，也更新它
    if (status.bookmarkCount !== undefined) {
      await chrome.storage.local.set({
        'lastSyncBookmarkCount': status.bookmarkCount
      });
    }
  }

  /**
   * 获取上次同步时间的友好显示
   */
  async getLastSyncText(): Promise<string> {
    const status = await this.getStatus();
    if (status.lastSync === 0) {
      return '从未同步';
    }

    const diff = Date.now() - status.lastSync;
    if (diff < 60000) { // 1分钟内
      return '刚刚';
    } else if (diff < 3600000) { // 1小时内
      return `${Math.floor(diff / 60000)}分钟前`;
    } else if (diff < 86400000) { // 1天内
      return `${Math.floor(diff / 3600000)}小时前`;
    } else {
      return new Date(status.lastSync).toLocaleString();
    }
  }

  /**
   * 获取上次同步的书签数量
   */
  async getLastSyncBookmarkCount(): Promise<number | null> {
    const result = await chrome.storage.local.get('lastSyncBookmarkCount');
    return result.lastSyncBookmarkCount || null;
  }
} 