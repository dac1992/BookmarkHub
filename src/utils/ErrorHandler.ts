import { Toast } from '../components/Toast';
import { Notification } from '../components/Notification';
import { ErrorLogService } from '../services/ErrorLogService';

export class ErrorHandler {
  private toast: Toast;
  private notification: Notification;
  private errorLogService: ErrorLogService;

  constructor() {
    this.toast = new Toast();
    this.notification = new Notification();
    this.errorLogService = new ErrorLogService();
  }

  /**
   * 处理错误
   */
  async handleError(error: unknown, context: string): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${context}] 错误:`, error);

    // 记录错误
    const errorId = await this.errorLogService.logError(error, context);

    // 根据错误类型显示不同的提示
    if (error instanceof NetworkError) {
      this.toast.error('网络连接失败，请检查网络');
    } else if (error instanceof AuthError) {
      this.notification.show(
        '认证失败',
        '请检查访问令牌是否正确，点击前往设置',
        {
          onClick: () => {
            window.location.href = 'settings.html';
          }
        }
      );
    } else if (error instanceof SyncError) {
      this.notification.show('同步失败', errorMessage, {
        duration: 0,
        onClick: () => {
          window.location.href = `error-details.html?id=${errorId}`;
        }
      });
    } else {
      this.toast.error(errorMessage);
    }
  }

  /**
   * 显示错误详情
   */
  private showErrorDetails(error: SyncError): void {
    // TODO: 实现错误详情页面
    console.log('显示错误详情:', error);
  }
}

// 自定义错误类型
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class SyncError extends Error {
  constructor(
    message: string,
    public readonly details: any,
    public readonly timestamp: number = Date.now()
  ) {
    super(message);
    this.name = 'SyncError';
  }
} 