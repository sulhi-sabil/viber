import { logger } from "./logger";
import { InternalError, TimeoutError } from "./errors";
import {
  DEFAULT_MAX_RETRY_ATTEMPTS,
  DEFAULT_RETRY_INITIAL_DELAY_MS,
  DEFAULT_RETRY_MAX_DELAY_MS,
  DEFAULT_RETRY_BACKOFF_MULTIPLIER,
  RETRYABLE_HTTP_STATUS_CODES,
  RETRYABLE_ERROR_CODES,
} from "../config/constants";

/**
 * Cached Sets for default retryable values.
 * Created once at module load time to avoid repeated Set allocations
 * in the hot path of retry().
 */
const DEFAULT_RETRYABLE_ERRORS_SET = new Set(RETRYABLE_HTTP_STATUS_CODES);
const DEFAULT_RETRYABLE_ERROR_CODES_SET = new Set(RETRYABLE_ERROR_CODES);


export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: number[];
  retryableErrorCodes?: string[];
  onRetry?: (attempt: number, error: Error) => void;
  operationName?: string;
}

/**
 * Predefined retry policy presets
 */
export const RetryPolicies = {
  /**
   * Aggressive retry policy - more retries with longer delays
   * Use for critical operations that must succeed
   */
  AGGRESSIVE: {
    maxAttempts: 5,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    retryableErrors: RETRYABLE_HTTP_STATUS_CODES,
    retryableErrorCodes: RETRYABLE_ERROR_CODES,
  } as const,

  /**
   * Conservative retry policy - fewer retries with shorter delays
   * Use for operations where fast failure is preferred
   */
  CONSERVATIVE: {
    maxAttempts: 2,
    initialDelay: 500,
    maxDelay: 5000,
    backoffMultiplier: 2,
    retryableErrors: [429, 500, 502, 503, 504],
    retryableErrorCodes: RETRYABLE_ERROR_CODES,
  } as const,

  /**
   * Default retry policy - balanced approach
   */
  DEFAULT: {
    maxAttempts: DEFAULT_MAX_RETRY_ATTEMPTS,
    initialDelay: DEFAULT_RETRY_INITIAL_DELAY_MS,
    maxDelay: DEFAULT_RETRY_MAX_DELAY_MS,
    backoffMultiplier: DEFAULT_RETRY_BACKOFF_MULTIPLIER,
    retryableErrors: RETRYABLE_HTTP_STATUS_CODES,
    retryableErrorCodes: RETRYABLE_ERROR_CODES,
  } as const,
};

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: DEFAULT_MAX_RETRY_ATTEMPTS,
  initialDelay: DEFAULT_RETRY_INITIAL_DELAY_MS,
  maxDelay: DEFAULT_RETRY_MAX_DELAY_MS,
  backoffMultiplier: DEFAULT_RETRY_BACKOFF_MULTIPLIER,
  retryableErrors: RETRYABLE_HTTP_STATUS_CODES,
  retryableErrorCodes: RETRYABLE_ERROR_CODES,
  onRetry: () => {},
  operationName: "Operation",
};

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    const timerRef = timer as unknown as { unref?: () => void };
    if (typeof timerRef.unref === "function") {
      timerRef.unref();
    }
  });
}

export function calculateDelay(
  attempt: number,
  initialDelay: number,
  backoffMultiplier: number,
  maxDelay: number,
): number {
  const delay = initialDelay * Math.pow(backoffMultiplier, attempt - 1);
  return Math.min(delay, maxDelay);
}

export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const finalOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const {
    maxAttempts,
    retryableErrors,
    retryableErrorCodes,
    onRetry,
    initialDelay,
    backoffMultiplier,
    maxDelay,
  } = finalOptions;

  // Use cached Sets for default values (via reference equality), otherwise create new Sets
  const retryableErrorSet = retryableErrors === RETRYABLE_HTTP_STATUS_CODES
    ? DEFAULT_RETRYABLE_ERRORS_SET
    : new Set(retryableErrors);
  const retryableErrorCodeSet = retryableErrorCodes === RETRYABLE_ERROR_CODES
    ? DEFAULT_RETRYABLE_ERROR_CODES_SET
    : new Set(retryableErrorCodes);

  let lastError: Error | undefined;
  let attempt = 1;
  const opName = finalOptions.operationName;

  while (attempt <= maxAttempts) {
    try {
      const result = await operation();

      if (attempt > 1) {
        logger.info(`${opName} succeeded on attempt ${attempt}`);
      }

      return result;
    } catch (error) {
      lastError = error as Error;

      const shouldRetry = isRetryable(
        error,
        retryableErrorSet,
        retryableErrorCodeSet,
      );

      if (!shouldRetry || attempt >= maxAttempts) {
        if (attempt >= maxAttempts && maxAttempts > 1) {
          logger.warn(
            `${opName} failed after ${maxAttempts} attempts: ${lastError?.message || "Unknown error"}`,
          );
        }
        throw lastError;
      }

      const delay = calculateDelay(
        attempt,
        initialDelay,
        backoffMultiplier,
        maxDelay,
      );
      logger.warn(
        `${opName} attempt ${attempt} failed: ${lastError?.message || "Unknown error"}. Retrying in ${delay}ms...`,
      );

      if (onRetry) {
        onRetry(attempt, lastError);
      }

      await sleep(delay);
      attempt++;
    }
  }

  throw lastError || new InternalError("Retry operation failed");
}

function isRetryable(
  error: unknown,
  retryableErrors: Set<number>,
  retryableErrorCodes: Set<string>,
): boolean {
  const errorObj = error as {
    isOperational?: boolean;
    statusCode?: number;
    status?: number;
    code?: string;
  };

  if (errorObj?.isOperational === false) {
    return false;
  }

  const statusCode = errorObj?.statusCode || errorObj?.status;
  const errorCode = errorObj?.code;

  if (statusCode && retryableErrors.has(statusCode)) {
    return true;
  }

  if (errorCode && retryableErrorCodes.has(errorCode)) {
    return true;
  }

  return false;
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string = "operation",
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(
        () => reject(new TimeoutError(operationName, timeoutMs)),
        timeoutMs,
      );
      const timerRef = timer as unknown as { unref?: () => void };
      if (typeof timerRef.unref === "function") {
        timerRef.unref();
      }
    }),
  ]);
}
