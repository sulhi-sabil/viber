import { logger } from './logger';
import { InternalError, TimeoutError } from './errors';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: number[];
  retryableErrorCodes?: string[];
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: [408, 429, 500, 502, 503, 504],
  retryableErrorCodes: [
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
  ],
  onRetry: () => {},
};

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function calculateDelay(
  attempt: number,
  options: RetryOptions
): number {
  const {
    initialDelay = DEFAULT_RETRY_OPTIONS.initialDelay,
    backoffMultiplier = DEFAULT_RETRY_OPTIONS.backoffMultiplier,
    maxDelay = DEFAULT_RETRY_OPTIONS.maxDelay,
  } = options;

  const delay = initialDelay * Math.pow(backoffMultiplier, attempt - 1);
  return Math.min(delay, maxDelay);
}

export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const finalOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const {
    maxAttempts,
    retryableErrors,
    retryableErrorCodes,
    onRetry,
  } = finalOptions;

  let lastError: Error | undefined;
  let attempt = 1;

  while (attempt <= maxAttempts) {
    try {
      const result = await operation();
      
      if (attempt > 1) {
        logger.info(`Operation succeeded on attempt ${attempt}`);
      }
      
      return result;
    } catch (error) {
      lastError = error as Error;
      
      const shouldRetry = isRetryable(error, retryableErrors, retryableErrorCodes);
      
      if (!shouldRetry || attempt >= maxAttempts) {
        if (attempt >= maxAttempts && maxAttempts > 1) {
          logger.warn(
            `Operation failed after ${maxAttempts} attempts: ${lastError?.message || 'Unknown error'}`
          );
        }
        throw lastError;
      }

      const delay = calculateDelay(attempt, finalOptions);
      logger.warn(
        `Attempt ${attempt} failed: ${lastError?.message || 'Unknown error'}. Retrying in ${delay}ms...`
      );

      if (onRetry) {
        onRetry(attempt, lastError);
      }

      await sleep(delay);
      attempt++;
    }
  }

  throw lastError || new InternalError('Retry operation failed');
}

function isRetryable(
  error: any,
  retryableErrors: number[],
  retryableErrorCodes: string[]
): boolean {
  if (error?.isOperational === false) {
    return false;
  }

  const statusCode = error?.statusCode || error?.status;
  const errorCode = error?.code;

  if (statusCode && retryableErrors.includes(statusCode)) {
    return true;
  }

  if (errorCode && retryableErrorCodes.includes(errorCode)) {
    return true;
  }

  return false;
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string = 'operation'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new TimeoutError(operationName, timeoutMs)),
        timeoutMs
      )
    ),
  ]);
}
