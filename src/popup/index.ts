import { BookmarkService } from '../services/BookmarkService';
import { ConfigService } from '../services/ConfigService';
import { GitHubService } from '../services/GitHubService';
import { Toast } from '../components/Toast';
import { Logger } from '../utils/logger';
import './styles/popup.css';

const logger = Logger.getInstance();
logger.info('Popup页面加载');

export class PopupPage {
  private bookmarkService: BookmarkService;
  private configService: ConfigService;
  private githubService: GitHubService;
  private toast: Toast;
  private logger: Logger;

  private syncInProgress = false;

  // UI元素
  private elements: {
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
  } = {
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

  constructor() {
    logger.info('初始化PopupManager');
    this.bookmarkService = BookmarkService.getInstance();
    this.configService = new ConfigService();
    this.githubService = GitHubService.getInstance();
    this.toast = new Toast();
    this.logger = Logger.getInstance();

    this.initializeElements();
    this.initializeEventListeners();
    this.loadInitialState();
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
      if (!this.elements[elementId as keyof typeof this.elements]) {
        this.logger.error(`Required element not found: ${elementId}`);
      }
    });
  }

  private async initializeEventListeners(): Promise<void> {
    // 同步按钮
    const syncButton = document.getElementById('syncButton');
    syncButton?.addEventListener('click', () => this.handleSync());

    // 设置按钮
    const settingsButton = document.getElementById('settingsButton');
    settingsButton?.addEventListener('click', () => this.openSettings());

    // 同步类型切换事件
    this.elements.syncType?.addEventListener('change', () => this.updateSyncTypeVisibility());

    // 测试连接按钮点击事件
    this.elements.testConnection?.addEventListener('click', () => this.testConnection());

    // 保存设置按钮点击事件
    this.elements.saveSettings?.addEventListener('click', () => this.saveSettings());
  }

  private async loadInitialState(): Promise<void> {
    try {
      // 加载书签数量
      const bookmarks = await this.bookmarkService.getAllBookmarks();
      this.updateBookmarkCount(bookmarks.length);

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
    const syncPanel = this.elements.syncPanel;
    const settingsPanel = this.elements.settingsPanel;
    
    if (syncPanel && settingsPanel) {
      if (syncPanel.classList.contains('active')) {
        syncPanel.classList.remove('active');
        settingsPanel.classList.add('active');
      } else {
        settingsPanel.classList.remove('active');
        syncPanel.classList.add('active');
      }
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const config = await this.configService.getConfig();
      
      // 填充表单
      if (this.elements.syncType) this.elements.syncType.value = config.syncType;
      if (this.elements.token) this.elements.token.value = config.gitConfig.token;
      if (this.elements.owner) this.elements.owner.value = config.gitConfig.owner;
      if (this.elements.repo) this.elements.repo.value = config.gitConfig.repo;
      if (this.elements.branch) this.elements.branch.value = config.gitConfig.branch;
      if (this.elements.gistId) this.elements.gistId.value = config.gitConfig.gistId || '';
      if (this.elements.autoSync) this.elements.autoSync.checked = config.autoSync;
      if (this.elements.syncInterval) this.elements.syncInterval.value = String(config.autoSyncInterval);

      this.updateSyncTypeVisibility();
    } catch (error) {
      this.logger.error('加载设置失败:', error);
      this.toast.error('加载设置失败');
    }
  }

  private updateSyncTypeVisibility(): void {
    const syncType = this.elements.syncType?.value;
    const repoSettings = this.elements.repositorySettings;
    const gistSettings = this.elements.gistSettings;

    if (repoSettings && gistSettings) {
      repoSettings.style.display = syncType === 'repository' ? 'block' : 'none';
      gistSettings.style.display = syncType === 'gist' ? 'block' : 'none';
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
      const config = {
        syncType: this.elements.syncType?.value as 'repository' | 'gist',
        autoSync: this.elements.autoSync?.checked || false,
        autoSyncInterval: Number(this.elements.syncInterval?.value) || 300000,
        gitConfig: {
          token: this.elements.token?.value || '',
          owner: this.elements.owner?.value || '',
          repo: this.elements.repo?.value || '',
          branch: this.elements.branch?.value || 'main',
          gistId: this.elements.gistId?.value
        }
      };

      await this.configService.updateConfig(config);
      this.toast.success('设置已保存');
      this.togglePanel(); // 返回同步面板
    } catch (error) {
      this.logger.error('保存设置失败:', error);
      this.toast.error('保存设置失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  private updateSyncStatus(status: string, progress: number): void {
    const statusText = this.elements.syncStatus;
    const progressFill = this.elements.progressFill;
    const percentageText = document.getElementById('syncPercentage');

    if (statusText) {
      statusText.textContent = status;
    }

    if (progressFill) {
      progressFill.style.width = `${progress}%`;
    }

    if (percentageText) {
      percentageText.textContent = `${progress}%`;
    }
  }

  private updateBookmarkCount(count: number): void {
    const countElement = this.elements.bookmarkCount;
    if (countElement) {
      countElement.textContent = count.toString();
    }
  }

  private async updateLastSyncTime(time: Date | null): Promise<void> {
    const lastSyncElement = this.elements.lastSync;
    if (lastSyncElement) {
      lastSyncElement.textContent = time ? this.formatDate(time) : '从未同步';
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
    const errorContainer = document.createElement('div');
    errorContainer.className = 'error-message';
    errorContainer.textContent = message;
    
    const messageContainer = document.getElementById('messageContainer');
    if (messageContainer) {
      messageContainer.innerHTML = '';
      messageContainer.appendChild(errorContainer);
      
      // 3秒后自动消失
      setTimeout(() => {
        errorContainer.remove();
      }, 3000);
    }
  }

  private openSettings(): void {
    chrome.runtime.openOptionsPage();
  }

  private async getLastSyncTime(): Promise<Date | null> {
    const result = await chrome.storage.local.get('lastSyncTime');
    return result.lastSyncTime ? new Date(result.lastSyncTime) : null;
  }

  private async getSyncStatus(): Promise<{ inProgress: boolean; progress: number }> {
    const result = await chrome.storage.local.get(['syncInProgress', 'syncProgress']);
    return {
      inProgress: result.syncInProgress || false,
      progress: result.syncProgress || 0
    };
  }

  private async handleSync(): Promise<void> {
    if (this.syncInProgress) {
      return;
    }

    try {
      this.syncInProgress = true;
      this.updateSyncStatus('准备同步...', 0);

      // 验证配置
      const config = await this.configService.getConfig();
      if (!config.gitConfig.token) {
        this.showError('请先配置GitHub Token');
        return;
      }

      // 开始同步
      await this.githubService.authenticate();
      
      // 获取所有书签
      const bookmarks = await this.bookmarkService.getAllBookmarks();
      this.updateSyncStatus('正在上传书签...', 30);

      // 上传书签
      await this.uploadBookmarks(bookmarks);
      this.updateSyncStatus('同步完成', 100);

      // 更新最后同步时间
      const now = new Date();
      await this.saveLastSyncTime(now);
      await this.updateLastSyncTime(now);
      
      // 更新书签数量
      this.updateBookmarkCount(bookmarks.length);

    } catch (error) {
      this.logger.error('同步失败:', error);
      this.showError('同步失败: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      this.syncInProgress = false;
      setTimeout(() => {
        this.resetSyncProgress();
      }, 3000);
    }
  }

  private async uploadBookmarks(bookmarks: any[]): Promise<void> {
    // TODO: 实现实际的上传逻辑
    await new Promise(resolve => setTimeout(resolve, 1000)); // 模拟上传
  }

  private async saveLastSyncTime(time: Date): Promise<void> {
    await chrome.storage.local.set({ lastSyncTime: time.getTime() });
  }
}

// 等待 DOM 加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
  logger.info('DOM加载完成');
  new PopupPage();
}); 