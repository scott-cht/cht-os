/**
 * Retry utility with exponential backoff
 * 
 * Usage:
 *   const result = await withRetry(() => fetchData(), { retries: 3 });
 */

interface RetryOptions {
  /** Number of retry attempts (default: 3) */
  retries?: number;
  /** Initial delay in ms (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in ms (default: 10000) */
  maxDelay?: number;
  /** Backoff multiplier (default: 2) */
  backoffFactor?: number;
  /** Function to determine if error is retryable */
  isRetryable?: (error: unknown) => boolean;
  /** Callback on each retry */
  onRetry?: (error: unknown, attempt: number) => void;
}

const defaultOptions: Required<RetryOptions> = {
  retries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  isRetryable: () => true,
  onRetry: () => {},
};

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: unknown;
  let delay = opts.initialDelay;

  for (let attempt = 1; attempt <= opts.retries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if this is the last attempt
      if (attempt > opts.retries) {
        break;
      }

      // Check if error is retryable
      if (!opts.isRetryable(error)) {
        break;
      }

      // Call retry callback
      opts.onRetry(error, attempt);

      // Wait before retrying
      await sleep(delay);

      // Increase delay with exponential backoff
      delay = Math.min(delay * opts.backoffFactor, opts.maxDelay);
    }
  }

  throw lastError;
}

/**
 * Check if an error is a network/transient error worth retrying
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('socket') ||
      message.includes('fetch failed') ||
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('503') ||
      message.includes('502') ||
      message.includes('504')
    );
  }
  return false;
}

/**
 * Check if HTTP response status is retryable
 */
export function isRetryableStatus(status: number): boolean {
  return (
    status === 429 || // Rate limited
    status === 502 || // Bad gateway
    status === 503 || // Service unavailable
    status === 504 || // Gateway timeout
    status >= 500     // Server errors
  );
}

/**
 * Fetch with automatic retry on transient failures
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit & { retryOptions?: RetryOptions }
): Promise<Response> {
  const { retryOptions, ...fetchOptions } = options || {};
  
  return withRetry(
    async () => {
      const response = await fetch(url, fetchOptions);
      
      // Throw on retryable status codes to trigger retry
      if (isRetryableStatus(response.status)) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    },
    {
      isRetryable: isNetworkError,
      onRetry: (error, attempt) => {
        console.log(`Retry ${attempt} for ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      },
      ...retryOptions,
    }
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
