import { CircuitBreaker } from "../utils/circuit-breaker";
import { logger } from "../utils/logger";

export interface ServiceHealth {
  healthy: boolean;
  latency: number;
  error?: string;
}

export abstract class BaseService {
  protected abstract serviceName: string;
  protected circuitBreaker: CircuitBreaker;

  constructor(circuitBreaker: CircuitBreaker) {
    this.circuitBreaker = circuitBreaker;
  }

  protected getCircuitBreakerState() {
    return {
      state: this.circuitBreaker.getState(),
      metrics: this.circuitBreaker.getMetrics(),
    };
  }

  protected getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }

  protected resetCircuitBreaker(): void {
    logger.warn(`Manually resetting ${this.serviceName} circuit breaker`);
    this.circuitBreaker.reset();
  }

  public abstract healthCheck(): Promise<ServiceHealth>;
}
