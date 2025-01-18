export class LoadingSpinner {
  private element: HTMLElement;

  constructor(private message: string = '加载中...') {
    this.element = this.createElement();
  }

  show(): void {
    document.body.appendChild(this.element);
    // 强制重绘以触发动画
    this.element.offsetHeight;
    this.element.classList.add('show');
  }

  hide(): void {
    this.element.classList.remove('show');
    this.element.addEventListener('transitionend', () => {
      this.element.remove();
    }, { once: true });
  }

  updateMessage(message: string): void {
    const messageEl = this.element.querySelector('.loading-message');
    if (messageEl) {
      messageEl.textContent = message;
    }
  }

  private createElement(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'loading-container';
    
    container.innerHTML = `
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-message">${this.message}</div>
      </div>
    `;

    return container;
  }
} 