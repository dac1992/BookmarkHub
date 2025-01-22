import { ConfigService } from '../services/ConfigService';
import { GitHubService } from '../services/GitHubService';
import { Toast } from '../components/Toast';
import { Logger } from '../utils/logger';
import { SyncConfig } from '../types/bookmark';

export class SettingsPage {
  private configService: ConfigService;
  private githubService: GitHubService;
  private toast: Toast;
  private logger: Logger;

  constructor() {
    this.configService = ConfigService.getInstance();
    this.githubService = GitHubService.getInstance();
    this.toast = new Toast();
    this.logger = Logger.getInstance();

    this.initializeEventListeners();
    this.loadSettings();
  }

  private async loadSettings(): Promise<void> {
    try {
      const config = await this.configService.getConfig();
      
      // 填充表单
      const syncTypeSelect = document.getElementById('syncType') as HTMLSelectElement;
      const tokenInput = document.getElementById('token') as HTMLInputElement;
      const ownerInput = document.getElementById('owner') as HTMLInputElement;
      const repoInput = document.getElementById('repo') as HTMLInputElement;
      const branchInput = document.getElementById('branch') as HTMLInputElement;
      const gistIdInput = document.getElementById('gistId') as HTMLInputElement;
      const autoSyncInput = document.getElementById('autoSync') as HTMLInputElement;
      const syncIntervalSelect = document.getElementById('syncInterval') as HTMLSelectElement;

      if (syncTypeSelect) syncTypeSelect.value = config.syncType === 'repo' ? 'repository' : 'gist';
      if (tokenInput) tokenInput.value = config.gitConfig.token;
      if (ownerInput) ownerInput.value = config.gitConfig.owner || '';
      if (repoInput) repoInput.value = config.gitConfig.repo || '';
      if (branchInput) branchInput.value = config.gitConfig.branch || '';
      if (gistIdInput) gistIdInput.value = config.gitConfig.gistId || '';
      if (autoSyncInput) autoSyncInput.checked = config.autoSync;
      if (syncIntervalSelect) syncIntervalSelect.value = String(config.syncInterval);

      this.updateSyncTypeVisibility();
    } catch (error) {
      this.logger.error('加载设置失败:', error);
      this.toast.error('加载设置失败');
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      const syncTypeSelect = document.getElementById('syncType') as HTMLSelectElement;
      const tokenInput = document.getElementById('token') as HTMLInputElement;
      const ownerInput = document.getElementById('owner') as HTMLInputElement;
      const repoInput = document.getElementById('repo') as HTMLInputElement;
      const branchInput = document.getElementById('branch') as HTMLInputElement;
      const gistIdInput = document.getElementById('gistId') as HTMLInputElement;
      const autoSyncInput = document.getElementById('autoSync') as HTMLInputElement;
      const syncIntervalSelect = document.getElementById('syncInterval') as HTMLSelectElement;

      const config: Partial<SyncConfig> = {
        syncType: syncTypeSelect?.value === 'repository' ? 'repo' : 'gist',
        autoSync: autoSyncInput?.checked || false,
        syncInterval: Number(syncIntervalSelect?.value) || 300000,
        gitConfig: {
          token: tokenInput?.value || '',
          owner: ownerInput?.value || undefined,
          repo: repoInput?.value || undefined,
          branch: branchInput?.value || 'main',
          gistId: gistIdInput?.value || undefined
        }
      };

      await this.configService.updateConfig(config);
      this.toast.success('设置已保存');
    } catch (error) {
      this.logger.error('保存设置失败:', error);
      this.toast.error('保存设置失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  private updateSyncTypeVisibility(): void {
    const syncTypeSelect = document.getElementById('syncType') as HTMLSelectElement;
    const repoSettings = document.getElementById('repositorySettings');
    const gistSettings = document.getElementById('gistSettings');

    if (repoSettings && gistSettings) {
      repoSettings.style.display = syncTypeSelect?.value === 'repository' ? 'block' : 'none';
      gistSettings.style.display = syncTypeSelect?.value === 'gist' ? 'block' : 'none';
    }
  }

  private async testConnection(): Promise<void> {
    try {
      const tokenInput = document.getElementById('token') as HTMLInputElement;
      const token = tokenInput?.value;
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

  private initializeEventListeners(): void {
    // 同步类型切换事件
    const syncTypeSelect = document.getElementById('syncType');
    syncTypeSelect?.addEventListener('change', () => this.updateSyncTypeVisibility());

    // 测试连接按钮点击事件
    const testConnectionButton = document.getElementById('testConnection');
    testConnectionButton?.addEventListener('click', () => this.testConnection());

    // 保存设置按钮点击事件
    const saveSettingsButton = document.getElementById('saveSettings');
    saveSettingsButton?.addEventListener('click', () => this.saveSettings());
  }
}

// 初始化设置页面
document.addEventListener('DOMContentLoaded', () => {
  new SettingsPage();
}); 