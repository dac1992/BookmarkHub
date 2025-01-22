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
  private form: HTMLFormElement | null = null;
  private elements: {
    syncType?: HTMLSelectElement;
    token?: HTMLInputElement;
    owner?: HTMLInputElement;
    repo?: HTMLInputElement;
    branch?: HTMLInputElement;
    gistId?: HTMLInputElement;
    autoSync?: HTMLInputElement;
    syncInterval?: HTMLInputElement;
    saveBtn?: HTMLButtonElement;
    testBtn?: HTMLButtonElement;
  } = {};

  constructor() {
    this.configService = ConfigService.getInstance();
    this.githubService = GitHubService.getInstance();
    this.toast = new Toast();
    this.logger = Logger.getInstance();
    this.init();
  }

  public async init(): Promise<void> {
    this.form = document.getElementById('settingsForm') as HTMLFormElement;
    if (!this.form) {
      this.logger.error('设置表单未找到');
      return;
    }

    this.initElements();
    await this.loadConfig();
    this.bindEvents();
  }

  private initElements(): void {
    if (!this.form) return;

    this.elements = {
      syncType: this.form.querySelector('#syncType') as HTMLSelectElement,
      token: this.form.querySelector('#token') as HTMLInputElement,
      owner: this.form.querySelector('#owner') as HTMLInputElement,
      repo: this.form.querySelector('#repo') as HTMLInputElement,
      branch: this.form.querySelector('#branch') as HTMLInputElement,
      gistId: this.form.querySelector('#gistId') as HTMLInputElement,
      autoSync: this.form.querySelector('#autoSync') as HTMLInputElement,
      syncInterval: this.form.querySelector('#syncInterval') as HTMLInputElement,
      saveBtn: this.form.querySelector('#saveBtn') as HTMLButtonElement,
      testBtn: this.form.querySelector('#testBtn') as HTMLButtonElement
    };

    // 验证所有必要元素是否存在
    const requiredElements = ['syncType', 'token', 'saveBtn', 'testBtn'] as const;
    for (const elementId of requiredElements) {
      if (!this.elements[elementId]) {
        this.logger.error(`必要元素未找到: ${elementId}`);
      }
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      const config = await this.configService.getConfig();
      this.logger.debug('加载到的配置:', config);
      
      if (!this.elements.syncType) {
        this.logger.error('同步类型选择器未找到');
        return;
      }

      // 设置表单值
      this.elements.syncType.value = config.syncType === 'repo' ? 'repository' : 'gist';
      if (this.elements.token) this.elements.token.value = config.gitConfig.token || '';
      if (this.elements.owner) this.elements.owner.value = config.gitConfig.owner || '';
      if (this.elements.repo) this.elements.repo.value = config.gitConfig.repo || '';
      if (this.elements.branch) this.elements.branch.value = config.gitConfig.branch || 'main';
      if (this.elements.gistId) this.elements.gistId.value = config.gitConfig.gistId || '';
      if (this.elements.autoSync) this.elements.autoSync.checked = config.autoSync;
      if (this.elements.syncInterval) this.elements.syncInterval.value = config.syncInterval.toString();

      this.updateVisibility(config.syncType);
    } catch (error) {
      this.logger.error('加载配置失败:', error);
      this.toast.error('加载配置失败');
    }
  }

  private bindEvents(): void {
    if (!this.form) return;

    // 同步类型切换事件
    this.elements.syncType?.addEventListener('change', (event) => {
      const value = (event.target as HTMLSelectElement).value;
      const syncType = value === 'repository' ? 'repo' : 'gist';
      this.updateVisibility(syncType);
    });

    // 保存按钮点击事件
    this.form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await this.saveSettings();
    });

    // 保存按钮点击事件（备用）
    this.elements.saveBtn?.addEventListener('click', async () => {
      await this.saveSettings();
    });

    // 测试按钮点击事件
    this.elements.testBtn?.addEventListener('click', async () => {
      await this.testConnection();
    });
  }

  private updateVisibility(syncType: 'gist' | 'repo'): void {
    if (!this.form) return;

    const repoFields = this.form.querySelectorAll('.repo-field');
    const gistFields = this.form.querySelectorAll('.gist-field');

    if (syncType === 'repo') {
      repoFields.forEach(field => (field as HTMLElement).style.display = 'block');
      gistFields.forEach(field => (field as HTMLElement).style.display = 'none');
    } else {
      repoFields.forEach(field => (field as HTMLElement).style.display = 'none');
      gistFields.forEach(field => (field as HTMLElement).style.display = 'block');
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      if (!this.form) {
        throw new Error('表单未初始化');
      }

      this.logger.debug('开始保存设置...');
      
      const syncTypeValue = this.elements.syncType?.value;
      if (!syncTypeValue) {
        throw new Error('同步类型未选择');
      }

      const syncType = syncTypeValue === 'repository' ? 'repo' : 'gist';
      
      const config: Partial<SyncConfig> = {
        syncType,
        autoSync: this.elements.autoSync?.checked || false,
        syncInterval: parseInt(this.elements.syncInterval?.value || '60', 10),
        gitConfig: {
          token: this.elements.token?.value || '',
          owner: this.elements.owner?.value || '',
          repo: this.elements.repo?.value || '',
          branch: this.elements.branch?.value || 'main',
          gistId: this.elements.gistId?.value || ''
        }
      };

      this.logger.debug('准备保存的配置:', config);
      await this.configService.saveConfig(config);
      
      // 重新加载配置以验证
      await this.loadConfig();
      
      this.toast.success('设置已保存');
    } catch (error) {
      this.logger.error('保存设置失败:', error);
      this.toast.error('保存设置失败: ' + (error as Error).message);
    }
  }

  private async testConnection(): Promise<void> {
    try {
      const token = this.elements.token?.value;
      if (!token) {
        this.toast.error('请输入GitHub Token');
        return;
      }

      if (!this.elements.testBtn) {
        throw new Error('测试按钮未找到');
      }

      this.elements.testBtn.disabled = true;
      this.toast.info('正在测试连接...', { duration: 1000 });

      await this.githubService.authenticate();
      
      setTimeout(() => {
        this.toast.success('连接测试成功', { duration: 2000 });
        if (this.elements.testBtn) {
          this.elements.testBtn.disabled = false;
        }
      }, 1000);
    } catch (error) {
      if (this.elements.testBtn) {
        this.elements.testBtn.disabled = false;
      }
      this.logger.error('连接测试失败:', error);
      this.toast.error('连接测试失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }
}

// 初始化设置页面
document.addEventListener('DOMContentLoaded', () => {
  new SettingsPage();
}); 