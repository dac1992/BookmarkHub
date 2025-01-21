import { ConfigService } from '../services/ConfigService';
import { GitHubService } from '../services/GitHubService';
import { Toast } from '../components/Toast';
import { Logger } from '../utils/logger';

export class SettingsPage {
  private configService: ConfigService;
  private githubService: GitHubService;
  private toast: Toast;
  private logger: Logger;

  constructor() {
    this.configService = new ConfigService();
    this.githubService = GitHubService.getInstance();
    this.toast = new Toast();
    this.logger = Logger.getInstance();
    this.initializeEventListeners();
  }

  private async initializeEventListeners(): Promise<void> {
    // 加载设置
    await this.loadSettings();

    // 同步类型切换
    const syncTypeSelect = document.getElementById('syncType') as HTMLSelectElement;
    syncTypeSelect?.addEventListener('change', () => this.updateSyncTypeVisibility());

    // 测试连接
    const testButton = document.getElementById('testConnection') as HTMLButtonElement;
    testButton?.addEventListener('click', () => this.testConnection());

    // 保存设置
    const form = document.getElementById('settingsForm') as HTMLFormElement;
    form?.addEventListener('submit', (e) => this.handleSubmit(e));
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

      if (syncTypeSelect) syncTypeSelect.value = config.syncType || 'repository';
      if (tokenInput) tokenInput.value = config.gitConfig.token || '';
      if (ownerInput) ownerInput.value = config.gitConfig.owner || '';
      if (repoInput) repoInput.value = config.gitConfig.repo || '';
      if (branchInput) branchInput.value = config.gitConfig.branch || 'main';
      if (gistIdInput) gistIdInput.value = config.gitConfig.gistId || '';
      if (autoSyncInput) autoSyncInput.checked = config.autoSync || false;
      if (syncIntervalSelect) syncIntervalSelect.value = String(config.autoSyncInterval || 300000);

      this.updateSyncTypeVisibility();
    } catch (error) {
      this.logger.error('加载设置失败:', error);
      this.showStatus('error', '加载设置失败');
    }
  }

  private updateSyncTypeVisibility(): void {
    const syncType = (document.getElementById('syncType') as HTMLSelectElement).value;
    const repoSettings = document.getElementById('repositorySettings');
    const gistSettings = document.getElementById('gistSettings');

    if (repoSettings && gistSettings) {
      repoSettings.style.display = syncType === 'repository' ? 'block' : 'none';
      gistSettings.style.display = syncType === 'gist' ? 'block' : 'none';
    }
  }

  private async testConnection(): Promise<void> {
    try {
      const token = (document.getElementById('token') as HTMLInputElement).value;
      if (!token) {
        this.showStatus('error', '请输入GitHub Token');
        return;
      }

      this.showStatus('info', '正在测试连接...');
      await this.githubService.authenticate();
      this.showStatus('success', '连接测试成功');
    } catch (error) {
      this.logger.error('连接测试失败:', error);
      this.showStatus('error', '连接测试失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  private async handleSubmit(event: Event): Promise<void> {
    event.preventDefault();

    try {
      const formData = new FormData(event.target as HTMLFormElement);
      const syncType = formData.get('syncType') as 'repository' | 'gist';
      
      const config = {
        syncType,
        autoSync: formData.get('autoSync') === 'on',
        autoSyncInterval: Number(formData.get('syncInterval')),
        gitConfig: {
          token: formData.get('token') as string,
          owner: formData.get('owner') as string,
          repo: formData.get('repo') as string,
          branch: formData.get('branch') as string,
          gistId: formData.get('gistId') as string
        }
      };

      await this.configService.updateConfig(config);
      this.showStatus('success', '设置已保存');
    } catch (error) {
      this.logger.error('保存设置失败:', error);
      this.showStatus('error', '保存设置失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  private showStatus(type: 'success' | 'error' | 'info', message: string): void {
    const statusDiv = document.getElementById('statusMessage');
    if (statusDiv) {
      statusDiv.className = `status-message ${type}`;
      statusDiv.textContent = message;
    }
  }
}

// 初始化设置页面
document.addEventListener('DOMContentLoaded', () => {
  new SettingsPage();
}); 