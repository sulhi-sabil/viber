import {
  CircuitBreaker,
  DEFAULT_CIRCUIT_BREAKER_OPTIONS,
} from "./circuit-breaker";
import { logger } from "./logger";
import {
  SupabaseService,
  SupabaseConfig,
  isSupabaseService,
} from "../services/supabase";
import {
  GeminiService,
  GeminiConfig,
  isGeminiService,
} from "../services/gemini";
import { BaseService } from "../services/base-service";
import {
  HealthCheckRegistry,
  HealthCheckFunction,
  HealthCheckConfig,
  healthCheckRegistry,
} from "./health-check";
import {
  MetricsRegistry,
  ServiceMetricsCollector,
  metricsRegistry,
} from "./metrics";
import {
  MigrationRunner,
  SupabaseClient as MigrationSupabaseClient,
} from "../migrations/runner";
import { HEALTH_CHECK_TIMEOUT_MS } from "../config/constants";

export interface CircuitBreakerConfig {
  failureThreshold?: number;
  resetTimeout?: number;
  halfOpenMaxCalls?: number;
  monitorWindow?: number;
  onStateChange?: (state: string, reason: string) => void;
}

export interface ServiceFactoryConfig {
  supabase?: {
    config: SupabaseConfig;
    circuitBreaker?: CircuitBreakerConfig;
  };
  gemini?: {
    config: GeminiConfig;
    circuitBreaker?: CircuitBreakerConfig;
  };
}

export interface CircuitBreakerConfigMap {
  supabase?: CircuitBreakerConfig;
  gemini?: CircuitBreakerConfig;
}

export class ServiceFactory {
  private static instance: ServiceFactory;
  private circuitBreakers: Map<string, CircuitBreaker>;
  private services: Map<string, unknown>;
  private circuitBreakerConfigs: CircuitBreakerConfigMap;
  private healthCheckRegistry: HealthCheckRegistry;
  private metricsRegistry: MetricsRegistry;
  private serviceMetrics: Map<string, ServiceMetricsCollector>;

  private constructor(circuitBreakerConfigMap: CircuitBreakerConfigMap = {}) {
    this.circuitBreakers = new Map();
    this.services = new Map();
    this.circuitBreakerConfigs = circuitBreakerConfigMap;
    this.healthCheckRegistry = healthCheckRegistry;
    this.metricsRegistry = metricsRegistry;
    this.serviceMetrics = new Map();
  }

  static getInstance(
    circuitBreakerConfigs?: CircuitBreakerConfigMap,
  ): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory(circuitBreakerConfigs);
    }
    return ServiceFactory.instance;
  }

  static resetInstance(): void {
    ServiceFactory.instance = new ServiceFactory();
  }

  private createCircuitBreaker(
    serviceName: string,
    config?: CircuitBreakerConfig,
  ): CircuitBreaker {
    const finalConfig = {
      ...DEFAULT_CIRCUIT_BREAKER_OPTIONS,
      ...config,
      onStateChange: (state: string, reason: string) => {
        logger.warn(
          `${serviceName} circuit breaker state changed to ${state}: ${reason}`,
        );
        config?.onStateChange?.(state, reason);
      },
    };

    const circuitBreaker = new CircuitBreaker(finalConfig);
    this.circuitBreakers.set(serviceName, circuitBreaker);
    return circuitBreaker;
  }

  getCircuitBreaker(serviceName: string): CircuitBreaker {
    const cached = this.circuitBreakers.get(serviceName);
    if (cached) {
      return cached;
    }

    const config =
      this.circuitBreakerConfigs[serviceName as keyof CircuitBreakerConfigMap];
    return this.createCircuitBreaker(serviceName, config);
  }

  createSupabaseClient(config: SupabaseConfig): SupabaseService {
    const cacheKey = `supabase-${config.url}`;
    const cached = this.services.get(cacheKey) as SupabaseService;
    if (cached) {
      return cached;
    }

    const circuitBreaker = this.getCircuitBreaker("supabase");
    const service = new SupabaseService(config, circuitBreaker);
    const metricsCollector = this.registerServiceMetrics("supabase");
    service.setMetricsCollector(metricsCollector);
    this.services.set(cacheKey, service);
    this.registerServiceHealthCheck("supabase", service);
    return service;
  }

  createGeminiClient(config: GeminiConfig): GeminiService {
    const apiKeyPrefix =
      config.apiKey.length >= 8 ? config.apiKey.substring(0, 8) : config.apiKey;
    const cacheKey = `gemini-${apiKeyPrefix}`;
    const cached = this.services.get(cacheKey) as GeminiService;
    if (cached) {
      return cached;
    }

    const circuitBreaker = this.getCircuitBreaker("gemini");
    const service = new GeminiService(config, circuitBreaker);
    const metricsCollector = this.registerServiceMetrics("gemini");
    service.setMetricsCollector(metricsCollector);
    this.services.set(cacheKey, service);
    this.registerServiceHealthCheck("gemini", service);
    return service;
  }

  resetCircuitBreaker(serviceName: string): void {
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    if (circuitBreaker) {
      circuitBreaker.reset();
      logger.warn(`Reset circuit breaker for ${serviceName}`);
    }
  }

  resetAllCircuitBreakers(): void {
    this.circuitBreakers.forEach((circuitBreaker, serviceName) => {
      circuitBreaker.reset();
      logger.warn(`Reset circuit breaker for ${serviceName}`);
    });
  }

  getService(serviceName: string): unknown {
    return this.services.get(serviceName);
  }

  listServices(): Array<{ name: string; type: string }> {
    const services: Array<{ name: string; type: string }> = [];
    this.services.forEach((service, key) => {
      const type = isSupabaseService(service)
        ? "supabase"
        : isGeminiService(service)
          ? "gemini"
          : "unknown";
      services.push({ name: key, type });
    });
    return services;
  }

  resetService(serviceName: string): void {
    this.services.delete(serviceName);
  }

  resetAllServices(): void {
    this.services.clear();
  }

  getCircuitBreakerState(serviceName: string) {
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    if (!circuitBreaker) {
      return null;
    }

    return {
      state: circuitBreaker.getState(),
      metrics: circuitBreaker.getMetrics(),
    };
  }

  getAllCircuitBreakerStates(): Record<string, unknown> {
    const states: Record<string, unknown> = {};
    this.circuitBreakers.forEach((circuitBreaker, serviceName) => {
      states[serviceName] = {
        state: circuitBreaker.getState(),
        metrics: circuitBreaker.getMetrics(),
      };
    });
    return states;
  }

  /**
   * Register a health check for a service
   * @param serviceName - Service identifier
   * @param check - Health check function
   * @param config - Health check configuration
   */
  registerHealthCheck(
    serviceName: string,
    check: HealthCheckFunction,
    config?: Partial<HealthCheckConfig>,
  ): void {
    this.healthCheckRegistry.register(serviceName, check, config);
    logger.info(`Registered health check for service: ${serviceName}`);
  }

  /**
   * Execute health check for a specific service
   * @param serviceName - Service identifier
   * @returns Health check result
   */
  async checkHealth(serviceName: string) {
    return this.healthCheckRegistry.check(serviceName);
  }

  /**
   * Execute health checks for all registered services
   * @returns Aggregate health result
   */
  async checkAllHealth() {
    return this.healthCheckRegistry.checkAll();
  }

  /**
   * Get the health check registry
   * @returns HealthCheckRegistry instance
   */
  getHealthCheckRegistry(): HealthCheckRegistry {
    return this.healthCheckRegistry;
  }

  /**
   * Register health check for a BaseService instance
   * Converts ServiceHealth result to HealthCheckResult format
   */
  private registerServiceHealthCheck(
    serviceName: string,
    service: BaseService,
  ): void {
    if (this.healthCheckRegistry.isRegistered(serviceName)) {
      return;
    }

    const healthCheck: HealthCheckFunction = async () => {
      const start = Date.now();
      const health = await service.healthCheck();
      const responseTime = Date.now() - start;

      const metricsCollector = this.serviceMetrics.get(serviceName);
      if (metricsCollector) {
        metricsCollector.recordRequest();
        if (health.healthy) {
          metricsCollector.recordRequestComplete(responseTime);
        } else {
          metricsCollector.recordError("health_check_failed");
          metricsCollector.recordRequestComplete(responseTime);
        }
      }

      return {
        status: health.healthy ? "healthy" : "unhealthy",
        service: serviceName,
        timestamp: Date.now(),
        responseTime,
        message: health.error,
      };
    };

    this.healthCheckRegistry.register(serviceName, healthCheck, {
      timeout: HEALTH_CHECK_TIMEOUT_MS,
    });
  }

  /**
   * Get the metrics registry
   * @returns MetricsRegistry instance
   */
  getMetricsRegistry(): MetricsRegistry {
    return this.metricsRegistry;
  }

  /**
   * Create a migration runner for database schema management
   * @param config - Supabase configuration for migrations
   * @returns MigrationRunner instance
   */
  createMigrationRunner(config: SupabaseConfig): MigrationRunner {
    const client = this.createSupabaseClient(config);
    return new MigrationRunner(client as unknown as MigrationSupabaseClient);
  }

  /**
   * Export all metrics in Prometheus format
   * @returns Prometheus-formatted metrics string
   */
  exportMetrics(): string {
    return this.metricsRegistry.toPrometheusString();
  }

  /**
   * Register metrics collector for a service
   * @param serviceName - Service identifier
   */
  private registerServiceMetrics(serviceName: string): ServiceMetricsCollector {
    if (this.serviceMetrics.has(serviceName)) {
      return this.serviceMetrics.get(serviceName)!;
    }

    const metricsCollector = new ServiceMetricsCollector(
      serviceName,
      this.metricsRegistry,
    );
    this.serviceMetrics.set(serviceName, metricsCollector);
    logger.info(`Registered metrics collector for service: ${serviceName}`);
    return metricsCollector;
  }
}

export const serviceFactory = ServiceFactory.getInstance();
