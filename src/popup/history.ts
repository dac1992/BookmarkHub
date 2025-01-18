import { HistoryManager } from '../services/HistoryManager';
import { RollbackManager } from '../services/RollbackManager';
import { HistoryEntry } from '../types/history';
import { Toast } from '../components/Toast';

class HistoryPage {
  private historyManager: HistoryManager;
  private rollbackManager: RollbackManager;
  private toast: Toast;
  private container: HTMLElement | null = null;

  constructor() {
    this.historyManager = new HistoryManager();
    this.rollbackManager = new RollbackManager(this.historyManager);
    this.toast = new Toast();
  }

  async init(): Promise<void> {
    this.container = document.querySelector('.history-list');
    this.bindEvents();
    await this.loadHistory();
  }

  private bindEvents(): void {
    // 返回按钮
    document.getElementById('backBtn')?.addEventListener('click', () => {
      window.history.back();
    });

    // 清除按钮
    document.getElementById('clearBtn')?.addEventListener('click', async () => {
      if (confirm('确定要清除所有历史记录吗？')) {
        await this.clearHistory();
      }
    });
  }

  private async loadHistory(): Promise<void> {
    if (!this.container) return;

    const history = await this.historyManager.getHistory();
    
    if (history.length === 0) {
      this.showEmptyState();
      return;
    }

    this.container.innerHTML = history.map(entry => this.renderHistoryItem(entry)).join('');

    // 绑定回滚按钮事件
    this.container.querySelectorAll('.rollback-btn').forEach((btn) => {
      const historyId = btn.getAttribute('data-id');
      if (historyId) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleRollback(historyId);
        });
      }
    });
  }

  private renderHistoryItem(entry: HistoryEntry): string {
    const canRollback = entry.status === 'success' && entry.operation.previousState;
    const timestamp = new Date(entry.timestamp).toLocaleString();

    return `
      <div class="history-item ${entry.status}">
        <div class="history-header">
          <div class="history-type">${entry.operation.type}</div>
          <div class="history-time">${timestamp}</div>
        </div>
        <div class="history-content">
          <div class="history-title">${entry.operation.bookmark.title}</div>
          <div class="history-details">
            ${entry.operation.bookmark.url || '文件夹'}
          </div>
        </div>
        ${entry.error ? `
          <div class="history-error">
            ${entry.error}
          </div>
        ` : ''}
        ${canRollback ? `
          <div class="history-actions">
            <button class="history-action-btn rollback rollback-btn" data-id="${entry.id}">
              回滚此操作
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  private async handleRollback(historyId: string): Promise<void> {
    try {
      const canRollback = await this.rollbackManager.canRollback(historyId);
      if (!canRollback) {
        this.toast.error('无法回滚此操作');
        return;
      }

      const result = await this.rollbackManager.rollbackTo(historyId);
      if (result.success) {
        this.toast.success('回滚成功');
        await this.loadHistory(); // 重新加载历史记录
      } else {
        this.toast.error(result.error || '回滚失败');
      }
    } catch (error) {
      console.error('回滚失败:', error);
      this.toast.error('回滚失败，请重试');
    }
  }

  private async clearHistory(): Promise<void> {
    try {
      await this.historyManager.clearHistory();
      this.toast.success('历史记录已清除');
      await this.loadHistory();
    } catch (error) {
      console.error('清除历史记录失败:', error);
      this.toast.error('清除失败，请重试');
    }
  }

  private showEmptyState(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="currentColor">
            <path d="M24 4C12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20S35.05 4 24 4zm0 36c-8.82 0-16-7.18-16-16S15.18 8 24 8s16 7.18 16 16-7.18 16-16 16zm-2-26h4v12h-4V14zm0 16h4v4h-4v-4z"/>
          </svg>
        </div>
        <div class="empty-state-text">暂无历史记录</div>
        <div class="empty-state-subtext">您的操作历史将显示在这里</div>
      </div>
    `;
  }
}

// 初始化历史记录页面
const historyPage = new HistoryPage();
historyPage.init().catch(console.error); 