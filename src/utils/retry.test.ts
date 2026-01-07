import { retry, sleep, withTimeout } from '../utils/retry';

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
    jest.useFakeTimers();
    
    const operation = jest.fn()
      .mockRejectedValueOnce({ statusCode: 500 })
      .mockResolvedValue('success');
    
    const promise = retry(operation, { maxAttempts: 3 });
    
    jest.advanceTimersByTime(1000);
    
    const result = await promise;
    
    expect(operation).toHaveBeenCalledTimes(2);
    expect(result).toBe('success');
  });

  it('should respect maxAttempts', async () => {
    jest.useFakeTimers();
    
    const operation = jest.fn()
      .mockRejectedValue({ statusCode: 500 });
    
    const promise = retry(operation, { maxAttempts: 2 });
    
    jest.advanceTimersByTime(1000);
    
    await expect(promise).rejects.toThrow();
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should not retry on non-retryable error', async () => {
    const operation = jest.fn()
      .mockRejectedValue({ statusCode: 400 });
    
    await expect(retry(operation)).rejects.toThrow();
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should use exponential backoff', async () => {
    jest.useFakeTimers();
    
    const delays: number[] = [];
    const onRetry = jest.fn((attempt: number) => {
      delays.push(attempt);
    });
    
    const operation = jest.fn()
      .mockRejectedValueOnce({ statusCode: 500 })
      .mockRejectedValueOnce({ statusCode: 500 })
      .mockResolvedValue('success');
    
    const promise = retry(operation, { maxAttempts: 4, onRetry });
    
    jest.advanceTimersByTime(1000);
    jest.advanceTimersByTime(2000);
    
    const result = await promise;
    
    expect(result).toBe('success');
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('should respect maxDelay', async () => {
    jest.useFakeTimers();
    
    const operation = jest.fn()
      .mockRejectedValueOnce({ statusCode: 500 })
      .mockRejectedValueOnce({ statusCode: 500 })
      .mockRejectedValueOnce({ statusCode: 500 })
      .mockResolvedValue('success');
    
    const promise = retry(operation, {
      maxAttempts: 5,
      initialDelay: 1000,
      maxDelay: 2000,
      backoffMultiplier: 10,
    });
    
    jest.advanceTimersByTime(1000);
    jest.advanceTimersByTime(2000);
    jest.advanceTimersByTime(2000);
    
    const result = await promise;
    
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(4);
  });

  it('should retry on network error codes', async () => {
    jest.useFakeTimers();
    
    const operation = jest.fn()
      .mockRejectedValueOnce({ code: 'ECONNRESET' })
      .mockResolvedValue('success');
    
    const promise = retry(operation, { maxAttempts: 2 });
    
    jest.advanceTimersByTime(1000);
    
    const result = await promise;
    
    expect(operation).toHaveBeenCalledTimes(2);
    expect(result).toBe('success');
  });
});

describe('sleep', () => {
  it('should resolve after specified time', async () => {
    jest.useFakeTimers();
    
    const promise = sleep(1000);
    jest.advanceTimersByTime(1000);
    
    await expect(promise).resolves.toBeUndefined();
  });
});

describe('withTimeout', () => {
  it('should resolve if promise completes before timeout', async () => {
    jest.useFakeTimers();
    
    const promise = withTimeout(Promise.resolve('result'), 1000);
    jest.advanceTimersByTime(100);
    
    await expect(promise).resolves.toBe('result');
  });

  it('should reject if promise exceeds timeout', async () => {
    jest.useFakeTimers();
    
    const promise = withTimeout(
      new Promise(resolve => setTimeout(() => resolve('late'), 2000)),
      1000
    );
    jest.advanceTimersByTime(1000);
    
    await expect(promise).rejects.toThrow('timed out');
  });

  it('should include operation name in timeout error', async () => {
    jest.useFakeTimers();
    
    const promise = withTimeout(
      new Promise(resolve => setTimeout(() => resolve('late'), 2000)),
      1000,
      'API call'
    );
    jest.advanceTimersByTime(1000);
    
    await expect(promise).rejects.toThrow('API call timed out');
  });
});
