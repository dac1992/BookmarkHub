import { RetryConfig, RetryContext, RetryHooks } from '../types/retry';

export class EnhancedRetryManager {
  private readonly config: Required<RetryConfig>;
  private readonly hooks: RetryHooks;

  constructor(config?: RetryConfig, hooks?: RetryHooks) {
    this.config = {
      maxAttempts: config?.maxAttempts ?? 3,
      initialDelay: config?.initialDelay ?? 1000,
      maxDelay: config?.maxDelay ?? 10000,
      backoffFactor: config?.backoffFactor ?? 2,
      useJitter: config?.useJitter ?? false
    };
    this.hooks = hooks || {};
  }

  /**
   * 执行可重试的操作
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    let attempt = 1;
    const startTime = Date.now();

    while (true) {
      try {
        const result = await operation();
        this.hooks.onSuccess?.();
        return result;
      } catch (error) {
        if (!(error instanceof Error)) {
          throw error;
        }

        if (attempt >= this.config.maxAttempts) {
          this.hooks.onError?.(error);
          throw error;
        }

        const context: RetryContext = {
          attempt,
          error,
          startTime,
          retryCount: attempt
        };

        this.hooks.onRetry?.(context);

        const delay = this.calculateDelay(attempt);
        await this.delay(delay);
        attempt++;
      }
    }
  }

  /**
   * 计算重试延迟时间
   */
  private calculateDelay(attempt: number): number {
    const baseDelay = Math.min(
      this.config.initialDelay * Math.pow(this.config.backoffFactor, attempt - 1),
      this.config.maxDelay
    );

    if (!this.config.useJitter) {
      return baseDelay;
    }

    // 添加随机抖动，范围在 75% ~ 100% 之间
    const min = baseDelay * 0.75;
    const max = baseDelay;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * 延迟执行
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 