interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffFactor?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export class RetryManager {
  private readonly defaultOptions: Required<RetryOptions> = {
    maxAttempts: 3,
    delayMs: 1000,
    backoffFactor: 2,
    maxDelayMs: 10000,
    onRetry: () => {}
  };

  constructor(private options: RetryOptions = {}) {
    this.options = { ...this.defaultOptions, ...options };
  }

  /**
   * 执行带重试的异步操作
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const opts = this.options as Required<RetryOptions>;
    let lastError: Error;
    let delay = opts.delayMs;

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === opts.maxAttempts) {
          throw new Error(`操作失败，已重试${attempt}次: ${lastError.message}`);
        }

        opts.onRetry(attempt, lastError);
        await this.delay(delay);
        
        // 计算下一次重试的延迟时间
        delay = Math.min(delay * opts.backoffFactor, opts.maxDelayMs);
      }
    }

    throw lastError!;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 