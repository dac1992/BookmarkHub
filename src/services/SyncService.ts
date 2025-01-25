import { Logger } from '../utils/logger';
import { ConfigService } from './ConfigService';
import { GitHubService } from './GitHubService';
import { BookmarkService } from './BookmarkService';
import { BookmarkNode, BookmarkChange, ProgressNotification, ProgressEventType, SyncState } from '../types/bookmark';

export class SyncService {
  private static instance: SyncService;
  private logger: Logger;
  private configService: ConfigService;
  private githubService: GitHubService;
  private bookmarkService: BookmarkService;
  private progressListeners: ((notification: ProgressNotification) => void)[] = [];
  private syncInProgress = false;
  private autoSyncTimer: number | null = null;
  private currentSyncState: SyncState = {
    status: ProgressEventType.START,
    message: '准备同步...',
    progress: 0,
    lastSyncTime: 0
  };

  private constructor() {
    this.logger = Logger.getInstance();
    this.configService = ConfigService.getInstance();
    this.githubService = GitHubService.getInstance();
    this.bookmarkService = BookmarkService.getInstance();
    this.loadSyncState();
  }

  private async loadSyncState() {
    try {
      const result = await chrome.storage.local.get('syncState');
      if (result.syncState) {
        this.currentSyncState = result.syncState;
        this.notifyProgress({
          type: this.currentSyncState.status,
          message: this.currentSyncState.message,
          progress: this.currentSyncState.progress
        });
      }
    } catch (error) {
      this.logger.error('加载同步状态失败:', error);
    }
  }

  private async saveSyncState(state: Partial<SyncState>) {
    try {
      this.currentSyncState = { ...this.currentSyncState, ...state };
      await chrome.storage.local.set({ syncState: this.currentSyncState });
    } catch (error) {
      this.logger.error('保存同步状态失败:', error);
    }
  }

  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
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
    // 保存状态
    this.saveSyncState({
      status: notification.type,
      message: notification.message,
      progress: notification.progress || this.currentSyncState.progress
    });
    // 通知监听器
    this.progressListeners.forEach(listener => listener(notification));
  }

  public async sync(): Promise<void> {
    if (this.syncInProgress) {
      this.logger.info('同步已在进行中');
      return;
    }

    this.syncInProgress = true;
    let retryCount = 0;
    const maxRetries = 3;

    const attemptSync = async (): Promise<void> => {
      try {
        // 验证配置
        const config = await this.configService.getConfig();
        const errors = await this.configService.validateConfig(config);
        if (errors.length > 0) {
          throw new Error('配置验证失败: ' + errors.join(', '));
        }

        // 验证 GitHub 认证
        await this.githubService.authenticate();

        // 获取本地书签统计
        const localStats = await this.bookmarkService.getBookmarkStats();
        
        // 获取本地书签
        this.notifyProgress({
          type: ProgressEventType.PROGRESS,
          message: `读取本地书签(${localStats.bookmarkCount}个)...`,
          progress: 30
        });
        const localBookmarks = await this.bookmarkService.getAllBookmarks();
        
        // 上传到GitHub
        this.notifyProgress({
          type: ProgressEventType.PROGRESS,
          message: '上传到 GitHub...',
          progress: 70
        });

        await this.githubService.uploadBookmarks(localBookmarks);

        // 更新同步状态
        const syncTime = Date.now();
        await this.configService.saveConfig({
          lastSyncTime: syncTime
        });

        // 保存书签数量到本地存储
        await chrome.storage.local.set({
          'lastSyncBookmarkCount': localStats.bookmarkCount
        });

        // 构建成功状态消息
        const statusMessage = `同步完成 | ${localStats.bookmarkCount}书签/${localStats.folderCount}文件夹`;

        // 保存完整的同步状态
        const successState = {
          status: ProgressEventType.SUCCESS,
          message: statusMessage,
          progress: 100,
          lastSyncTime: syncTime,
          localStats,
          bookmarkCount: localStats.bookmarkCount
        };

        await this.saveSyncState(successState);
        this.notifyProgress({
          type: ProgressEventType.SUCCESS,
          message: statusMessage,
          progress: 100
        });

        this.syncInProgress = false;
      } catch (error: any) {
        this.logger.error(`同步尝试 ${retryCount + 1}/${maxRetries} 失败:`, error);

        // 检查是否需要重试
        const shouldRetry = (
          retryCount < maxRetries - 1 && 
          error.message?.includes('API rate limit exceeded')
        );

        if (shouldRetry) {
          retryCount++;
          this.notifyProgress({
            type: ProgressEventType.PROGRESS,
            message: `API限制，等待重试 (${retryCount}/${maxRetries})...`,
            progress: 30
          });
          // 等待一段时间后重试
          await new Promise(resolve => setTimeout(resolve, 2000));
          return attemptSync();
        }

        // 如果重试次数用完或不需要重试，保存错误状态
        const errorState = {
          status: ProgressEventType.ERROR,
          message: `同步失败: ${error.message}`,
          progress: 0,
          lastSyncTime: Date.now()
        };
        await this.saveSyncState(errorState);
        this.notifyProgress({
          type: ProgressEventType.ERROR,
          message: errorState.message,
          error: error
        });
        throw error;
      }
    };

    try {
      // 开始同步时保存初始状态
      const startState = {
        status: ProgressEventType.START,
        message: '开始同步...',
        progress: 0,
        lastSyncTime: Date.now()
      };
      await this.saveSyncState(startState);
      this.notifyProgress({
        type: ProgressEventType.START,
        message: startState.message,
        progress: 0
      });

      await attemptSync();
    } catch (error) {
      // 错误已在 attemptSync 中处理
      this.syncInProgress = false;
    }
  }

  public async startAutoSync(): Promise<void> {
    const config = await this.configService.getConfig();
    if (!config.autoSync) {
      this.logger.info('自动同步未启用');
      return;
    }

    if (this.autoSyncTimer !== null) {
      this.stopAutoSync();
    }

    const interval = config.syncInterval * 60 * 1000; // 转换为毫秒
    this.autoSyncTimer = window.setInterval(() => {
      this.sync().catch(error => {
        this.logger.error('自动同步失败:', error);
      });
    }, interval);

    this.logger.info(`自动同步已启动，间隔: ${config.syncInterval}分钟`);
  }

  public stopAutoSync(): void {
    if (this.autoSyncTimer !== null) {
      window.clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
      this.logger.info('自动同步已停止');
    }
  }

  public async handleBookmarkChange(change: BookmarkChange): Promise<void> {
    const config = await this.configService.getConfig();
    if (!config.autoSync) {
      return;
    }

    try {
      await this.sync();
    } catch (error) {
      this.logger.error('处理书签变更失败:', error);
    }
  }

  private normalizeBookmark(node: chrome.bookmarks.BookmarkTreeNode, index: number): BookmarkNode {
    return {
      id: node.id,
      title: node.title || '',
      url: node.url,
      parentId: node.parentId || undefined,
      dateAdded: node.dateAdded || Date.now(),
      index: node.index || index,
      children: node.children?.map((child, idx) => this.normalizeBookmark(child, idx))
    };
  }
} 