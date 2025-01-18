import { SyncStatus } from '../types/bookmark';

export class SyncStatusService {
  private readonly storageKey = 'sync_status';

  /**
   * 获取同步状态
   */
  async getStatus(): Promise<SyncStatus> {
    const result = await chrome.storage.local.get(this.storageKey);
    return result[this.storageKey] || {
      lastSync: 0,
      status: 'success'
    };
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
} 