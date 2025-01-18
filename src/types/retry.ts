export interface RetryConfig {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  useJitter?: boolean;
}

export interface RetryContext {
  attempt: number;
  error: Error;
  startTime: number;
  retryCount: number;
}

export interface RetryHooks {
  onRetry?: (context: RetryContext) => void;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
} 