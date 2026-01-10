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

  public abstract healthCheck(): Promise<ServiceHealth>;
}
