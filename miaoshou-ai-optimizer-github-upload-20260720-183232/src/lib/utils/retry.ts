export interface RetryOptions {
  attempts: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  isRetryable?: (error: unknown) => boolean;
}

export async function retryWithBackoff<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T> {
  const baseDelayMs = options.baseDelayMs ?? 500;
  const maxDelayMs = options.maxDelayMs ?? 8000;
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const retryable = options.isRetryable ? options.isRetryable(error) : true;
      if (!retryable || attempt === options.attempts) break;
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
