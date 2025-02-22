import { BookmarkService } from '../services/BookmarkService';
import { ConfigService } from '../services/ConfigService';
import { GitHubService } from '../services/GitHubService';
import { SyncService } from '../services/SyncService';
import { Toast } from '../components/Toast';
import { Logger } from '../utils/logger';
import { SyncConfig } from '../types/bookmark';
import './styles/popup.css';
import { SyncStatusService } from '../services/SyncStatusService';

const logger = Logger.getInstance();
logger.info('Popup页面加载');

interface Elements {
  syncPanel: HTMLElement | null;
  settingsPanel: HTMLElement | null;
  settingsButton: HTMLElement | null;
  lastSync: HTMLElement | null;
  bookmarkCount: HTMLElement | null;
  syncButton: HTMLButtonElement | null;
  syncProgress: HTMLElement | null;
  syncStatus: HTMLElement | null;
  progressFill: HTMLElement | null;
  // 设置表单元素
  syncType: HTMLSelectElement | null;
  token: HTMLInputElement | null;
  owner: HTMLInputElement | null;
  repo: HTMLInputElement | null;
  branch: HTMLInputElement | null;
  gistId: HTMLInputElement | null;
  autoSync: HTMLInputElement | null;
  syncInterval: HTMLSelectElement | null;
  testConnection: HTMLButtonElement | null;
  saveSettings: HTMLButtonElement | null;
  repositorySettings: HTMLElement | null;
  gistSettings: HTMLElement | null;
}

export class PopupPage {
  private bookmarkService: BookmarkService;
  private configService: ConfigService;
  private githubService: GitHubService;
  private syncService: SyncService;
  private toast: Toast;
  private logger: Logger;
  private elements: Elements;
  private syncInProgress = false;
  private syncStatusService: SyncStatusService;

  constructor() {
    logger.info('初始化PopupManager');
    this.bookmarkService = BookmarkService.getInstance();
    this.configService = ConfigService.getInstance();
    this.githubService = GitHubService.getInstance();
    this.syncService = SyncService.getInstance();
    this.toast = new Toast();
    this.logger = Logger.getInstance();
    this.syncStatusService = SyncStatusService.getInstance();

    // 添加同步进度监听器
    this.syncService.addProgressListener((notification) => {
      this.updateSyncStatus(notification.message, notification.progress || 0);
    });

    this.elements = {
      syncPanel: null,
      settingsPanel: null,
      settingsButton: null,
      lastSync: null,
      bookmarkCount: null,
      syncButton: null,
      syncProgress: null,
      syncStatus: null,
      progressFill: null,
      // 设置表单元素
      syncType: null,
      token: null,
      owner: null,
      repo: null,
      branch: null,
      gistId: null,
      autoSync: null,
      syncInterval: null,
      testConnection: null,
      saveSettings: null,
      repositorySettings: null,
      gistSettings: null
    };

    // 确保DOM加载完成后再初始化
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.initializeElements();
        this.initializeEventListeners();
        this.loadInitialState().catch(error => {
          this.logger.error('初始化加载失败:', error);
        });
      });
    } else {
      this.initializeElements();
      this.initializeEventListeners();
      this.loadInitialState().catch(error => {
        this.logger.error('初始化加载失败:', error);
      });
    }
  }

  private initializeElements(): void {
    // 获取所有UI元素
    Object.keys(this.elements).forEach(key => {
      const element = document.getElementById(key);
      if (element) {
        switch (key) {
          case 'syncType':
          case 'syncInterval':
            (this.elements as any)[key] = element as HTMLSelectElement;
            break;
          case 'token':
          case 'owner':
          case 'repo':
          case 'branch':
          case 'gistId':
          case 'autoSync':
            (this.elements as any)[key] = element as HTMLInputElement;
            break;
          case 'syncButton':
          case 'testConnection':
          case 'saveSettings':
            (this.elements as any)[key] = element as HTMLButtonElement;
            break;
          default:
            (this.elements as any)[key] = element;
        }
      }
    });

    // 验证必要的元素是否存在
    const requiredElements = ['syncPanel', 'settingsPanel', 'settingsButton', 'syncButton'];
    requiredElements.forEach(elementId => {
      if (!this.elements[elementId as keyof Elements]) {
        this.logger.error(`Required element not found: ${elementId}`);
      }
    });
  }

  private async initializeEventListeners(): Promise<void> {
    // 同步类型切换事件
    this.elements.syncType?.addEventListener('change', () => this.updateSyncTypeVisibility());

    // 测试连接按钮点击事件
    this.elements.testConnection?.addEventListener('click', () => this.testConnection());

    // 保存设置按钮点击事件
    this.elements.saveSettings?.addEventListener('click', () => this.saveSettings());

    // 同步按钮点击事件
    this.elements.syncButton?.addEventListener('click', () => this.handleSync());
  }

  private async loadInitialState(): Promise<void> {
    try {
      // 加载配置
      await this.loadSettings();

      // 加载书签数量
      await this.updateBookmarkCount();

      // 加载上次同步时间
      const lastSync = await this.getLastSyncTime();
      this.updateLastSyncTime(lastSync);

      // 检查是否正在同步
      const syncStatus = await this.getSyncStatus();
      if (syncStatus.inProgress) {
        this.updateSyncStatus('同步中...', syncStatus.progress);
      }
    } catch (error) {
      this.logger.error('加载初始状态失败:', error);
      this.showError('加载状态失败');
    }
  }

  private togglePanel(): void {
    if (this.elements.syncPanel && this.elements.settingsPanel) {
      if (this.elements.syncPanel.classList.contains('active')) {
        this.elements.syncPanel.classList.remove('active');
        this.elements.settingsPanel.classList.add('active');
      } else {
        this.elements.settingsPanel.classList.remove('active');
        this.elements.syncPanel.classList.add('active');
      }
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      this.logger.debug('开始加载配置...');
      const config = await this.configService.getConfig();
      this.logger.debug('获取到配置:', config);
      
      // 填充表单
      if (this.elements.syncType) this.elements.syncType.value = config.syncType === 'repo' ? 'repository' : 'gist';
      if (this.elements.token) this.elements.token.value = config.gitConfig.token;
      if (this.elements.owner) this.elements.owner.value = config.gitConfig.owner || '';
      if (this.elements.repo) this.elements.repo.value = config.gitConfig.repo || '';
      if (this.elements.branch) this.elements.branch.value = config.gitConfig.branch || '';
      if (this.elements.gistId) this.elements.gistId.value = config.gitConfig.gistId || '';
      if (this.elements.autoSync) this.elements.autoSync.checked = config.autoSync;
      if (this.elements.syncInterval) this.elements.syncInterval.value = String(config.syncInterval);

      this.updateSyncTypeVisibility();
      this.logger.debug('配置加载完成');
    } catch (error) {
      this.logger.error('加载设置失败:', error);
      this.toast.error('加载设置失败');
    }
  }

  private updateSyncTypeVisibility(): void {
    if (this.elements.repositorySettings && this.elements.gistSettings) {
      this.elements.repositorySettings.style.display = this.elements.syncType?.value === 'repository' ? 'block' : 'none';
      this.elements.gistSettings.style.display = this.elements.syncType?.value === 'gist' ? 'block' : 'none';
    }
  }

  private async testConnection(): Promise<void> {
    try {
      const token = this.elements.token?.value;
      if (!token) {
        this.toast.error('请输入GitHub Token');
        return;
      }

      this.toast.info('正在测试连接...');
      await this.githubService.authenticate();
      this.toast.success('连接测试成功');
    } catch (error) {
      this.logger.error('连接测试失败:', error);
      this.toast.error('连接测试失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      // 获取当前配置以保留 deviceId
      const currentConfig = await this.configService.getConfig();
      
      const config: SyncConfig = {
        syncType: this.elements.syncType?.value === 'repository' ? 'repo' : 'gist',
        autoSync: this.elements.autoSync?.checked ?? false,
        syncInterval: parseInt(this.elements.syncInterval?.value || '60', 10),
        gitConfig: {
          token: this.elements.token?.value || '',
          owner: this.elements.owner?.value || '',
          repo: this.elements.repo?.value || '',
          branch: this.elements.branch?.value || 'main',
          gistId: this.elements.gistId?.value || ''
        },
        deviceId: currentConfig.deviceId || `device_${Date.now()}`
      };

      await this.configService.saveConfig(config);
      this.toast.success('设置已保存');
      this.togglePanel(); // 返回同步面板
      
      // 重新加载配置以确保显示最新状态
      await this.loadSettings();
    } catch (error) {
      this.logger.error('保存设置失败:', error);
      this.toast.error('保存设置失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  private updateSyncStatus(message: string, progress: number): void {
    const statusElement = document.getElementById('syncStatus');
    const progressElement = document.getElementById('progressFill');
    const percentageElement = document.getElementById('syncPercentage');

    if (statusElement) {
      statusElement.textContent = message;
    }
    if (progressElement) {
      progressElement.style.width = `${progress}%`;
    }
    if (percentageElement) {
      percentageElement.textContent = `${progress}%`;
    }
  }

  private async updateBookmarkCount(): Promise<void> {
    try {
      const status = await this.syncStatusService.getStatus();
      if (this.elements.bookmarkCount) {
        this.elements.bookmarkCount.textContent = status.bookmarkCount?.toString() || '0';
      }
    } catch (error) {
      this.logger.error('获取书签数量失败:', error);
    }
  }

  private async updateLastSyncTime(time: Date | null): Promise<void> {
    if (this.elements.lastSync) {
      this.elements.lastSync.textContent = time ? this.formatDate(time) : '从未同步';
    }
  }

  private formatDate(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) { // 1分钟内
      return '刚刚';
    } else if (diff < 3600000) { // 1小时内
      const minutes = Math.floor(diff / 60000);
      return `${minutes}分钟前`;
    } else if (diff < 86400000) { // 24小时内
      const hours = Math.floor(diff / 3600000);
      return `${hours}小时前`;
    } else {
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

  private resetSyncProgress(): void {
    this.updateSyncStatus('准备同步...', 0);
  }

  private showError(message: string): void {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
      setTimeout(() => {
        errorElement.style.display = 'none';
      }, 3000);
    }
  }

  private async handleSync(): Promise<void> {
    if (this.syncInProgress) {
      return;
    }

    try {
      this.syncInProgress = true;

      // 验证配置
      const config = await this.configService.getConfig();
      if (!config.gitConfig.token) {
        this.showError('请先配置GitHub Token');
        return;
      }

      // 开始同步
      await this.syncService.sync();

      // 更新最后同步时间
      const now = new Date();
      await this.saveLastSyncTime(now);
      await this.updateLastSyncTime(now);
      
      // 更新书签数量
      await this.updateBookmarkCount();

    } catch (error) {
      this.logger.error('同步失败:', error);
      this.showError('同步失败: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      this.syncInProgress = false;
    }
  }

  private async getLastSyncTime(): Promise<Date | null> {
    const config = await this.configService.getConfig();
    return config.lastSyncTime ? new Date(config.lastSyncTime) : null;
  }

  private async getSyncStatus(): Promise<{ inProgress: boolean; progress: number }> {
    return {
      inProgress: this.syncInProgress,
      progress: 0
    };
  }

  private async saveLastSyncTime(time: Date): Promise<void> {
    try {
      await this.configService.saveConfig({
        lastSyncTime: time.getTime()
      });
    } catch (error) {
      this.logger.error('保存同步时间失败:', error);
    }
  }
}

// 等待 DOM 加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
  logger.info('DOM加载完成');
  new PopupPage();
}); 