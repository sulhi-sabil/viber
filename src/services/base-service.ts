import { CircuitBreaker, CircuitBreakerOptions, CircuitState } from '../utils/circuit-breaker';
import { executeWithResilience } from '../utils/resilience';
import { logger } from '../utils/logger';
import { ServiceMetricsCollector } from '../utils/metrics';

const CIRCUIT_STATE_INDICATORS: Record<CircuitState, string> = {
  [CircuitState.CLOSED]: '✅',
  [CircuitState.OPEN]: '⛔',
  [CircuitState.HALF_OPEN]: '⚠️',
};

export interface ServiceHealth {
  healthy: boolean;
  latency: number;
  error?: string;
}

export interface ResilienceExecutionOptions {
  timeout?: number;
  useCircuitBreaker?: boolean;
  useRetry?: boolean;
}

export interface ServiceResilienceConfig {
  timeout: number;
  maxRetries: number;
  retryableErrors: number[];
  retryableErrorCodes: string[];
}

export abstract class BaseService {
  protected abstract serviceName: string;
  protected circuitBreaker: CircuitBreaker;
  protected metricsCollector?: ServiceMetricsCollector;

  constructor(circuitBreaker: CircuitBreaker, metricsCollector?: ServiceMetricsCollector) {
    this.circuitBreaker = circuitBreaker;
    this.metricsCollector = metricsCollector;
  }

  /**
   * Set the metrics collector for this service
   */
  public setMetricsCollector(metricsCollector: ServiceMetricsCollector): void {
    this.metricsCollector = metricsCollector;
  }

  /**
   * Get the metrics collector
   */
  public getMetricsCollector(): ServiceMetricsCollector | undefined {
    return this.metricsCollector;
  }

  /**
   * Create a circuit breaker with standardized defaults for services.
   * Uses service name in state change logging.
   */
  protected static createCircuitBreaker(
    serviceName: string,
    options: CircuitBreakerOptions
  ): CircuitBreaker {
    return new CircuitBreaker({
      ...options,
      onStateChange: (state, reason) => {
        const indicator = CIRCUIT_STATE_INDICATORS[state];
        logger.warn(
          `${serviceName} circuit breaker ${indicator} state changed to ${state}: ${reason}`
        );
      },
    });
  }

  /**
   * Get the resilience configuration for this service.
   * Each service must implement this to provide its specific config.
   */
  protected abstract getResilienceConfig(): ServiceResilienceConfig;

  /**
   * Execute an operation with resilience patterns (circuit breaker, retry, timeout).
   * This consolidates common resilience logic across all services.
   */
  protected async executeWithResilience<T>(
    operation: () => Promise<T>,
    options: ResilienceExecutionOptions = {},
    operationName: string = 'Service operation'
  ): Promise<T> {
    const config = this.getResilienceConfig();

    return executeWithResilience<T>({
      operation,
      options,
      defaultTimeout: config.timeout,
      circuitBreaker: this.circuitBreaker,
      maxRetries: config.maxRetries,
      retryableErrors: config.retryableErrors,
      retryableErrorCodes: config.retryableErrorCodes,
      onRetry: (attempt: number, error: Error) => {
        logger.warn(`${operationName} retry attempt ${attempt}`, {
          error: error.message,
        });
      },
      timeoutOperationName: operationName,
      operationName,
    });
  }

  public getCircuitBreakerState() {
    return {
      state: this.circuitBreaker.getState(),
      metrics: this.circuitBreaker.getMetrics(),
    };
  }

  public getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }

  public resetCircuitBreaker(): void {
    logger.warn(`Manually resetting ${this.serviceName} circuit breaker`);
    this.circuitBreaker.reset();
  }

  protected async executeHealthCheck(operation: () => Promise<void>): Promise<ServiceHealth> {
    const start = Date.now();

    try {
      await operation();

      const latency = Date.now() - start;

      logger.info(`${this.serviceName} health check passed`, { latency });

      return {
        healthy: true,
        latency,
      };
    } catch (error) {
      const latency = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error(`${this.serviceName} health check failed`, {
        error: errorMessage,
        latency,
      });

      return {
        healthy: false,
        latency,
        error: errorMessage,
      };
    }
  }

  public abstract healthCheck(): Promise<ServiceHealth>;
}
