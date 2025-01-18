import { ErrorLogService } from '../services/ErrorLogService';
import { ErrorLog } from '../types/error';
import { Toast } from '../components/Toast';

class ErrorLogsPage {
  private errorLogService: ErrorLogService;
  private toast: Toast;
  private container: HTMLElement | null = null;

  constructor() {
    this.errorLogService = new ErrorLogService();
    this.toast = new Toast();
  }

  async init(): Promise<void> {
    this.container = document.querySelector('.error-logs');
    this.bindEvents();
    await this.loadErrorLogs();
  }

  private bindEvents(): void {
    // 返回按钮
    document.getElementById('backBtn')?.addEventListener('click', () => {
      window.history.back();
    });

    // 清除按钮
    document.getElementById('clearBtn')?.addEventListener('click', async () => {
      if (confirm('确定要清除所有错误日志吗？')) {
        await this.clearErrorLogs();
      }
    });
  }

  private async loadErrorLogs(): Promise<void> {
    if (!this.container) return;

    const logs = await this.errorLogService.getLogs();
    
    if (logs.length === 0) {
      this.showEmptyState();
      return;
    }

    this.container.innerHTML = logs.map(log => this.renderErrorLogItem(log)).join('');

    // 绑定点击事件
    this.container.querySelectorAll('.error-log-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        const errorId = logs[index].id;
        window.location.href = `error-details.html?id=${errorId}`;
      });
    });
  }

  private renderErrorLogItem(log: ErrorLog): string {
    return `
      <div class="error-log-item">
        <div class="error-log-header">
          <div class="error-log-type">${log.name}</div>
          <div class="error-log-time">${new Date(log.timestamp).toLocaleString()}</div>
        </div>
        <div class="error-log-message">${log.message}</div>
        <div class="error-log-context">${log.context}</div>
      </div>
    `;
  }

  private showEmptyState(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <!-- 空状态图标 SVG -->
        </div>
        <div class="empty-state-text">暂无错误日志</div>
        <div class="empty-state-subtext">太棒了！一切正常运行</div>
      </div>
    `;
  }

  private async clearErrorLogs(): Promise<void> {
    try {
      await this.errorLogService.clearLogs();
      this.toast.success('错误日志已清除');
      await this.loadErrorLogs();
    } catch (error) {
      console.error('清除错误日志失败:', error);
      this.toast.error('清除失败，请重试');
    }
  }
}

// 初始化错误日志列表页面
const errorLogsPage = new ErrorLogsPage();
errorLogsPage.init().catch(console.error); 