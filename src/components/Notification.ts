interface NotificationOptions {
  duration?: number;
  closable?: boolean;
  onClick?: () => void;
}

export class Notification {
  private container: HTMLElement;
  private queue: HTMLElement[] = [];
  private readonly maxCount = 3;
  private readonly defaultOptions: Required<NotificationOptions> = {
    duration: 4500,
    closable: true,
    onClick: () => {}
  };

  constructor() {
    this.container = this.createContainer();
    document.body.appendChild(this.container);
  }

  /**
   * 显示通知
   */
  show(title: string, message: string, options?: NotificationOptions): void {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const notification = this.createNotification(title, message, mergedOptions);
    
    // 限制最大显示数量
    if (this.queue.length >= this.maxCount) {
      const oldest = this.queue.shift();
      oldest?.remove();
    }

    this.container.appendChild(notification);
    this.queue.push(notification);

    // 动画效果
    requestAnimationFrame(() => {
      notification.classList.add('show');
    });

    // 自动关闭
    if (mergedOptions.duration > 0) {
      setTimeout(() => {
        this.close(notification);
      }, mergedOptions.duration);
    }
  }

  /**
   * 关闭通知
   */
  private close(notification: HTMLElement): void {
    notification.classList.remove('show');
    notification.addEventListener('transitionend', () => {
      notification.remove();
      this.queue = this.queue.filter(n => n !== notification);
    });
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'notification-container';
    return container;
  }

  private createNotification(
    title: string,
    message: string,
    options: Required<NotificationOptions>
  ): HTMLElement {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `
      <div class="notification-header">
        <h3 class="notification-title">${title}</h3>
        ${options.closable ? '<button class="notification-close">×</button>' : ''}
      </div>
      <div class="notification-content">${message}</div>
    `;

    // 绑定事件
    if (options.onClick) {
      notification.addEventListener('click', options.onClick);
    }

    if (options.closable) {
      notification.querySelector('.notification-close')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.close(notification);
      });
    }

    return notification;
  }
} 