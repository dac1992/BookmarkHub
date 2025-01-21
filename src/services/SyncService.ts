import { Logger } from '../utils/logger';
import { BookmarkService } from './BookmarkService';
import { GitHubService } from './GitHubService';
import { ConfigService } from './ConfigService';
import { ProgressNotification, ProgressEventType } from '../types/bookmark';

export class SyncService {
  private static instance: SyncService;
  private logger: Logger;
  private bookmarkService: BookmarkService;
  private githubService: GitHubService;
  private configService: ConfigService;
  private autoSyncTimer: number | null = null;
  private isSyncing: boolean = false;
  private progressListeners: ((notification: ProgressNotification) => void)[] = [];

  private constructor() {
    this.logger = Logger.getInstance();
    this.bookmarkService = BookmarkService.getInstance();
    this.githubService = GitHubService.getInstance();
    this.configService = ConfigService.getInstance();
    
    // 转发 GitHub 服务的进度通知
    this.githubService.addProgressListener(this.handleGitHubProgress.bind(this));
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

  private handleGitHubProgress(notification: ProgressNotification): void {
    this.progressListeners.forEach(listener => listener(notification));
  }

  public async startAutoSync(): Promise<void> {
    const config = await this.configService.getConfig();
    if (!config.autoSync) {
      return;
    }

    // 清除现有的定时器
    if (this.autoSyncTimer) {
      window.clearInterval(this.autoSyncTimer);
    }

    // 设置新的定时器
    this.autoSyncTimer = window.setInterval(
      async () => {
        try {
          await this.sync();
        } catch (error) {
          this.logger.error('自动同步失败:', error);
        }
      },
      config.syncInterval * 60 * 1000
    );

    this.logger.info(`自动同步已启动，间隔: ${config.syncInterval}分钟`);
  }

  public stopAutoSync(): void {
    if (this.autoSyncTimer) {
      window.clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
      this.logger.info('自动同步已停止');
    }
  }

  public async sync(): Promise<void> {
    if (this.isSyncing) {
      this.logger.warn('同步正在进行中，请稍后再试');
      return;
    }

    this.isSyncing = true;
    this.notifyProgress({
      type: ProgressEventType.START,
      message: '开始同步书签...'
    });

    try {
      // 验证配置
      const errors = await this.configService.validateConfig();
      if (errors.length > 0) {
        throw new Error(`配置错误: ${errors.join(', ')}`);
      }

      // 获取本地书签
      const localBookmarks = await this.bookmarkService.getAllBookmarks();
      
      try {
        // 尝试下载远程书签
        const remoteBookmarks = await this.githubService.downloadBookmarks();
        
        // 如果远程书签存在，进行合并
        if (remoteBookmarks) {
          await this.mergeBookmarks(localBookmarks, remoteBookmarks);
        } else {
          // 如果远程没有书签，直接上传本地书签
          await this.githubService.uploadBookmarks(localBookmarks);
        }
      } catch (error: any) {
        if (error.message.includes('404')) {
          // 如果远程仓库为空，直接上传本地书签
          await this.githubService.uploadBookmarks(localBookmarks);
        } else {
          throw error;
        }
      }

      // 更新最后同步时间
      await this.configService.updateConfig({
        lastSyncTime: Date.now()
      });

      this.notifyProgress({
        type: ProgressEventType.SUCCESS,
        message: '书签同步完成'
      });
    } catch (error: any) {
      this.notifyProgress({
        type: ProgressEventType.ERROR,
        message: `同步失败: ${error.message}`
      });
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  private async mergeBookmarks(
    local: chrome.bookmarks.BookmarkTreeNode[],
    remote: chrome.bookmarks.BookmarkTreeNode[]
  ): Promise<void> {
    // TODO: 实现更复杂的合并逻辑
    // 目前简单地使用最新的版本
    const localTime = await this.getLastModifiedTime(local);
    const remoteTime = await this.getLastModifiedTime(remote);

    if (localTime > remoteTime) {
      // 本地版本更新，上传到远程
      await this.githubService.uploadBookmarks(local);
    } else if (remoteTime > localTime) {
      // 远程版本更新，更新本地
      await this.bookmarkService.updateAllBookmarks(remote);
    }
    // 如果时间相同，不需要操作
  }

  private async getLastModifiedTime(bookmarks: chrome.bookmarks.BookmarkTreeNode[]): Promise<number> {
    // 递归查找最新的修改时间
    const findLatestTime = (nodes: chrome.bookmarks.BookmarkTreeNode[]): number => {
      let latestTime = 0;
      for (const node of nodes) {
        if (node.dateGroupModified) {
          latestTime = Math.max(latestTime, node.dateGroupModified);
        }
        if (node.dateAdded) {
          latestTime = Math.max(latestTime, node.dateAdded);
        }
        if (node.children) {
          latestTime = Math.max(latestTime, findLatestTime(node.children));
        }
      }
      return latestTime;
    };

    return findLatestTime(bookmarks);
  }
} 