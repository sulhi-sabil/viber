import { CircuitBreaker, CircuitState, createCircuitBreaker } from '../utils/circuit-breaker';

describe('CircuitBreaker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should start in CLOSED state', () => {
    const breaker = new CircuitBreaker();
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('should execute successfully in CLOSED state', async () => {
    const breaker = new CircuitBreaker();
    const operation = jest.fn().mockResolvedValue('success');

    const result = await breaker.execute(operation);

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('should open after failure threshold is reached', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 3,
    });

    const failingOperation = jest.fn().mockRejectedValue(new Error('Fail'));

    await expect(breaker.execute(failingOperation)).rejects.toThrow();
    await expect(breaker.execute(failingOperation)).rejects.toThrow();
    await expect(breaker.execute(failingOperation)).rejects.toThrow();

    expect(breaker.getState()).toBe(CircuitState.OPEN);
  });

  it('should reject calls when OPEN', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
    });

    const failingOperation = jest.fn().mockRejectedValue(new Error('Fail'));

    await expect(breaker.execute(failingOperation)).rejects.toThrow();
    await expect(breaker.execute(failingOperation)).rejects.toThrow();

    expect(breaker.getState()).toBe(CircuitState.OPEN);

    await expect(breaker.execute(jest.fn())).rejects.toThrow('Circuit breaker is OPEN');
  });

  it('should transition to HALF_OPEN after reset timeout', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeout: 10000,
    });

    const failingOperation = jest.fn().mockRejectedValue(new Error('Fail'));

    await expect(breaker.execute(failingOperation)).rejects.toThrow();
    await expect(breaker.execute(failingOperation)).rejects.toThrow();

    expect(breaker.getState()).toBe(CircuitState.OPEN);

    jest.advanceTimersByTime(10000);

    const successfulOperation = jest.fn().mockResolvedValue('success');
    await breaker.execute(successfulOperation);

    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);
  });

  it('should close after successful HALF_OPEN calls', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeout: 10000,
      halfOpenMaxCalls: 2,
    });

    const failingOperation = jest.fn().mockRejectedValue(new Error('Fail'));
    const successfulOperation = jest.fn().mockResolvedValue('success');

    await expect(breaker.execute(failingOperation)).rejects.toThrow();
    await expect(breaker.execute(failingOperation)).rejects.toThrow();

    expect(breaker.getState()).toBe(CircuitState.OPEN);

    jest.advanceTimersByTime(10000);

    await breaker.execute(successfulOperation);
    await breaker.execute(successfulOperation);

    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('should reopen on failure in HALF_OPEN state', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeout: 10000,
      halfOpenMaxCalls: 3,
    });

    const failingOperation = jest.fn().mockRejectedValue(new Error('Fail'));
    const successfulOperation = jest.fn().mockResolvedValue('success');

    await expect(breaker.execute(failingOperation)).rejects.toThrow();
    await expect(breaker.execute(failingOperation)).rejects.toThrow();

    expect(breaker.getState()).toBe(CircuitState.OPEN);

    jest.advanceTimersByTime(10000);

    await breaker.execute(successfulOperation);
    await expect(breaker.execute(failingOperation)).rejects.toThrow();

    expect(breaker.getState()).toBe(CircuitState.OPEN);
  });

  it('should track metrics correctly', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 3,
      monitorWindow: 60000,
    });

    const failingOperation = jest.fn().mockRejectedValue(new Error('Fail'));
    const successfulOperation = jest.fn().mockResolvedValue('success');

    await breaker.execute(successfulOperation);
    await expect(breaker.execute(failingOperation)).rejects.toThrow();

    const metrics = breaker.getMetrics();

    expect(metrics.failureCount).toBe(1);
    expect(metrics.successCount).toBe(1);
    expect(metrics.failuresInWindow).toBe(1);
    expect(metrics.successesInWindow).toBe(1);
  });

  it('should call onStateChange callback', () => {
    const onStateChange = jest.fn();
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      onStateChange,
    });

    return breaker
      .execute(() => Promise.reject(new Error('Fail')))
      .catch(() => {})
      .then(() => breaker.execute(() => Promise.reject(new Error('Fail'))))
      .catch(() => {})
      .then(() => {
        expect(onStateChange).toHaveBeenCalledWith(
          CircuitState.OPEN,
          expect.stringContaining('Failure threshold')
        );
      });
  });

  it('should reset to CLOSED state', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
    });

    const failingOperation = jest.fn().mockRejectedValue(new Error('Fail'));

    await expect(breaker.execute(failingOperation)).rejects.toThrow();
    await expect(breaker.execute(failingOperation)).rejects.toThrow();

    expect(breaker.getState()).toBe(CircuitState.OPEN);

    breaker.reset();

    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('should use default options', () => {
    const breaker = new CircuitBreaker();
    const metrics = breaker.getMetrics();

    expect(breaker.getState()).toBe(CircuitState.CLOSED);
    expect(metrics.failureCount).toBe(0);
  });

  it('should not attempt reset when lastFailureTime is null', () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeout: 1000,
    });

    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });
});

describe('createCircuitBreaker', () => {
  it('should create a CircuitBreaker instance', () => {
    const breaker = createCircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 30000,
    });

    expect(breaker).toBeInstanceOf(CircuitBreaker);
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });
});
