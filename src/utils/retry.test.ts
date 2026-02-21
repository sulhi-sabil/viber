import { retry, sleep, withTimeout } from '../utils/retry';

interface ErrorWithStatusCode extends Error {
  statusCode?: number;
}

interface ErrorWithCode extends Error {
  code?: string;
}

describe('retry', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('should succeed on first attempt', async () => {
    const operation = jest.fn().mockResolvedValue('success');
    const result = await retry(operation);

    expect(operation).toHaveBeenCalledTimes(1);
    expect(result).toBe('success');
  });

  it('should retry on retryable error', async () => {
    jest.useFakeTimers().setSystemTime(new Date());

    const error = new Error('Internal server error') as ErrorWithStatusCode;
    error.statusCode = 500;
    const operation = jest.fn().mockRejectedValueOnce(error).mockResolvedValue('success');

    const promise = retry(operation, { maxAttempts: 3 });

    await jest.advanceTimersByTimeAsync(1000);

    const result = await promise;

    expect(operation).toHaveBeenCalledTimes(2);
    expect(result).toBe('success');
  });

  it('should respect maxAttempts', async () => {
    const error = new Error('Service unavailable') as ErrorWithStatusCode;
    error.statusCode = 500;
    const operation = jest.fn().mockRejectedValue(error);

    await expect(retry(operation, { maxAttempts: 2 })).rejects.toThrow('Service unavailable');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should not retry on non-retryable error', async () => {
    const error = new Error('Bad request') as ErrorWithStatusCode;
    error.statusCode = 400;
    const operation = jest.fn().mockRejectedValue(error);

    await expect(retry(operation)).rejects.toThrow('Bad request');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should use exponential backoff', async () => {
    jest.useFakeTimers().setSystemTime(new Date());

    const delays: number[] = [];
    const onRetry = jest.fn((attempt: number) => {
      delays.push(attempt);
    });

    const error = new Error('Internal server error') as ErrorWithStatusCode;
    error.statusCode = 500;
    const operation = jest
      .fn()
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockResolvedValue('success');

    const promise = retry(operation, { maxAttempts: 4, onRetry });

    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(2000);

    const result = await promise;

    expect(result).toBe('success');
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('should respect maxDelay', async () => {
    jest.useFakeTimers().setSystemTime(new Date());

    const error = new Error('Internal server error') as ErrorWithStatusCode;
    error.statusCode = 500;
    const operation = jest
      .fn()
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockResolvedValue('success');

    const promise = retry(operation, {
      maxAttempts: 5,
      initialDelay: 1000,
      maxDelay: 2000,
      backoffMultiplier: 10,
    });

    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(2000);
    await jest.advanceTimersByTimeAsync(2000);

    const result = await promise;

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(4);
  });

  it('should retry on network error codes', async () => {
    jest.useFakeTimers().setSystemTime(new Date());

    const error = new Error('Connection reset') as ErrorWithCode;
    error.code = 'ECONNRESET';
    const operation = jest.fn().mockRejectedValueOnce(error).mockResolvedValue('success');

    const promise = retry(operation, { maxAttempts: 2 });

    await jest.advanceTimersByTimeAsync(1000);

    const result = await promise;

    expect(operation).toHaveBeenCalledTimes(2);
    expect(result).toBe('success');
  });

  it('should throw error when retry operation fails completely', async () => {
    const error = new Error('Service unavailable') as ErrorWithStatusCode;
    error.statusCode = 503;
    const operation = jest.fn().mockRejectedValue(error);

    await expect(retry(operation, { maxAttempts: 1 })).rejects.toThrow('Service unavailable');
  });
});

describe('sleep', () => {
  it('should resolve after specified time', async () => {
    jest.useFakeTimers();

    const promise = sleep(1000);
    await jest.advanceTimersByTimeAsync(1000);

    await expect(promise).resolves.toBeUndefined();
  });
});

describe('withTimeout', () => {
  it('should resolve if promise completes before timeout', async () => {
    const promise = withTimeout(Promise.resolve('result'), 1000);

    const result = await promise;
    expect(result).toBe('result');
  });

  it('should reject if promise exceeds timeout', async () => {
    jest.useFakeTimers();

    const slowPromise = new Promise((resolve) => {
      setTimeout(() => resolve('result'), 2000);
    });

    const promise = withTimeout(slowPromise, 1000, 'testOperation');

    jest.advanceTimersByTime(1000);

    await expect(promise).rejects.toThrow('testOperation timed out after 1000ms');
  });

  it('should include operation name in timeout error', async () => {
    jest.useFakeTimers();

    const slowPromise = new Promise((resolve) => {
      setTimeout(() => resolve('result'), 2000);
    });

    const promise = withTimeout(slowPromise, 500, 'databaseQuery');

    jest.advanceTimersByTime(500);

    await expect(promise).rejects.toThrow('databaseQuery timed out after 500ms');
  });
});
