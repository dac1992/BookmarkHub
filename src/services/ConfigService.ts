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
    gistId: '',
    owner: '',
    repo: '',
    branch: 'main'
  },
  lastSyncTime: 0,
  deviceId: ''
};

export class ConfigService {
  private static readonly STORAGE_KEY = 'synctags_config';
  private static readonly CONFIG_VERSION = '1.0.0';
  private static instance: ConfigService;
  private logger: Logger;

  private constructor() {
    this.logger = Logger.getInstance();
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  public async saveConfig(config: Partial<SyncConfig>): Promise<void> {
    try {
      this.logger.debug('开始保存配置...', config);
      
      // 获取当前配置
      const currentConfig = await this.getConfig();
      
      // 合并配置
      const mergedConfig = {
        ...currentConfig,
        ...config,
        gitConfig: {
          ...currentConfig.gitConfig,
          ...(config.gitConfig || {})
        }
      };
      
      // 验证配置
      const errors = await this.validateConfig(mergedConfig);
      if (errors.length > 0) {
        this.logger.warn('配置验证警告:', errors);
      }

      // 添加元数据
      const fullConfig = {
        ...mergedConfig,
        _version: ConfigService.CONFIG_VERSION,
        _timestamp: Date.now()
      };

      // 保存到 local storage
      await new Promise<void>((resolve, reject) => {
        chrome.storage.local.set({ [ConfigService.STORAGE_KEY]: fullConfig }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(`配置保存失败: ${chrome.runtime.lastError.message}`));
            return;
          }
          this.logger.debug('配置保存成功:', fullConfig);
          resolve();
        });
      });
    } catch (error) {
      this.logger.error('保存配置失败:', error);
      throw error;
    }
  }

  public async getConfig(): Promise<SyncConfig> {
    try {
      this.logger.debug('从storage加载配置...');
      
      const result = await new Promise<{ [key: string]: any }>((resolve, reject) => {
        chrome.storage.local.get(ConfigService.STORAGE_KEY, (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(`配置加载失败: ${chrome.runtime.lastError.message}`));
            return;
          }
          resolve(result);
        });
      });

      const savedConfig = result[ConfigService.STORAGE_KEY];
      
      if (savedConfig) {
        this.logger.debug('找到已保存的配置');
        // 验证并规范化配置
        const normalizedConfig = this.normalizeConfig(savedConfig);
        return normalizedConfig;
      }

      this.logger.info('未找到已保存的配置，使用默认配置');
      return { ...DEFAULT_CONFIG };
    } catch (error) {
      this.logger.error('加载配置失败:', error);
      return { ...DEFAULT_CONFIG };
    }
  }

  private normalizeConfig(config: Partial<SyncConfig>): SyncConfig {
    // 确保所有必需字段都存在
    const normalized: SyncConfig = {
      ...DEFAULT_CONFIG,
      ...config,
      gitConfig: {
        ...DEFAULT_CONFIG.gitConfig,
        ...(config.gitConfig || {})
      }
    };

    // 类型转换和验证
    normalized.syncInterval = Math.max(1, Number(normalized.syncInterval) || DEFAULT_CONFIG.syncInterval);
    normalized.autoSync = Boolean(normalized.autoSync);
    
    // 确保 deviceId
    if (!normalized.deviceId) {
      normalized.deviceId = this.generateDeviceId();
    }

    return normalized;
  }

  public async validateConfig(config: SyncConfig): Promise<string[]> {
    const errors: string[] = [];

    // 验证必需字段
    if (!config.gitConfig?.token?.trim()) {
      errors.push('GitHub Token未设置');
    }

    // 根据同步类型验证
    if (config.syncType === 'repo') {
      if (!config.gitConfig?.owner?.trim()) {
        errors.push('仓库所有者未设置');
      }
      if (!config.gitConfig?.repo?.trim()) {
        errors.push('仓库名称未设置');
      }
    }

    // 验证数值字段
    if (typeof config.syncInterval !== 'number' || config.syncInterval < 1) {
      errors.push('同步间隔必须大于0');
    }

    return errors;
  }

  private generateDeviceId(): string {
    return `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  public async clearConfig(): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        chrome.storage.local.remove(ConfigService.STORAGE_KEY, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(`清除配置失败: ${chrome.runtime.lastError.message}`));
            return;
          }
          resolve();
        });
      });
      this.logger.info('配置已清除');
    } catch (error) {
      this.logger.error('清除配置失败:', error);
      throw error;
    }
  }

  public async getDeviceId(): Promise<string> {
    const config = await this.getConfig();
    if (!config.deviceId) {
      const deviceId = this.generateDeviceId();
      await this.saveConfig({ deviceId });
      return deviceId;
    }
    return config.deviceId;
  }
} 