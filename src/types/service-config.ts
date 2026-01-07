export interface ResilienceConfig {
  timeout?: number;
  maxRetries?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerResetTimeout?: number;
}

export const DEFAULT_RESILIENCE_CONFIG: Required<ResilienceConfig> = {
  timeout: 30000,
  maxRetries: 3,
  circuitBreakerThreshold: 5,
  circuitBreakerResetTimeout: 60000,
};

export interface RateLimitConfig {
  rateLimitRequests?: number;
  rateLimitWindow?: number;
}

export const DEFAULT_RATE_LIMIT_CONFIG: Required<RateLimitConfig> = {
  rateLimitRequests: 15,
  rateLimitWindow: 60000,
};
