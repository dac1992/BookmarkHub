import { Toast } from '../components/Toast';

class ErrorDetailsPage {
  private toast: Toast;

  constructor() {
    this.toast = new Toast();
  }

  async init(): Promise<void> {
    this.bindEvents();
    await this.loadErrorDetails();
  }

  private bindEvents(): void {
    document.getElementById('backBtn')?.addEventListener('click', () => {
      window.history.back();
    });
  }

  private async loadErrorDetails(): Promise<void> {
    // 从URL参数获取错误ID
    const params = new URLSearchParams(window.location.search);
    const errorId = params.get('id');

    if (!errorId) {
      this.toast.error('未找到错误信息');
      return;
    }

    // TODO: 从存储中加载错误详情
  }
}

// 初始化错误详情页面
const errorDetailsPage = new ErrorDetailsPage();
errorDetailsPage.init().catch(console.error); 