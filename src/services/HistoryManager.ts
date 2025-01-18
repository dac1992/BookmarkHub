import { HistoryEntry, HistoryState } from '../types/history';
import { BookmarkOperation } from '../types/bookmark';

export class HistoryManager {
  private readonly storageKey = 'history_state';
  private readonly defaultState: HistoryState = {
    entries: [],
    lastSync: 0,
    maxEntries: 100
  };

  /**
   * 记录操作历史
   */
  async recordOperation(operation: BookmarkOperation): Promise<string> {
    const state = await this.getState();
    const entry: HistoryEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      operation,
      status: 'success'
    };

    state.entries.unshift(entry);
    
    // 保持最大条目限制
    if (state.entries.length > state.maxEntries) {
      state.entries.length = state.maxEntries;
    }

    await this.saveState(state);
    return entry.id;
  }

  /**
   * 获取历史记录
   */
  async getHistory(limit?: number): Promise<HistoryEntry[]> {
    const state = await this.getState();
    return limit ? state.entries.slice(0, limit) : state.entries;
  }

  /**
   * 获取单个历史记录
   */
  async getEntry(id: string): Promise<HistoryEntry | null> {
    const state = await this.getState();
    return state.entries.find(entry => entry.id === id) || null;
  }

  /**
   * 更新历史记录状态
   */
  async updateEntryStatus(
    id: string,
    status: HistoryEntry['status'],
    error?: string
  ): Promise<void> {
    const state = await this.getState();
    const entry = state.entries.find(e => e.id === id);
    
    if (entry) {
      entry.status = status;
      if (error) entry.error = error;
      await this.saveState(state);
    }
  }

  /**
   * 清除历史记录
   */
  async clearHistory(): Promise<void> {
    const state = await this.getState();
    state.entries = [];
    await this.saveState(state);
  }

  /**
   * 获取最后同步时间
   */
  async getLastSyncTime(): Promise<number> {
    const state = await this.getState();
    return state.lastSync;
  }

  /**
   * 更新最后同步时间
   */
  async updateLastSyncTime(timestamp: number): Promise<void> {
    const state = await this.getState();
    state.lastSync = timestamp;
    await this.saveState(state);
  }

  private async getState(): Promise<HistoryState> {
    const result = await chrome.storage.local.get(this.storageKey);
    return result[this.storageKey] || this.defaultState;
  }

  private async saveState(state: HistoryState): Promise<void> {
    await chrome.storage.local.set({ [this.storageKey]: state });
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
} 