import {
  STREAMING_TIMEOUT_MS,
  DEFAULT_MAX_RETRY_ATTEMPTS,
  CIRCUIT_BREAKER_DEFAULT_FAILURE_THRESHOLD,
  CIRCUIT_BREAKER_DEFAULT_RESET_TIMEOUT_MS,
  RATE_LIMITER_DEFAULT_MAX_REQUESTS,
  RATE_LIMITER_DEFAULT_WINDOW_MS,
} from '../config/constants';

export interface ResilienceConfig {
  timeout?: number;
  maxRetries?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerResetTimeout?: number;
}

export const DEFAULT_RESILIENCE_CONFIG: Required<ResilienceConfig> = {
  timeout: STREAMING_TIMEOUT_MS,
  maxRetries: DEFAULT_MAX_RETRY_ATTEMPTS,
  circuitBreakerThreshold: CIRCUIT_BREAKER_DEFAULT_FAILURE_THRESHOLD,
  circuitBreakerResetTimeout: CIRCUIT_BREAKER_DEFAULT_RESET_TIMEOUT_MS,
};

export interface RateLimitConfig {
  rateLimitRequests?: number;
  rateLimitWindow?: number;
}

export const DEFAULT_RATE_LIMIT_CONFIG: Required<RateLimitConfig> = {
  rateLimitRequests: RATE_LIMITER_DEFAULT_MAX_REQUESTS,
  rateLimitWindow: RATE_LIMITER_DEFAULT_WINDOW_MS,
};
