import {
  CircuitBreaker,
  CircuitBreakerOptions,
} from "../utils/circuit-breaker";
import { logger } from "../utils/logger";
import { ServiceMetricsCollector } from "../utils/metrics";

export interface ServiceHealth {
  healthy: boolean;
  latency: number;
  error?: string;
}

export abstract class BaseService {
  protected abstract serviceName: string;
  protected circuitBreaker: CircuitBreaker;
  protected metricsCollector?: ServiceMetricsCollector;

  constructor(
    circuitBreaker: CircuitBreaker,
    metricsCollector?: ServiceMetricsCollector,
  ) {
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
    options: CircuitBreakerOptions,
  ): CircuitBreaker {
    return new CircuitBreaker({
      ...options,
      onStateChange: (state, reason) => {
        logger.warn(
          `${serviceName} circuit breaker state changed to ${state}: ${reason}`,
        );
      },
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

  protected async executeHealthCheck(
    operation: () => Promise<void>,
  ): Promise<ServiceHealth> {
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
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

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
