import { CircuitBreaker } from './circuit-breaker';
import { retry, withTimeout, RetryOptions } from './retry';
import { RETRYABLE_HTTP_STATUS_CODES } from '../config/constants';

export interface ResilienceOptions {
  timeout?: number;
  useCircuitBreaker?: boolean;
  useRetry?: boolean;
}

export interface ExecuteWithResilienceConfig<T extends ResilienceOptions> {
  operation: () => Promise<unknown>;
  options: T;
  defaultTimeout: number;
  circuitBreaker: CircuitBreaker;
  retryOptions?: Partial<RetryOptions>;
  retryableErrors?: number[];
  retryableErrorCodes?: string[];
  maxRetries?: number;
  onRetry?: (attempt: number, error: Error) => void;
  timeoutOperationName: string;
  operationName?: string;
}

export async function executeWithResilience<T>(
  config: ExecuteWithResilienceConfig<ResilienceOptions>
): Promise<T> {
  const {
    operation,
    options,
    defaultTimeout,
    circuitBreaker,
    retryOptions,
    retryableErrors = RETRYABLE_HTTP_STATUS_CODES,
    retryableErrorCodes,
    maxRetries,
    onRetry,
    timeoutOperationName,
    operationName = 'Operation',
  } = config;

  const { timeout = defaultTimeout, useCircuitBreaker = true, useRetry = true } = options;

  const operationWithTimeout = async (): Promise<T> => {
    const promise = operation() as Promise<T>;
    if (timeout > 0) {
      return withTimeout(promise, timeout, timeoutOperationName);
    }
    return promise;
  };

  if (useCircuitBreaker) {
    const operationWithCircuitBreaker = () => circuitBreaker.execute(operationWithTimeout);

    if (useRetry) {
      return retry(operationWithCircuitBreaker, {
        ...retryOptions,
        maxAttempts: maxRetries ?? retryOptions?.maxAttempts,
        retryableErrors,
        retryableErrorCodes,
        onRetry,
        operationName,
      });
    }

    return operationWithCircuitBreaker();
  }

  if (useRetry) {
    return retry(operationWithTimeout, {
      ...retryOptions,
      maxAttempts: maxRetries ?? retryOptions?.maxAttempts,
      retryableErrors,
      retryableErrorCodes,
      operationName,
    });
  }

  return operationWithTimeout();
}
