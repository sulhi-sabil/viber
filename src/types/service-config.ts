/**
 * Service configuration types
 * Note: Default values are defined inline to maintain layer purity
 * (types should not import from config layer)
 */

export interface ResilienceConfig {
  timeout?: number;
  maxRetries?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerResetTimeout?: number;
}

/** Default resilience configuration values */
export const DEFAULT_RESILIENCE_CONFIG: Required<ResilienceConfig> = {
  timeout: 30000,        // Default timeout for streaming operations (ms)
  maxRetries: 3,         // Default maximum retry attempts
  circuitBreakerThreshold: 5,     // Default failure threshold before opening circuit
  circuitBreakerResetTimeout: 60000, // Default reset timeout for circuit breaker (ms)
};

export interface RateLimitConfig {
  rateLimitRequests?: number;
  rateLimitWindow?: number;
}

/** Default rate limit configuration values */
export const DEFAULT_RATE_LIMIT_CONFIG: Required<RateLimitConfig> = {
  rateLimitRequests: 15,  // Default maximum requests per window
  rateLimitWindow: 60000, // Default time window for rate limiting (ms)
};

export interface QueryOptions {
  /** Timeout for the operation in milliseconds */
  timeout?: number;
  /** Whether to use circuit breaker protection */
  useCircuitBreaker?: boolean;
  /** Whether to use retry logic */
  useRetry?: boolean;
}

