import { Logger } from '../utils/logger';
import { ConfigService } from '../services/ConfigService';

class DebugPage {
  constructor() {
    this.configService = ConfigService.getInstance();
    this.logger = Logger.getInstance();
    this.logHistory = [];
    this.maxLogHistory = 100; // 最多保存100条日志
    this.loggedConfigUpdates = new Set(); // 用于跟踪已记录的配置更新
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
    // 监听配置更新消息
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'configUpdated' && message.config) {
        const key = `${message.config._timestamp || Date.now()}`;
        if (!this.loggedConfigUpdates.has(key)) {
          this.loggedConfigUpdates.add(key);
          this.log('配置已更新');
          this.log('配置内容: ' + JSON.stringify(message.config, null, 2));
        }
      }
    });

    // 监听storage变化
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        // 处理配置更新
        if (changes[ConfigService.STORAGE_KEY]) {
          const { newValue } = changes[ConfigService.STORAGE_KEY];
          if (newValue) {
            const key = `${newValue._timestamp || Date.now()}`;
            if (!this.loggedConfigUpdates.has(key)) {
              this.loggedConfigUpdates.add(key);
              this.log('配置已更新');
              this.log('配置内容: ' + JSON.stringify(this.sanitizeConfig(newValue), null, 2));
            }
          }
        }
      }
    });

    // 保存配置
    const form = document.getElementById('configForm');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const config = this.getFormConfig();
          // 先记录日志
          this.log('正在保存配置...');
          this.log('配置内容: ' + JSON.stringify(this.sanitizeConfig(config), null, 2));
          
          // 然后保存配置
          await this.configService.saveConfig(config);
          this.log('配置已保存');
          
          // 更新显示
          this.updateDisplay(config);
        } catch (error) {
          this.log('保存配置失败: ' + error.message, 'error');
          console.error('保存配置失败:', error);
        }
      });
    }

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

    // 页面关闭前保存日志
    window.addEventListener('beforeunload', () => {
      this.saveLogHistory();
    });

    // 页面加载时恢复日志
    this.loadLogHistory();
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
      }
    };

    return config;
  }

  sanitizeConfig(config) {
    if (!config) return {};
    // 创建配置的深拷贝
    const sanitized = JSON.parse(JSON.stringify(config));
    
    // 移除不必要的字段
    delete sanitized._version;
    delete sanitized._timestamp;
    
    // 如果有token，替换为占位符
    if (sanitized.gitConfig?.token) {
      sanitized.gitConfig.token = '********';
    }
    
    return sanitized;
  }

  log(message, type = 'info') {
    if (!this.elements.logContainer) return;
    
    const time = new Date().toLocaleTimeString();
    const logEntry = {
      id: Date.now().toString(),
      time,
      message,
      type
    };
    
    // 添加到日志历史
    this.logHistory.push(logEntry);
    
    // 限制日志历史大小
    if (this.logHistory.length > this.maxLogHistory) {
      this.logHistory.shift();
    }
    
    // 显示到页面
    this.appendLogEntry(logEntry);
    
    // 保存到localStorage
    this.saveLogHistory();
    
    // 同时输出到控制台
    console.log(`[${type}] ${message}`);
  }

  appendLogEntry(entry) {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${entry.type}`;
    logEntry.dataset.id = entry.id;
    logEntry.textContent = `[${entry.time}] ${entry.message}`;
    this.elements.logContainer?.appendChild(logEntry);
    this.elements.logContainer.scrollTop = this.elements.logContainer.scrollHeight;
  }

  saveLogHistory() {
    try {
      // 保存前去重，使用id作为唯一标识
      const uniqueLogs = Array.from(
        new Map(this.logHistory.map(log => [log.id, log])).values()
      );
      localStorage.setItem('debug_log_history', JSON.stringify(uniqueLogs));
    } catch (error) {
      console.error('保存日志历史失败:', error);
    }
  }

  loadLogHistory() {
    try {
      const savedHistory = localStorage.getItem('debug_log_history');
      if (savedHistory && this.elements.logContainer) {
        // 清空现有日志显示
        this.elements.logContainer.innerHTML = '';
        
        // 解析并去重日志
        const history = JSON.parse(savedHistory);
        const uniqueLogs = Array.from(
          new Map(history.map(log => [log.id, log])).values()
        ).sort((a, b) => parseInt(a.id) - parseInt(b.id)); // 确保正确比较数字
        
        // 更新日志历史
        this.logHistory = uniqueLogs;
        
        // 显示日志
        uniqueLogs.forEach(entry => {
          this.appendLogEntry(entry);
        });
      }
    } catch (error) {
      console.error('加载日志历史失败:', error);
    }
  }

  updateDisplay(config) {
    if (!config) return;

    // 更新配置显示
    if (this.elements.currentConfig) {
      this.elements.currentConfig.textContent = JSON.stringify(this.sanitizeConfig(config), null, 2);
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
      const config = await this.configService.getConfig();
      
      if (config) {
        this.log('已加载配置');
        this.log('配置内容: ' + JSON.stringify(this.sanitizeConfig(config), null, 2));
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