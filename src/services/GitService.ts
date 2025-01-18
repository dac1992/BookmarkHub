import { GitConfig, BookmarkNode } from '../types/bookmark';
import { EncryptionService } from './EncryptionService';
import { EnhancedRetryManager } from '../utils/EnhancedRetryManager';
import { Toast } from '../components/Toast';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SyncStatusService } from './SyncStatusService';
import { ErrorHandler, NetworkError, AuthError, SyncError } from '../utils/ErrorHandler';
import { OfflineManager } from './OfflineManager';
import { Buffer } from 'buffer';
import { RetryContext, RetryConfig, RetryHooks } from '../types/retry';

export class GitService {
  private encryptionService: EncryptionService;
  private retryManager: EnhancedRetryManager;
  private loading: LoadingSpinner;
  private toast: Toast;
  private syncStatusService: SyncStatusService;
  private errorHandler: ErrorHandler;
  private offlineManager: OfflineManager;

  constructor(
    private config: GitConfig,
    encryptionKey: string
  ) {
    this.encryptionService = new EncryptionService(encryptionKey);
    this.retryManager = new EnhancedRetryManager({
      maxAttempts: 5,
      useJitter: true
    } as RetryConfig, {
      onRetry: (context: RetryContext) => {
        this.loading.updateMessage(
          `同步失败，正在重试(${context.attempt}/5)...`
        );
        console.error('同步失败，准备重试:', context);
      }
    } as RetryHooks);
    this.loading = new LoadingSpinner();
    this.toast = new Toast();
    this.syncStatusService = new SyncStatusService();
    this.errorHandler = new ErrorHandler();
    this.offlineManager = new OfflineManager();
  }

  /**
   * 上传书签数据
   */
  async uploadBookmarks(bookmarks: BookmarkNode[]): Promise<void> {
    // 检查网络状态
    if (!this.offlineManager.isNetworkAvailable()) {
      await this.handleOfflineOperation('update', bookmarks);
      return;
    }

    this.loading.show();
    await this.syncStatusService.updateStatus({ status: 'syncing' });

    try {
      await this.retryManager.execute(async () => {
        const content = await this.encryptionService.encrypt(bookmarks);
        await this.pushToRepository(content);
      });

      // 同步成功后，尝试同步离线操作
      await this.syncOfflineOperations();

      await this.syncStatusService.updateStatus({ status: 'success' });
      this.toast.success('同步成功');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.syncStatusService.updateStatus({
        status: 'error',
        error: errorMessage
      });
      
      // 如果是网络错误，保存为离线操作
      if (error instanceof NetworkError) {
        await this.handleOfflineOperation('update', bookmarks);
      }
      
      this.errorHandler.handleError(error, 'GitService.uploadBookmarks');
      throw error;
    } finally {
      this.loading.hide();
    }
  }

  /**
   * 推送数据到仓库
   */
  private async pushToRepository(content: string): Promise<void> {
    try {
      const api = this.config.platform === 'github' 
        ? 'https://api.github.com'
        : 'https://gitee.com/api/v5';
      
      const headers = {
        'Authorization': `token ${this.config.token}`,
        'Content-Type': 'application/json',
      };

      // 获取当前文件信息（如果存在）
      const path = 'bookmarks.json';
      let sha: string | undefined;

      try {
        const response = await fetch(
          `${api}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`,
          { headers }
        );
        
        if (response.ok) {
          const data = await response.json();
          sha = data.sha;
        }
      } catch (error) {
        console.warn('获取文件信息失败，将创建新文件');
      }

      // 创建或更新文件
      const body = {
        message: `更新书签 ${new Date().toISOString()}`,
        content: Buffer.from(content).toString('base64'),
        branch: this.config.branch,
        ...(sha ? { sha } : {})
      };

      const response = await fetch(
        `${api}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify(body)
        }
      );

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 401) {
          throw new AuthError('访问令牌无效或已过期');
        } else if (response.status === 404) {
          throw new SyncError('仓库或文件不存在', error);
        } else {
          throw new SyncError(`推送失败: ${error.message}`, error);
        }
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new NetworkError('网络连接失败');
      }
      throw error;
    }
  }

  /**
   * 处理离线操作
   */
  private async handleOfflineOperation(
    type: 'create' | 'update' | 'delete',
    data: any
  ): Promise<void> {
    await this.offlineManager.addOperation(type, data);
    this.toast.info('已保存到离线队列，将在网络恢复后自动同步');
  }

  /**
   * 同步离线操作
   */
  private async syncOfflineOperations(): Promise<void> {
    const operations = await this.offlineManager.getOperations();
    if (operations.length === 0) return;

    const successIds: string[] = [];
    
    for (const op of operations) {
      try {
        switch (op.type) {
          case 'update':
            await this.pushToRepository(
              await this.encryptionService.encrypt(op.data)
            );
            break;
          // 处理其他类型的操作...
        }
        successIds.push(op.id);
      } catch (error) {
        console.error('同步离线操作失败:', error);
        // 继续处理其他操作
      }
    }

    // 清除已成功同步的操作
    if (successIds.length > 0) {
      await this.offlineManager.clearOperations(successIds);
    }
  }
} 