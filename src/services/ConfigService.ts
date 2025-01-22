import { Logger } from '../utils/logger';

export interface SyncConfig {
  syncType: 'gist' | 'repo';
  syncInterval: number; // 同步间隔（分钟）
  autoSync: boolean;
  gitConfig: {
    token: string;
    gistId?: string;
    owner?: string;
    repo?: string;
    branch?: string;
  };
  lastSyncTime?: number;
  deviceId?: string;
}

const DEFAULT_CONFIG: SyncConfig = {
  syncType: 'gist',
  syncInterval: 60,
  autoSync: false,
  gitConfig: {
    token: '',
  }
};

export class ConfigService {
  private static instance: ConfigService;
  private logger: Logger;
  private readonly CONFIG_KEY = 'sync_config';

  private constructor() {
    this.logger = Logger.getInstance();
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  public async getConfig(): Promise<SyncConfig> {
    try {
      const result = await chrome.storage.sync.get(this.CONFIG_KEY);
      return result[this.CONFIG_KEY] || DEFAULT_CONFIG;
    } catch (error) {
      this.logger.error('获取配置失败:', error);
      return DEFAULT_CONFIG;
    }
  }

  public async updateConfig(partialConfig: Partial<SyncConfig>): Promise<void> {
    try {
      const currentConfig = await this.getConfig();
      const newConfig = {
        ...currentConfig,
        ...partialConfig,
        gitConfig: {
          ...currentConfig.gitConfig,
          ...partialConfig.gitConfig
        }
      };
      
      await chrome.storage.sync.set({ [this.CONFIG_KEY]: newConfig });
      this.logger.info('配置更新成功');
    } catch (error) {
      this.logger.error('更新配置失败:', error);
      throw error;
    }
  }

  public async validateConfig(): Promise<string[]> {
    const config = await this.getConfig();
    const errors: string[] = [];

    if (!config.gitConfig.token) {
      errors.push('GitHub Token未设置');
    }

    if (config.syncType === 'repo') {
      if (!config.gitConfig.owner) {
        errors.push('仓库所有者未设置');
      }
      if (!config.gitConfig.repo) {
        errors.push('仓库名称未设置');
      }
      if (!config.gitConfig.branch) {
        errors.push('仓库分支未设置');
      }
    }

    return errors;
  }

  public async clearConfig(): Promise<void> {
    try {
      await chrome.storage.sync.remove(this.CONFIG_KEY);
      this.logger.info('配置已清除');
    } catch (error) {
      this.logger.error('清除配置失败:', error);
      throw error;
    }
  }

  public async getDeviceId(): Promise<string> {
    const config = await this.getConfig();
    if (!config.deviceId) {
      const deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      await this.updateConfig({ deviceId });
      return deviceId;
    }
    return config.deviceId;
  }
} 