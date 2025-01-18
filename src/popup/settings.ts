import { ConfigService } from '../services/ConfigService';
import { Toast } from '../components/Toast';

export class SettingsPage {
  private configService: ConfigService;
  private toast: Toast;

  constructor() {
    this.configService = new ConfigService();
    this.toast = new Toast();
  }

  async init(): Promise<void> {
    await this.loadSettings();
    this.bindEvents();
  }

  private async loadSettings(): Promise<void> {
    const config = await this.configService.getConfig();
    
    // 填充表单
    const platformSelect = document.getElementById('platform') as HTMLSelectElement;
    const tokenInput = document.getElementById('token') as HTMLInputElement;
    const ownerInput = document.getElementById('owner') as HTMLInputElement;
    const repoInput = document.getElementById('repo') as HTMLInputElement;
    const branchInput = document.getElementById('branch') as HTMLInputElement;
    const intervalInput = document.getElementById('interval') as HTMLInputElement;

    if (platformSelect) platformSelect.value = config.syncPlatform;
    if (tokenInput) tokenInput.value = config.gitConfig.token;
    if (ownerInput) ownerInput.value = config.gitConfig.owner;
    if (repoInput) repoInput.value = config.gitConfig.repo;
    if (branchInput) branchInput.value = config.gitConfig.branch;
    if (intervalInput) intervalInput.value = String(config.autoSyncInterval / 60000);
  }

  private bindEvents(): void {
    const form = document.getElementById('settingsForm');
    form?.addEventListener('submit', this.handleSubmit.bind(this));
  }

  private async handleSubmit(event: Event): Promise<void> {
    event.preventDefault();

    try {
      const formData = new FormData(event.target as HTMLFormElement);
      await this.configService.updateConfig({
        syncPlatform: formData.get('platform') as 'github' | 'gitee',
        autoSyncInterval: Number(formData.get('interval')) * 60000,
        gitConfig: {
          token: formData.get('token') as string,
          owner: formData.get('owner') as string,
          repo: formData.get('repo') as string,
          branch: formData.get('branch') as string
        }
      });

      this.toast.success('设置已保存');
    } catch (error) {
      console.error('保存设置失败:', error);
      this.toast.error('保存设置失败');
    }
  }
}

// 初始化设置页面
const settingsPage = new SettingsPage();
settingsPage.init().catch(console.error); 