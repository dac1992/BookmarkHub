type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  duration?: number;
  position?: 'top' | 'bottom';
}

export class Toast {
  private container: HTMLElement;
  private queue: HTMLElement[] = [];
  private readonly defaultOptions: Required<ToastOptions> = {
    duration: 3000,
    position: 'top'
  };

  constructor() {
    this.container = this.createContainer();
    document.body.appendChild(this.container);
  }

  /**
   * 显示成功提示
   */
  success(message: string, options?: ToastOptions): void {
    this.show(message, 'success', options);
  }

  /**
   * 显示错误提示
   */
  error(message: string, options?: ToastOptions): void {
    this.show(message, 'error', options);
  }

  /**
   * 显示警告提示
   */
  warning(message: string, options?: ToastOptions): void {
    this.show(message, 'warning', options);
  }

  /**
   * 显示信息提示
   */
  info(message: string, options?: ToastOptions): void {
    this.show(message, 'info', options);
  }

  private show(message: string, type: ToastType, options?: ToastOptions): void {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const toast = this.createToast(message, type);
    
    this.container.appendChild(toast);
    this.queue.push(toast);

    // 动画效果
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // 自动移除
    setTimeout(() => {
      this.removeToast(toast);
    }, mergedOptions.duration);
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'toast-container';
    return container;
  }

  private createToast(message: string, type: ToastType): HTMLElement {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    return toast;
  }

  private removeToast(toast: HTMLElement): void {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => {
      toast.remove();
      this.queue = this.queue.filter(t => t !== toast);
    });
  }
} 