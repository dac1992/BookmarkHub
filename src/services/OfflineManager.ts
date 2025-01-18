import { BookmarkNode } from '../types/bookmark';

interface PendingOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
}

export class OfflineManager {
  private readonly storageKey = 'offline_operations';
  private isOnline = navigator.onLine;

  constructor() {
    this.setupNetworkListeners();
  }

  /**
   * 添加离线操作
   */
  async addOperation(type: PendingOperation['type'], data: any): Promise<void> {
    const operations = await this.getOperations();
    operations.push({
      id: this.generateId(),
      type,
      data,
      timestamp: Date.now()
    });
    await this.saveOperations(operations);
  }

  /**
   * 获取所有待同步的操作
   */
  async getOperations(): Promise<PendingOperation[]> {
    const result = await chrome.storage.local.get(this.storageKey);
    return result[this.storageKey] || [];
  }

  /**
   * 清除已完成的操作
   */
  async clearOperations(ids: string[]): Promise<void> {
    const operations = await this.getOperations();
    const filtered = operations.filter(op => !ids.includes(op.id));
    await this.saveOperations(filtered);
  }

  /**
   * 检查是否有待同步的操作
   */
  async hasPendingOperations(): Promise<boolean> {
    const operations = await this.getOperations();
    return operations.length > 0;
  }

  /**
   * 获取网络状态
   */
  isNetworkAvailable(): boolean {
    return this.isOnline;
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyNetworkChange('online');
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyNetworkChange('offline');
    });
  }

  private notifyNetworkChange(status: 'online' | 'offline'): void {
    chrome.runtime.sendMessage?.({
      type: 'NETWORK_STATUS_CHANGE',
      status
    }).catch(console.error);
  }

  private async saveOperations(operations: PendingOperation[]): Promise<void> {
    await chrome.storage.local.set({ [this.storageKey]: operations });
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
} 