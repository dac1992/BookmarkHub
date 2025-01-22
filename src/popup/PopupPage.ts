import { BookmarkService } from '../services/BookmarkService';
import { BookmarkNode } from '../types/bookmark';
import { Logger } from '../utils/logger';
import { ConfigService } from '../services/ConfigService';
import { SyncConfig } from '../types/syncConfig';

export class PopupPage {
  private bookmarkService: BookmarkService;
  private logger: Logger;
  private configService: ConfigService;

  constructor() {
    this.bookmarkService = BookmarkService.getInstance();
    this.logger = Logger.getInstance();
    this.configService = new ConfigService();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.loadConfig(); // 页面加载时读取配置
    await this.updateBookmarkCount();
  }

  private async loadConfig(): Promise<void> {
    const config = await this.configService.getConfig();

    // 填充表单
    if (this.elements.token) this.elements.token.value = config.gitConfig.token;
    if (this.elements.owner) this.elements.owner.value = config.gitConfig.owner;
    if (this.elements.repo) this.elements.repo.value = config.gitConfig.repo;
    if (this.elements.branch) this.elements.branch.value = config.gitConfig.branch;
    if (this.elements.gistId) this.elements.gistId.value = config.gitConfig.gistId;
    if (this.elements.autoSync) this.elements.autoSync.checked = config.autoSync;
    if (this.elements.syncInterval) this.elements.syncInterval.value = config.syncInterval;
  }

  private async saveConfig(): Promise<void> {
    const config: SyncConfig = {
      gitConfig: {
        token: this.elements.token?.value || '',
        owner: this.elements.owner?.value || '',
        repo: this.elements.repo?.value || '',
        branch: this.elements.branch?.value || '',
        gistId: this.elements.gistId?.value || '',
      },
      autoSync: this.elements.autoSync?.checked || false,
      syncInterval: this.elements.syncInterval?.value || '0',
    };

    await this.configService.saveConfig(config);
  }

  private bindEvents(): void {
    if (this.elements.saveSettings) {
      this.elements.saveSettings.addEventListener('click', async () => {
        await this.saveConfig(); // 保存配置
        this.showMessage('配置已保存');
      });
    }
  }

  private async updateBookmarkCount(): Promise<void> {
    try {
      const bookmarks = await this.bookmarkService.getAllBookmarks();
      this.updateBookmarkCount(bookmarks);
    } catch (error) {
      this.logger.error('初始化UI失败:', error);
    }
  }

  private updateBookmarkCount(bookmarks: BookmarkNode[]): void {
    // 递归计算书签数量
    const countBookmarks = (nodes: BookmarkNode[]): { total: number; folders: number; bookmarks: number } => {
      let total = 0;
      let folders = 0;
      let bookmarks = 0;

      const processNode = (node: BookmarkNode) => {
        if (node.url) {
          bookmarks++;
        } else {
          folders++;
          node.children?.forEach(processNode);
        }
        total++;
      };

      nodes.forEach(processNode);
      return { total, folders, bookmarks };
    };

    const stats = countBookmarks(bookmarks);

    const countElement = document.getElementById('bookmarkCount');
    if (countElement) {
      countElement.textContent = String(stats.bookmarks);
    }

    // 更新其他统计信息显示
    const totalElement = document.getElementById('totalCount');
    const foldersElement = document.getElementById('folderCount');
    
    if (totalElement) {
      totalElement.textContent = String(stats.total);
    }
    if (foldersElement) {
      foldersElement.textContent = String(stats.folders);
    }
  }

  private async startSync(): Promise<void> {
    // 实现同步逻辑
  }

  private handleError(error: unknown): void {
    if (error instanceof Error) {
      console.error('同步失败:', error.message);
    } else {
      console.error('同步失败:', String(error));
    }
  }

  public async handleSync(): Promise<void> {
    try {
      await this.startSync();
      await this.updateBookmarkCount(await this.bookmarkService.getAllBookmarks()); // 同步完成后更新书签数量
    } catch (error) {
      this.handleError(error);
    }
  }
} 