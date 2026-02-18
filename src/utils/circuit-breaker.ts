import { ServiceUnavailableError } from "./errors";
import {
  CIRCUIT_BREAKER_DEFAULT_FAILURE_THRESHOLD,
  CIRCUIT_BREAKER_DEFAULT_RESET_TIMEOUT_MS,
  CIRCUIT_BREAKER_DEFAULT_HALF_OPEN_MAX_CALLS,
  CIRCUIT_BREAKER_DEFAULT_MONITOR_WINDOW_MS,
  CIRCUIT_BREAKER_MIN_CLEANUP_THRESHOLD,
  CIRCUIT_BREAKER_CLEANUP_THRESHOLD_MULTIPLIER,
} from "../config/constants";

export enum CircuitState {
  CLOSED = "closed",
  OPEN = "open",
  HALF_OPEN = "half_open",
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;
  halfOpenMaxCalls?: number;
  monitorWindow?: number;
  onStateChange?: (state: CircuitState, reason: string) => void;
}

export const DEFAULT_CIRCUIT_BREAKER_OPTIONS: Required<CircuitBreakerOptions> =
  {
    failureThreshold: CIRCUIT_BREAKER_DEFAULT_FAILURE_THRESHOLD,
    resetTimeout: CIRCUIT_BREAKER_DEFAULT_RESET_TIMEOUT_MS,
    halfOpenMaxCalls: CIRCUIT_BREAKER_DEFAULT_HALF_OPEN_MAX_CALLS,
    monitorWindow: CIRCUIT_BREAKER_DEFAULT_MONITOR_WINDOW_MS,
    onStateChange: () => {},
  };

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private halfOpenCallCount = 0;
  private failures: number[] = [];
  private successes: number[] = [];
  private mergedOptions: Required<CircuitBreakerOptions>;
  private lastCleanupTime = 0;

  constructor(options: CircuitBreakerOptions = {}) {
    this.mergedOptions = { ...DEFAULT_CIRCUIT_BREAKER_OPTIONS, ...options };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen("Reset timeout elapsed");
      } else {
        const remainingMs = this.lastFailureTime
          ? this.mergedOptions.resetTimeout -
            (Date.now() - this.lastFailureTime)
          : this.mergedOptions.resetTimeout;
        const remainingSec = Math.ceil(remainingMs / 1000);
        const failureInfo =
          this.failureCount > 0
            ? ` (${this.failureCount}/${this.mergedOptions.failureThreshold} failures)`
            : "";
        throw new ServiceUnavailableError(
          "circuit breaker",
          `Circuit breaker is OPEN${failureInfo}. Requests are temporarily blocked. Will retry in ${remainingSec}s`,
          {
            failureCount: this.failureCount,
            failureThreshold: this.mergedOptions.failureThreshold,
            resetTimeoutSec: Math.ceil(this.mergedOptions.resetTimeout / 1000),
            remainingSec,
            lastFailureTime: this.lastFailureTime,
          },
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.successCount++;
    this.successes.push(Date.now());

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenCallCount++;

      if (this.halfOpenCallCount >= this.mergedOptions.halfOpenMaxCalls) {
        this.transitionToClosed("Half-open calls succeeded");
      }
    } else {
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.failures.push(Date.now());

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionToOpen("Half-open call failed");
    } else if (this.failureCount >= this.mergedOptions.failureThreshold) {
      this.transitionToOpen(
        `Failure threshold (${this.mergedOptions.failureThreshold}) reached`,
      );
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;
    return Date.now() - this.lastFailureTime >= this.mergedOptions.resetTimeout;
  }

  private transitionToOpen(reason: string): void {
    if (this.state !== CircuitState.OPEN) {
      this.state = CircuitState.OPEN;
      this.halfOpenCallCount = 0;
      this.mergedOptions.onStateChange?.(CircuitState.OPEN, reason);
    }
  }

  private transitionToClosed(reason: string): void {
    if (this.state !== CircuitState.CLOSED) {
      this.state = CircuitState.CLOSED;
      this.failureCount = 0;
      this.halfOpenCallCount = 0;
      this.mergedOptions.onStateChange?.(CircuitState.CLOSED, reason);
    }
  }

  private transitionToHalfOpen(reason: string): void {
    if (this.state !== CircuitState.HALF_OPEN) {
      this.state = CircuitState.HALF_OPEN;
      this.halfOpenCallCount = 0;
      this.mergedOptions.onStateChange?.(CircuitState.HALF_OPEN, reason);
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics() {
    this.cleanupOldMetricsLazy();

    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      failuresInWindow: this.failures.length,
      successesInWindow: this.successes.length,
      lastFailureTime: this.lastFailureTime,
    };
  }

  private cleanupOldMetricsLazy(): void {
    const now = Date.now();
    const totalItems = this.failures.length + this.successes.length;

    const cleanupThreshold = Math.max(
      CIRCUIT_BREAKER_MIN_CLEANUP_THRESHOLD,
      this.mergedOptions.failureThreshold *
        CIRCUIT_BREAKER_CLEANUP_THRESHOLD_MULTIPLIER,
    );
    const timeSinceLastCleanup = now - this.lastCleanupTime;
    const minCleanupInterval = this.mergedOptions.monitorWindow / 2;

    if (
      totalItems <= cleanupThreshold &&
      timeSinceLastCleanup < minCleanupInterval
    ) {
      return;
    }

    const cutoff = now - this.mergedOptions.monitorWindow;

    this.failures = this.failures.filter((time: number) => time > cutoff);
    this.successes = this.successes.filter((time: number) => time > cutoff);

    this.lastCleanupTime = now;
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.halfOpenCallCount = 0;
    this.failures = [];
    this.successes = [];
    this.lastCleanupTime = 0;
    this.mergedOptions.onStateChange?.(CircuitState.CLOSED, "Manual reset");
  }
}

export function createCircuitBreaker(
  options?: CircuitBreakerOptions,
): CircuitBreaker {
  return new CircuitBreaker(options);
}
