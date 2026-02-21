import { CircuitBreaker, CircuitState } from '../utils/circuit-breaker';
import { retry } from '../utils/retry';
import { InternalError } from '../utils/errors';

describe('Integration: Retry + Circuit Breaker', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('should stop retrying when circuit breaker opens', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeout: 10000,
    });

    let attempts = 0;
    const failingOperation = jest.fn().mockImplementation(() => {
      attempts++;
      return Promise.reject(new Error('Service unavailable'));
    });

    const wrappedOperation = () =>
      breaker.execute(() => retry(failingOperation, { maxAttempts: 5 }));

    await expect(wrappedOperation()).rejects.toThrow();
    expect(attempts).toBe(1);

    await expect(wrappedOperation()).rejects.toThrow();
    expect(attempts).toBe(2);
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    await expect(wrappedOperation()).rejects.toThrow('Circuit breaker is OPEN');
    expect(attempts).toBe(2);
  });

  it('should handle retry attempts that are non-operational errors', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeout: 10000,
    });

    const nonOperationalError = new InternalError('Critical failure', undefined);
    (nonOperationalError as unknown as { isOperational: boolean }).isOperational = false;
    const operation = jest.fn().mockRejectedValue(nonOperationalError);

    const wrappedOperation = () => breaker.execute(() => retry(operation, { maxAttempts: 3 }));

    await expect(wrappedOperation()).rejects.toThrow('Critical failure');
    expect(operation).toHaveBeenCalledTimes(1);
    expect(breaker.getState()).toBe(CircuitState.OPEN);
  });

  it('should handle circuit breaker reset', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeout: 3000,
    });

    const failingOperation = jest.fn().mockRejectedValue(new Error('Service down'));

    await expect(
      breaker.execute(() => retry(failingOperation, { maxAttempts: 1 }))
    ).rejects.toThrow();
    await expect(
      breaker.execute(() => retry(failingOperation, { maxAttempts: 1 }))
    ).rejects.toThrow();

    expect(breaker.getState()).toBe(CircuitState.OPEN);

    breaker.reset();

    expect(breaker.getState()).toBe(CircuitState.CLOSED);

    const successfulOperation = jest.fn().mockResolvedValue('success');
    const result = await breaker.execute(() => retry(successfulOperation, { maxAttempts: 1 }));

    expect(result).toBe('success');
  });

  it('should handle retry with status code errors', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeout: 10000,
    });

    let attempts = 0;
    const operation = jest.fn().mockImplementation(() => {
      attempts++;
      const error = new Error('Service unavailable') as Error & {
        statusCode?: number;
      };
      error.statusCode = 503;
      if (attempts === 1) {
        return Promise.reject(error);
      }
      return Promise.resolve('success');
    });

    const result = await breaker.execute(() => retry(operation, { maxAttempts: 2 }));

    expect(result).toBe('success');
    expect(attempts).toBe(2);
  });

  it('should not retry on non-retryable status codes', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeout: 10000,
    });

    const operation = jest.fn().mockImplementation(() => {
      const error = new Error('Bad request') as Error & { statusCode?: number };
      error.statusCode = 400;
      return Promise.reject(error);
    });

    await expect(breaker.execute(() => retry(operation, { maxAttempts: 3 }))).rejects.toThrow(
      'Bad request'
    );

    expect(operation).toHaveBeenCalledTimes(1);
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });
});
