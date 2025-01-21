import { Logger } from './logger';

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffFactor?: number;
  retryableErrors?: Array<string | RegExp>;
}

export class RetryHelper {
  private static readonly DEFAULT_OPTIONS: Required<RetryOptions> = {
    maxAttempts: 3,
    delayMs: 1000,
    backoffFactor: 2,
    retryableErrors: [
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'ENOTFOUND',
      /^5\d{2}$/,  // 500系列错误
      'rate limit exceeded',
      'Network Error'
    ]
  };

  static async execute<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const logger = Logger.getInstance();
    const finalOptions = { ...this.DEFAULT_OPTIONS, ...options };
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= finalOptions.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        const shouldRetry = this.shouldRetryError(error, finalOptions.retryableErrors);
        
        if (!shouldRetry || attempt === finalOptions.maxAttempts) {
          throw error;
        }

        const delay = finalOptions.delayMs * Math.pow(finalOptions.backoffFactor, attempt - 1);
        logger.warn(`操作失败，${attempt}/${finalOptions.maxAttempts}次尝试，将在${delay}ms后重试:`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  private static shouldRetryError(error: any, retryableErrors: Array<string | RegExp>): boolean {
    const errorString = error.message || error.toString();
    return retryableErrors.some(pattern => {
      if (pattern instanceof RegExp) {
        return pattern.test(errorString);
      }
      return errorString.includes(pattern);
    });
  }
} 