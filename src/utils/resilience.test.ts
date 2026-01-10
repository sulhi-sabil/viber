import { executeWithResilience } from "../utils/resilience";
import { CircuitBreaker, CircuitState } from "../utils/circuit-breaker";

describe("executeWithResilience", () => {
  let circuitBreaker: CircuitBreaker;
  const mockOperation = jest.fn().mockResolvedValue("result");

  beforeEach(() => {
    jest.clearAllMocks();
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000,
    });
  });

  describe("timeout behavior", () => {
    it("should apply timeout when specified", async () => {
      const slowOperation = jest
        .fn()
        .mockImplementation(
          () =>
            new Promise((resolve) => setTimeout(() => resolve("slow"), 100)),
        );

      await expect(
        executeWithResilience({
          operation: slowOperation,
          options: { timeout: 50, useCircuitBreaker: false, useRetry: false },
          defaultTimeout: 10000,
          circuitBreaker,
          timeoutOperationName: "test operation",
        }),
      ).rejects.toThrow("test operation timed out");
    });

    it("should not apply timeout when timeout is 0", async () => {
      const fastOperation = jest.fn().mockResolvedValue("fast");

      const result = await executeWithResilience({
        operation: fastOperation,
        options: { timeout: 0, useCircuitBreaker: false, useRetry: false },
        defaultTimeout: 10000,
        circuitBreaker,
        timeoutOperationName: "test operation",
      });

      expect(result).toBe("fast");
    });

    it("should not apply timeout when timeout is negative", async () => {
      const fastOperation = jest.fn().mockResolvedValue("fast");

      const result = await executeWithResilience({
        operation: fastOperation,
        options: { timeout: -1, useCircuitBreaker: false, useRetry: false },
        defaultTimeout: 10000,
        circuitBreaker,
        timeoutOperationName: "test operation",
      });

      expect(result).toBe("fast");
    });
  });

  describe("circuit breaker + retry combinations", () => {
    it("should use both circuit breaker and retry when both enabled", async () => {
      let attempts = 0;
      const flakyOperation = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          const error = new Error("Temporary failure") as Error & {
            statusCode?: number;
          };
          error.statusCode = 503;
          return Promise.reject(error);
        }
        return Promise.resolve("success");
      });

      const result = await executeWithResilience({
        operation: flakyOperation,
        options: {
          useCircuitBreaker: true,
          useRetry: true,
          timeout: 10000,
        },
        defaultTimeout: 10000,
        circuitBreaker,
        retryOptions: { maxAttempts: 2 },
        timeoutOperationName: "test operation",
      });

      expect(result).toBe("success");
      expect(attempts).toBe(2);
    });

    it("should use only circuit breaker when retry is disabled", async () => {
      const operation = jest.fn().mockResolvedValue("result");

      const result = await executeWithResilience({
        operation: operation,
        options: {
          useCircuitBreaker: true,
          useRetry: false,
          timeout: 10000,
        },
        defaultTimeout: 10000,
        circuitBreaker,
        timeoutOperationName: "test operation",
      });

      expect(result).toBe("result");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should use only retry when circuit breaker is disabled", async () => {
      let attempts = 0;
      const flakyOperation = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          const error = new Error("Temporary failure") as Error & {
            statusCode?: number;
          };
          error.statusCode = 503;
          return Promise.reject(error);
        }
        return Promise.resolve("success");
      });

      const result = await executeWithResilience({
        operation: flakyOperation,
        options: {
          useCircuitBreaker: false,
          useRetry: true,
          timeout: 10000,
        },
        defaultTimeout: 10000,
        circuitBreaker,
        retryOptions: { maxAttempts: 2 },
        timeoutOperationName: "test operation",
      });

      expect(result).toBe("success");
      expect(attempts).toBe(2);
    });

    it("should use neither circuit breaker nor retry when both disabled", async () => {
      const operation = jest.fn().mockResolvedValue("result");

      const result = await executeWithResilience({
        operation: operation,
        options: {
          useCircuitBreaker: false,
          useRetry: false,
          timeout: 10000,
        },
        defaultTimeout: 10000,
        circuitBreaker,
        timeoutOperationName: "test operation",
      });

      expect(result).toBe("result");
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe("retryable error customization", () => {
    it("should use custom retryable error codes", async () => {
      let attempts = 0;
      const operation = jest.fn().mockImplementation(() => {
        attempts++;
        const error = new Error("Custom error") as Error & {
          code?: string;
        };
        error.code = "CUSTOM_ERROR";
        if (attempts === 1) {
          return Promise.reject(error);
        }
        return Promise.resolve("success");
      });

      const result = await executeWithResilience({
        operation: operation,
        options: {
          useCircuitBreaker: false,
          useRetry: true,
          timeout: 10000,
        },
        defaultTimeout: 10000,
        circuitBreaker,
        retryOptions: { maxAttempts: 2 },
        retryableErrorCodes: ["CUSTOM_ERROR"],
        timeoutOperationName: "test operation",
      });

      expect(result).toBe("success");
      expect(attempts).toBe(2);
    });

    it("should use custom retryable HTTP status codes", async () => {
      let attempts = 0;
      const operation = jest.fn().mockImplementation(() => {
        attempts++;
        const error = new Error("Custom error") as Error & {
          statusCode?: number;
        };
        error.statusCode = 418;
        if (attempts === 1) {
          return Promise.reject(error);
        }
        return Promise.resolve("success");
      });

      const result = await executeWithResilience({
        operation: operation,
        options: {
          useCircuitBreaker: false,
          useRetry: true,
          timeout: 10000,
        },
        defaultTimeout: 10000,
        circuitBreaker,
        retryOptions: { maxAttempts: 2 },
        retryableErrors: [418],
        timeoutOperationName: "test operation",
      });

      expect(result).toBe("success");
      expect(attempts).toBe(2);
    });

    it("should call onRetry callback", async () => {
      let attempts = 0;
      const onRetryCallback = jest.fn();
      const operation = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          const error = new Error("Temporary failure") as Error & {
            statusCode?: number;
          };
          error.statusCode = 503;
          return Promise.reject(error);
        }
        return Promise.resolve("success");
      });

      const result = await executeWithResilience({
        operation: operation,
        options: {
          useCircuitBreaker: false,
          useRetry: true,
          timeout: 10000,
        },
        defaultTimeout: 10000,
        circuitBreaker,
        retryOptions: { maxAttempts: 2, onRetry: onRetryCallback },
        timeoutOperationName: "test operation",
      });

      expect(result).toBe("success");
      expect(attempts).toBe(2);
      expect(onRetryCallback).toHaveBeenCalledTimes(1);
      expect(onRetryCallback).toHaveBeenCalledWith(1, expect.any(Error));
    });
  });

  describe("maxRetries override", () => {
    it("should use maxRetries from config when provided", async () => {
      let attempts = 0;
      const operation = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          const error = new Error("Temporary failure") as Error & {
            statusCode?: number;
          };
          error.statusCode = 503;
          return Promise.reject(error);
        }
        return Promise.resolve("success");
      });

      const result = await executeWithResilience({
        operation: operation,
        options: {
          useCircuitBreaker: false,
          useRetry: true,
          timeout: 10000,
        },
        defaultTimeout: 10000,
        circuitBreaker,
        retryOptions: { maxAttempts: 2 },
        maxRetries: 3,
        timeoutOperationName: "test operation",
      });

      expect(result).toBe("success");
      expect(attempts).toBe(3);
    });

    it("should use maxAttempts from retryOptions when maxRetries not provided", async () => {
      let attempts = 0;
      const operation = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          const error = new Error("Temporary failure") as Error & {
            statusCode?: number;
          };
          error.statusCode = 503;
          return Promise.reject(error);
        }
        return Promise.resolve("success");
      });

      const result = await executeWithResilience({
        operation: operation,
        options: {
          useCircuitBreaker: false,
          useRetry: true,
          timeout: 10000,
        },
        defaultTimeout: 10000,
        circuitBreaker,
        retryOptions: { maxAttempts: 2 },
        timeoutOperationName: "test operation",
      });

      expect(result).toBe("success");
      expect(attempts).toBe(2);
    });
  });

  describe("circuit breaker integration", () => {
    it("should reject when circuit breaker is open", async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 60000,
      });

      const failingOperation = jest.fn().mockRejectedValue(new Error("Fail"));

      try {
        await executeWithResilience({
          operation: failingOperation,
          options: {
            useCircuitBreaker: true,
            useRetry: false,
            timeout: 10000,
          },
          defaultTimeout: 10000,
          circuitBreaker: breaker,
          timeoutOperationName: "test operation",
        });
      } catch (e) {
        // Expected
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      await expect(
        executeWithResilience({
          operation: mockOperation,
          options: {
            useCircuitBreaker: true,
            useRetry: false,
            timeout: 10000,
          },
          defaultTimeout: 10000,
          circuitBreaker: breaker,
          timeoutOperationName: "test operation",
        }),
      ).rejects.toThrow("Circuit breaker is OPEN");
    });
  });
});
