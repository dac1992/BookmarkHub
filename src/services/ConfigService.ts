interface Config {
  syncPlatform: 'github' | 'gitee';
  autoSyncInterval: number;
  encryptionKey: string;
  gitConfig: {
    token: string;
    owner: string;
    repo: string;
    branch: string;
  };
}

export class ConfigService {
  private readonly storageKey = 'config';
  private config: Config = {
    syncPlatform: 'gitee',
    autoSyncInterval: 5 * 60 * 1000,
    encryptionKey: '',
    gitConfig: {
      token: '',
      owner: 'dchub',
      repo: 'sync-tags',
      branch: 'main'
    }
  };

  async getConfig(): Promise<Config> {
    await this.loadConfig();
    return this.config;
  }

  async updateConfig(newConfig: Partial<Config>): Promise<void> {
    this.config = {
      ...this.config,
      ...newConfig
    };
    await chrome.storage.local.set({ [this.storageKey]: this.config });
  }

  private async loadConfig(): Promise<void> {
    const result = await chrome.storage.local.get(this.storageKey);
    if (result[this.storageKey]) {
      this.config = { ...this.config, ...result[this.storageKey] };
    }
  }
} 