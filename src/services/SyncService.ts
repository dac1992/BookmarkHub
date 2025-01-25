import { Logger } from '../utils/logger';
import { ConfigService } from './ConfigService';
import { GitHubService } from './GitHubService';
import { BookmarkService } from './BookmarkService';
import { BookmarkNode, BookmarkChange, ProgressNotification, ProgressEventType } from '../types/bookmark';

export class SyncService {
  private static instance: SyncService;
  private logger: Logger;
  private configService: ConfigService;
  private githubService: GitHubService;
  private bookmarkService: BookmarkService;
  private progressListeners: ((notification: ProgressNotification) => void)[] = [];
  private syncInProgress = false;
  private autoSyncTimer: number | null = null;

  private constructor() {
    this.logger = Logger.getInstance();
    this.configService = ConfigService.getInstance();
    this.githubService = GitHubService.getInstance();
    this.bookmarkService = BookmarkService.getInstance();
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
    this.progressListeners.forEach(listener => listener(notification));
  }

  public async sync(): Promise<void> {
    if (this.syncInProgress) {
      this.logger.info('同步已在进行中');
      return;
    }

    this.syncInProgress = true;
    this.notifyProgress({
      type: ProgressEventType.START,
      message: '开始同步...'
    });

    try {
      // 验证配置
      const config = await this.configService.getConfig();
      const errors = await this.configService.validateConfig(config);
      if (errors.length > 0) {
        throw new Error('配置验证失败: ' + errors.join(', '));
      }

      // 验证 GitHub 认证
      await this.githubService.authenticate();

      // 获取本地书签
      this.notifyProgress({
        type: ProgressEventType.PROGRESS,
        message: '读取本地书签...',
        progress: 30
      });
      const localBookmarks = await this.bookmarkService.getAllBookmarks();
      
      // 上传到GitHub
      this.notifyProgress({
        type: ProgressEventType.PROGRESS,
        message: '上传到 GitHub...',
        progress: 60
      });
      await this.githubService.uploadBookmarks(localBookmarks);

      // 更新最后同步时间
      await this.configService.saveConfig({
        lastSyncTime: Date.now()
      });

      this.notifyProgress({
        type: ProgressEventType.SUCCESS,
        message: '同步完成',
        progress: 100
      });
    } catch (error: any) {
      this.logger.error('同步失败:', error);
      this.notifyProgress({
        type: ProgressEventType.ERROR,
        message: `同步失败: ${error.message}`,
        error: error
      });
      throw error;
    } finally {
      // 确保在任何情况下都重置同步状态
      setTimeout(() => {
        this.syncInProgress = false;
      }, 1000); // 添加1秒延迟，防止状态切换太快
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