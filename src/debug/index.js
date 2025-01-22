import { Logger } from '../utils/logger';
import { ConfigService } from '../services/ConfigService';

class DebugPage {
  constructor() {
    this.initElements();
    this.bindEvents();
    this.loadConfig().catch(error => {
      console.error('初始化加载配置失败:', error);
    });
  }

  initElements() {
    this.elements = {
      currentConfig: document.getElementById('currentConfig'),
      logContainer: document.getElementById('logContainer'),
      configForm: document.getElementById('configForm'),
      syncType: document.getElementById('syncType'),
      githubToken: document.getElementById('githubToken'),
      repoOwner: document.getElementById('repoOwner'),
      repoName: document.getElementById('repoName'),
      repoBranch: document.getElementById('repoBranch'),
      gistId: document.getElementById('gistId'),
      syncInterval: document.getElementById('syncInterval'),
      autoSync: document.getElementById('autoSync')
    };

    // 初始触发一次同步类型变更事件
    this.elements.syncType?.dispatchEvent(new Event('change'));
  }

  bindEvents() {
    // 监听配置变化
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes['synctags_config']) {
        const { newValue, oldValue } = changes['synctags_config'];
        if (newValue) {
          this.log('配置已更新');
          this.log('旧配置: ' + JSON.stringify(oldValue, null, 2));
          this.log('新配置: ' + JSON.stringify(newValue, null, 2));
          this.updateDisplay(newValue);
        }
      }
    });

    // 保存配置
    this.elements.configForm?.addEventListener('submit', async (e) => {
      e.preventDefault();

      try {
        const config = this.getFormConfig();
        this.log('正在保存配置...');
        this.log('配置内容: ' + JSON.stringify(config, null, 2));

        await chrome.storage.local.set({ 'synctags_config': config });
        this.log('配置已保存');
        this.updateDisplay(config);
      } catch (error) {
        this.log('保存配置失败: ' + error.message, 'error');
        console.error('保存配置失败:', error);
      }
    });

    // 根据同步类型显示/隐藏字段
    this.elements.syncType?.addEventListener('change', () => {
      const isRepo = this.elements.syncType.value === 'repository';
      document.querySelectorAll('.repo-field').forEach(el => {
        el.style.display = isRepo ? 'block' : 'none';
      });
      document.querySelectorAll('.gist-field').forEach(el => {
        el.style.display = isRepo ? 'none' : 'block';
      });
    });

    // 限制同步间隔只能输入数字
    this.elements.syncInterval?.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });
  }

  getFormConfig() {
    const config = {
      syncType: this.elements.syncType?.value === 'repository' ? 'repo' : 'gist',
      syncInterval: Math.max(1, parseInt(this.elements.syncInterval?.value || '60', 10)),
      autoSync: this.elements.autoSync?.checked || false,
      gitConfig: {
        token: this.elements.githubToken?.value || '',
        owner: this.elements.repoOwner?.value || '',
        repo: this.elements.repoName?.value || '',
        branch: this.elements.repoBranch?.value || 'main',
        gistId: this.elements.gistId?.value || ''
      },
      _timestamp: Date.now()
    };

    // 验证配置
    const errors = this.validateConfig(config);
    if (errors.length > 0) {
      this.log('配置验证警告:', 'warn');
      errors.forEach(error => this.log('- ' + error, 'warn'));
    }

    return config;
  }

  validateConfig(config) {
    const errors = [];

    if (!config.gitConfig.token.trim()) {
      errors.push('GitHub Token未设置');
    }

    if (config.syncType === 'repo') {
      if (!config.gitConfig.owner.trim()) {
        errors.push('仓库所有者未设置');
      }
      if (!config.gitConfig.repo.trim()) {
        errors.push('仓库名称未设置');
      }
    }

    if (config.syncInterval < 1) {
      errors.push('同步间隔必须大于0');
    }

    return errors;
  }

  log(message, type = 'info') {
    if (!this.elements.logContainer) return;
    
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${time}] ${message}`;
    this.elements.logContainer.appendChild(entry);
    this.elements.logContainer.scrollTop = this.elements.logContainer.scrollHeight;
    
    // 同时输出到控制台
    console.log(`[${type}] ${message}`);
  }

  updateDisplay(config) {
    if (!config) return;

    // 更新配置显示
    if (this.elements.currentConfig) {
      this.elements.currentConfig.textContent = JSON.stringify(config, null, 2);
    }

    // 更新表单
    if (this.elements.syncType) {
      this.elements.syncType.value = config.syncType === 'repo' ? 'repository' : 'gist';
      this.elements.syncType.dispatchEvent(new Event('change'));
    }
    if (this.elements.githubToken) {
      this.elements.githubToken.value = config.gitConfig?.token || '';
    }
    if (this.elements.repoOwner) {
      this.elements.repoOwner.value = config.gitConfig?.owner || '';
    }
    if (this.elements.repoName) {
      this.elements.repoName.value = config.gitConfig?.repo || '';
    }
    if (this.elements.repoBranch) {
      this.elements.repoBranch.value = config.gitConfig?.branch || 'main';
    }
    if (this.elements.gistId) {
      this.elements.gistId.value = config.gitConfig?.gistId || '';
    }
    if (this.elements.autoSync) {
      this.elements.autoSync.checked = config.autoSync || false;
    }
    if (this.elements.syncInterval) {
      this.elements.syncInterval.value = config.syncInterval?.toString() || '60';
    }
  }

  async loadConfig() {
    try {
      this.log('正在加载配置...');
      const result = await chrome.storage.local.get('synctags_config');
      const config = result.synctags_config;
      
      if (config) {
        this.log('已加载配置');
        this.log('配置内容: ' + JSON.stringify(config, null, 2));
        this.updateDisplay(config);
      } else {
        this.log('未找到已保存的配置');
      }
    } catch (error) {
      this.log('加载配置失败: ' + error.message, 'error');
      console.error('加载配置失败:', error);
    }
  }
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
  window.debugPage = new DebugPage();
}); 