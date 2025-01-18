import { BookmarkService } from '../services/BookmarkService';
import { GitService } from '../services/GitService';
import { HistoryManager } from '../services/HistoryManager';
import { theme } from './styles/theme';
import { SyncStatusService } from '../services/SyncStatusService';
import { Toast } from '../components/Toast';
import './styles/popup.css';

class PopupManager {
  private bookmarksList: HTMLElement | null = null;
  private syncStatusService: SyncStatusService;

  constructor(
    private bookmarkService: BookmarkService,
    private gitService: GitService,
    private historyManager: HistoryManager
  ) {
    this.syncStatusService = new SyncStatusService();
  }

  /**
   * 初始化弹出窗口
   */
  async init(): Promise<void> {
    this.bookmarksList = document.querySelector('.bookmarks-list');
    await this.renderBookmarks();
    this.bindEvents();
    this.updateSyncStatus();
  }

  /**
   * 渲染书签列表
   */
  private async renderBookmarks(): Promise<void> {
    if (!this.bookmarksList) return;

    const bookmarks = await this.bookmarkService.getAllBookmarks();
    this.bookmarksList.innerHTML = bookmarks.map(bookmark => `
      <div class="bookmark-item" data-id="${bookmark.id}">
        <img class="bookmark-icon" src="${this.getFavicon(bookmark.url)}" alt="">
        <span class="bookmark-title">${bookmark.title}</span>
      </div>
    `).join('');
  }

  /**
   * 获取网站图标
   */
  private getFavicon(url?: string): string {
    if (!url) return 'assets/folder-icon.png';
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}`;
  }

  /**
   * 绑定事件处理
   */
  private bindEvents(): void {
    // 同步按钮
    document.getElementById('syncNowBtn')?.addEventListener('click', () => {
      this.handleSync();
    });

    // 历史记录按钮
    document.getElementById('viewHistoryBtn')?.addEventListener('click', () => {
      this.showHistory();
    });

    // 设置按钮
    document.getElementById('settingsBtn')?.addEventListener('click', () => {
      this.showSettings();
    });

    // 历史记录按钮
    document.getElementById('historyBtn')?.addEventListener('click', () => {
      window.location.href = 'history.html';
    });
  }

  /**
   * 更新同步状态
   */
  private async updateSyncStatus(): Promise<void> {
    const statusText = document.querySelector('.status-text');
    const statusIcon = document.querySelector('.status-icon');
    if (!statusText || !statusIcon) return;

    const status = await this.syncStatusService.getStatus();
    const lastSyncText = await this.syncStatusService.getLastSyncText();

    statusText.textContent = `上次同步: ${lastSyncText}`;
    
    // 更新状态图标
    statusIcon.className = 'status-icon';
    switch (status.status) {
      case 'success':
        statusIcon.classList.add('success');
        break;
      case 'error':
        statusIcon.classList.add('error');
        break;
      case 'syncing':
        statusIcon.classList.add('syncing');
        break;
    }

    // 如果有错误，显示错误信息
    if (status.error) {
      const toast = new Toast();
      toast.error(status.error);
    }
  }

  /**
   * 处理同步操作
   */
  private async handleSync(): Promise<void> {
    try {
      const syncBtn = document.getElementById('syncNowBtn');
      if (syncBtn instanceof HTMLButtonElement) {
        syncBtn.disabled = true;
        syncBtn.textContent = '同步中...';
      }

      const bookmarks = await this.bookmarkService.getAllBookmarks();
      await this.gitService.uploadBookmarks(bookmarks);
      
      this.updateSyncStatus();
    } catch (error) {
      console.error('同步失败:', error);
      const toast = new Toast();
      toast.error('同步失败，请重试');
    } finally {
      const syncBtn = document.getElementById('syncNowBtn');
      if (syncBtn instanceof HTMLButtonElement) {
        syncBtn.disabled = false;
        syncBtn.textContent = '立即同步';
      }
    }
  }

  /**
   * 显示历史记录
   */
  private async showHistory(): Promise<void> {
    // TODO: 实现历史记录页面
  }

  /**
   * 显示设置页面
   */
  private showSettings(): void {
    // TODO: 实现设置页面
  }
} 