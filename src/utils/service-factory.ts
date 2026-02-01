import {
  CircuitBreaker,
  DEFAULT_CIRCUIT_BREAKER_OPTIONS,
} from "./circuit-breaker";
import { logger } from "./logger";
import { SupabaseService, SupabaseConfig } from "../services/supabase";
import { GeminiService, GeminiConfig } from "../services/gemini";

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

  private constructor(circuitBreakerConfigMap: CircuitBreakerConfigMap = {}) {
    this.circuitBreakers = new Map();
    this.services = new Map();
    this.circuitBreakerConfigs = circuitBreakerConfigMap;
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
    this.services.set(cacheKey, service);
    return service;
  }

  createGeminiClient(config: GeminiConfig): GeminiService {
    const cacheKey = `gemini-${config.apiKey.substring(0, 8)}`;
    const cached = this.services.get(cacheKey) as GeminiService;
    if (cached) {
      return cached;
    }

    const circuitBreaker = this.getCircuitBreaker("gemini");
    const service = new GeminiService(config, circuitBreaker);
    this.services.set(cacheKey, service);
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
}

export const serviceFactory = ServiceFactory.getInstance();
