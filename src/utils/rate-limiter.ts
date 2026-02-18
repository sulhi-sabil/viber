import { logger } from "./logger";
import {
  RATE_LIMITER_DEFAULT_MAX_REQUESTS,
  RATE_LIMITER_DEFAULT_WINDOW_MS,
  RATE_LIMITER_MIN_CLEANUP_THRESHOLD,
  RATE_LIMITER_CLEANUP_THRESHOLD_MULTIPLIER,
} from "../config/constants";

export interface RateLimiterOptions {
  maxRequests?: number;
  windowMs?: number;
  cleanupThreshold?: number;
  serviceName?: string;
}

export interface RateLimiterMetrics {
  totalRequests: number;
  activeRequests: number;
  remainingRequests: number;
  windowStart: number;
  windowEnd: number;
}

const DEFAULT_RATE_LIMITER_OPTIONS: Required<
  Omit<RateLimiterOptions, "serviceName">
> = {
  maxRequests: RATE_LIMITER_DEFAULT_MAX_REQUESTS,
  windowMs: RATE_LIMITER_DEFAULT_WINDOW_MS,
  cleanupThreshold: RATE_LIMITER_MIN_CLEANUP_THRESHOLD,
};

export class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private windowMs: number;
  private lastCleanupTime: number;
  private cleanupThreshold: number;
  private serviceName: string;

  constructor(options: RateLimiterOptions = {}) {
    const mergedOptions = { ...DEFAULT_RATE_LIMITER_OPTIONS, ...options };
    this.maxRequests = mergedOptions.maxRequests;
    this.windowMs = mergedOptions.windowMs;
    this.serviceName = mergedOptions.serviceName ?? "RateLimiter";
    this.lastCleanupTime = Date.now();
    this.cleanupThreshold =
      mergedOptions.cleanupThreshold ??
      Math.max(
        RATE_LIMITER_MIN_CLEANUP_THRESHOLD,
        this.maxRequests * RATE_LIMITER_CLEANUP_THRESHOLD_MULTIPLIER,
      );
  }

  async checkRateLimit(): Promise<void> {
    let now = Date.now();

    while (true) {
      this.lazyCleanup(now);

      const activeRequests = this.requests.filter(
        (time) => now - time < this.windowMs,
      ).length;

      if (activeRequests < this.maxRequests) {
        break;
      }

      if (this.requests.length > 0) {
        const oldestRequest = this.requests[0];
        const waitTime = this.windowMs - (now - oldestRequest);

        // Ensure waitTime is positive to prevent busy-waiting on clock drift
        if (waitTime > 0) {
          logger.warn(
            `${this.serviceName} rate limit reached. Waiting ${waitTime}ms`,
          );
          await this.sleep(waitTime);
        }
        // If waitTime <= 0, the oldest request has expired, continue loop to recalculate
      }

      now = Date.now();
    }

    this.requests.push(now);
  }

  getRemainingRequests(): number {
    const now = Date.now();

    if (this.requests.length < this.cleanupThreshold) {
      const activeRequests = this.requests.filter(
        (time) => now - time < this.windowMs,
      ).length;
      return Math.max(0, this.maxRequests - activeRequests);
    }

    const timeSinceLastCleanup = now - this.lastCleanupTime;
    if (timeSinceLastCleanup >= this.windowMs / 2) {
      this.requests = this.requests.filter(
        (time) => now - time < this.windowMs,
      );
      this.lastCleanupTime = now;
    }

    return Math.max(0, this.maxRequests - this.requests.length);
  }

  getMetrics(): RateLimiterMetrics {
    const now = Date.now();

    let activeRequests: number;
    let activeRequestsArray: number[];

    if (this.requests.length < this.cleanupThreshold) {
      activeRequestsArray = this.requests.filter(
        (time) => now - time < this.windowMs,
      );
      activeRequests = activeRequestsArray.length;
    } else {
      this.lazyCleanup(now);
      activeRequestsArray = this.requests;
      activeRequests = this.requests.length;
    }

    return {
      totalRequests: this.requests.length,
      activeRequests,
      remainingRequests: Math.max(0, this.maxRequests - activeRequests),
      windowStart:
        activeRequestsArray.length > 0 ? activeRequestsArray[0] : now,
      windowEnd: now,
    };
  }

  reset(): void {
    this.requests = [];
    this.lastCleanupTime = Date.now();
  }

  private lazyCleanup(now: number): void {
    if (this.requests.length < this.cleanupThreshold) {
      return;
    }

    const timeSinceLastCleanup = now - this.lastCleanupTime;
    if (timeSinceLastCleanup < this.windowMs / 2) {
      return;
    }

    this.requests = this.requests.filter((time) => now - time < this.windowMs);
    this.lastCleanupTime = now;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      const timerRef = timer as unknown as { unref?: () => void };
      if (typeof timerRef.unref === "function") {
        timerRef.unref();
      }
    });
  }
}

export function createRateLimiter(options?: RateLimiterOptions): RateLimiter {
  return new RateLimiter(options);
}
