export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryCondition?: (error: Error) => boolean;
}

export class RetryUtils {
  /**
   * Выполнить операцию с retry-логикой
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 10000,
      backoffMultiplier = 2,
      retryCondition = (error: Error) => {
        // Повторяем для сетевых ошибок и временных проблем
        const retryableErrors = [
          'ECONNRESET',
          'ENOTFOUND',
          'ETIMEDOUT',
          'ECONNREFUSED',
          'Quota exceeded',
          '429',
          'rate limit',
          'temporary'
        ];
        
        return retryableErrors.some(keyword => 
          error.message.toLowerCase().includes(keyword.toLowerCase())
        );
      }
    } = options;

    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Если это последняя попытка или ошибка не подходит для retry
        if (attempt === maxRetries || !retryCondition(lastError)) {
          throw lastError;
        }

        // Вычисляем задержку с экспоненциальным backoff
        const delay = Math.min(
          baseDelay * Math.pow(backoffMultiplier, attempt),
          maxDelay
        );

        // Ждем перед следующей попыткой
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * Выполнить операцию с таймаутом
   */
  static async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number = 30000
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      })
    ]);
  }

  /**
   * Выполнить операцию с retry и таймаутом
   */
  static async executeWithRetryAndTimeout<T>(
    operation: () => Promise<T>,
    retryOptions: RetryOptions = {},
    timeoutMs: number = 30000
  ): Promise<T> {
    return RetryUtils.executeWithRetry(
      () => RetryUtils.executeWithTimeout(operation, timeoutMs),
      retryOptions
    );
  }
} 