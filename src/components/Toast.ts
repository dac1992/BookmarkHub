type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  duration?: number;
  position?: 'top' | 'bottom';
}

export class Toast {
  private container: HTMLElement;
  private queue: HTMLElement[] = [];
  private activeMessages = new Set<string>();
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
    // 如果相同消息已经在显示，则不重复显示
    const messageKey = `${type}:${message}`;
    if (this.activeMessages.has(messageKey)) {
      return;
    }

    const mergedOptions = { ...this.defaultOptions, ...options };
    const toast = this.createToast(message, type);
    
    this.activeMessages.add(messageKey);
    this.container.appendChild(toast);
    this.queue.push(toast);

    // 自动移除
    setTimeout(() => {
      this.removeToast(toast);
      this.activeMessages.delete(messageKey);
    }, mergedOptions.duration);
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'toast-container';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.zIndex = '10000';
    container.style.maxHeight = '100vh';
    container.style.pointerEvents = 'none';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'flex-end';
    container.style.gap = '10px';
    return container;
  }

  private createToast(message: string, type: ToastType): HTMLElement {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.marginBottom = '10px';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '4px';
    toast.style.backgroundColor = this.getBackgroundColor(type);
    toast.style.color = '#fff';
    toast.style.opacity = '0';
    toast.style.transition = 'all 0.3s ease-in-out';
    toast.style.transform = 'translateY(-10px)';
    toast.style.pointerEvents = 'auto';
    toast.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
    toast.style.minWidth = '200px';
    toast.style.textAlign = 'center';

    // 添加动画效果
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    return toast;
  }

  private getBackgroundColor(type: ToastType): string {
    switch (type) {
      case 'success': return '#4caf50';
      case 'error': return '#f44336';
      case 'warning': return '#ff9800';
      case 'info': return '#2196f3';
      default: return '#333';
    }
  }

  private removeToast(toast: HTMLElement): void {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    
    setTimeout(() => {
      toast.remove();
      this.queue = this.queue.filter(t => t !== toast);
    }, 300); // 等待动画完成
  }
} 