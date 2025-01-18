import { SyncError } from '../utils/ErrorHandler';
import { ErrorLog } from '../types/error';

export class ErrorLogService {
  private readonly storageKey = 'error_logs';
  private readonly maxLogs = 100;

  /**
   * 记录错误
   */
  async logError(error: unknown, context: string): Promise<string> {
    const logs = await this.getLogs();
    const errorLog: ErrorLog = {
      id: this.generateId(),
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      context,
      timestamp: Date.now(),
      stack: error instanceof Error ? error.stack : undefined,
      details: error instanceof SyncError ? error.details : undefined
    };

    // 添加新日志并保持最大数量限制
    logs.unshift(errorLog);
    if (logs.length > this.maxLogs) {
      logs.length = this.maxLogs;
    }

    await this.saveLogs(logs);
    return errorLog.id;
  }

  /**
   * 获取所有错误日志
   */
  async getLogs(): Promise<ErrorLog[]> {
    const result = await chrome.storage.local.get(this.storageKey);
    return result[this.storageKey] || [];
  }

  /**
   * 获取单个错误日志
   */
  async getLog(id: string): Promise<ErrorLog | null> {
    const logs = await this.getLogs();
    return logs.find(log => log.id === id) || null;
  }

  /**
   * 清除所有错误日志
   */
  async clearLogs(): Promise<void> {
    await chrome.storage.local.set({ [this.storageKey]: [] });
  }

  /**
   * 删除单个错误日志
   */
  async deleteLog(id: string): Promise<void> {
    const logs = await this.getLogs();
    const index = logs.findIndex(log => log.id === id);
    if (index !== -1) {
      logs.splice(index, 1);
      await this.saveLogs(logs);
    }
  }

  private async saveLogs(logs: ErrorLog[]): Promise<void> {
    await chrome.storage.local.set({ [this.storageKey]: logs });
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
} 