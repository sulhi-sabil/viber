import { ServiceFactory, CircuitBreakerConfigMap } from '../utils/service-factory';
import { SupabaseService, SupabaseConfig } from '../services/supabase';
import { GeminiService, GeminiConfig } from '../services/gemini';

describe('ServiceFactory', () => {
  beforeEach(() => {
    ServiceFactory.resetInstance();
    jest.clearAllMocks();
  });

  describe('singleton pattern', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = ServiceFactory.getInstance();
      const instance2 = ServiceFactory.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = ServiceFactory.getInstance();
      ServiceFactory.resetInstance();
      const instance2 = ServiceFactory.getInstance();

      expect(instance1).not.toBe(instance2);
    });

    it('should use provided configs on first call', () => {
      const config: CircuitBreakerConfigMap = {
        supabase: {
          failureThreshold: 10,
          resetTimeout: 120000,
        },
      };

      const factory = ServiceFactory.getInstance(config);
      const factory2 = ServiceFactory.getInstance();

      expect(factory).toBe(factory2);
    });
  });

  describe('circuit breaker management', () => {
    it('should create circuit breaker for new service', () => {
      const factory = ServiceFactory.getInstance();
      const circuitBreaker = factory.getCircuitBreaker('test-service');

      expect(circuitBreaker).toBeDefined();
      expect(typeof circuitBreaker.execute).toBe('function');
      expect(typeof circuitBreaker.getState).toBe('function');
      expect(typeof circuitBreaker.getMetrics).toBe('function');
      expect(typeof circuitBreaker.reset).toBe('function');
    });

    it('should cache circuit breakers by service name', () => {
      const factory = ServiceFactory.getInstance();
      const circuitBreaker1 = factory.getCircuitBreaker('service1');
      const circuitBreaker2 = factory.getCircuitBreaker('service1');
      const circuitBreaker3 = factory.getCircuitBreaker('service2');

      expect(circuitBreaker1).toBe(circuitBreaker2);
      expect(circuitBreaker1).not.toBe(circuitBreaker3);
    });

    it('should reset specific circuit breaker', () => {
      const factory = ServiceFactory.getInstance();
      const circuitBreaker = factory.getCircuitBreaker('test-service');

      factory.resetCircuitBreaker('test-service');

      const state = circuitBreaker.getState();
      expect(state).toBe('closed');
    });

    it('should reset all circuit breakers', () => {
      const factory = ServiceFactory.getInstance();

      factory.getCircuitBreaker('service1');
      factory.getCircuitBreaker('service2');
      factory.getCircuitBreaker('service3');

      factory.resetAllCircuitBreakers();

      const state1 = factory.getCircuitBreaker('service1').getState();
      const state2 = factory.getCircuitBreaker('service2').getState();
      const state3 = factory.getCircuitBreaker('service3').getState();

      expect(state1).toBe('closed');
      expect(state2).toBe('closed');
      expect(state3).toBe('closed');
    });

    it('should get circuit breaker state for specific service', () => {
      const factory = ServiceFactory.getInstance();
      factory.getCircuitBreaker('test-service');

      const state = factory.getCircuitBreakerState('test-service');

      expect(state).not.toBeNull();
      expect(state).toHaveProperty('state');
      expect(state).toHaveProperty('metrics');
    });

    it('should return null for non-existent circuit breaker state', () => {
      const factory = ServiceFactory.getInstance();

      const state = factory.getCircuitBreakerState('non-existent');

      expect(state).toBeNull();
    });

    it('should get all circuit breaker states', () => {
      const factory = ServiceFactory.getInstance();

      factory.getCircuitBreaker('service1');
      factory.getCircuitBreaker('service2');

      const states = factory.getAllCircuitBreakerStates();

      expect(states).toHaveProperty('service1');
      expect(states).toHaveProperty('service2');
      expect(states.service1).toHaveProperty('state');
      expect(states.service1).toHaveProperty('metrics');
    });
  });

  describe('service creation', () => {
    it('should create Supabase service', () => {
      const factory = ServiceFactory.getInstance();
      const config: SupabaseConfig = {
        url: 'https://test.supabase.co',
        anonKey: 'test-key',
      };

      const service = factory.createSupabaseClient(config);

      expect(service).toBeInstanceOf(SupabaseService);
      expect(service.client).toBeDefined();
    });

    it('should create Gemini service', () => {
      const factory = ServiceFactory.getInstance();
      const config: GeminiConfig = {
        apiKey: 'test-api-key',
      };

      const service = factory.createGeminiClient(config);

      expect(service).toBeInstanceOf(GeminiService);
      expect(service).toBeDefined();
    });

    it('should cache Supabase services by URL', () => {
      const factory = ServiceFactory.getInstance();
      const config: SupabaseConfig = {
        url: 'https://test.supabase.co',
        anonKey: 'test-key',
      };

      const service1 = factory.createSupabaseClient(config);
      const service2 = factory.createSupabaseClient(config);

      expect(service1).toBe(service2);
    });

    it('should cache Gemini services by API key', () => {
      const factory = ServiceFactory.getInstance();
      const config: GeminiConfig = {
        apiKey: 'test-api-key',
      };

      const service1 = factory.createGeminiClient(config);
      const service2 = factory.createGeminiClient(config);

      expect(service1).toBe(service2);
    });

    it('should create new instance for different Supabase URLs', () => {
      const factory = ServiceFactory.getInstance();
      const config1: SupabaseConfig = {
        url: 'https://test1.supabase.co',
        anonKey: 'test-key',
      };
      const config2: SupabaseConfig = {
        url: 'https://test2.supabase.co',
        anonKey: 'test-key',
      };

      const service1 = factory.createSupabaseClient(config1);
      const service2 = factory.createSupabaseClient(config2);

      expect(service1).not.toBe(service2);
    });

    it('should create new instance for different Gemini API keys', () => {
      const factory = ServiceFactory.getInstance();
      const config1: GeminiConfig = {
        apiKey: 'test-api-key-1',
      };
      const config2: GeminiConfig = {
        apiKey: 'other-api-key-2',
      };

      const service1 = factory.createGeminiClient(config1);
      const service2 = factory.createGeminiClient(config2);

      expect(service1).not.toBe(service2);
    });
  });

  describe('service lifecycle', () => {
    it('should reset specific service', () => {
      const factory = ServiceFactory.getInstance();
      const config: SupabaseConfig = {
        url: 'https://test.supabase.co',
        anonKey: 'test-key',
      };

      const service1 = factory.createSupabaseClient(config);
      factory.resetService('supabase-https://test.supabase.co');

      const service2 = factory.createSupabaseClient(config);

      expect(service1).not.toBe(service2);
    });

    it('should reset all services', () => {
      const factory = ServiceFactory.getInstance();

      const config1: SupabaseConfig = {
        url: 'https://test1.supabase.co',
        anonKey: 'test-key',
      };
      const config2: GeminiConfig = {
        apiKey: 'test-api-key',
      };

      factory.createSupabaseClient(config1);
      factory.createGeminiClient(config2);

      factory.resetAllServices();

      const service1 = factory.createSupabaseClient(config1);
      const service2 = factory.createGeminiClient(config2);

      expect(service1).not.toBe(service2);
    });

    it('should get service by name', () => {
      const factory = ServiceFactory.getInstance();
      const config: SupabaseConfig = {
        url: 'https://test.supabase.co',
        anonKey: 'test-key',
      };

      const createdService = factory.createSupabaseClient(config);
      const retrievedService = factory.getService('supabase-https://test.supabase.co');

      expect(retrievedService).toBe(createdService);
    });
  });

  describe('circuit breaker configuration', () => {
    it('should use custom config for Supabase', () => {
      const config: CircuitBreakerConfigMap = {
        supabase: {
          failureThreshold: 10,
          resetTimeout: 120000,
        },
      };

      const factory = ServiceFactory.getInstance(config);
      const circuitBreaker = factory.getCircuitBreaker('supabase');

      const state = circuitBreaker.getState();
      expect(state).toBe('closed');
    });

    it('should use custom config for Gemini', () => {
      const config: CircuitBreakerConfigMap = {
        gemini: {
          failureThreshold: 3,
          resetTimeout: 30000,
        },
      };

      const factory = ServiceFactory.getInstance(config);
      const circuitBreaker = factory.getCircuitBreaker('gemini');

      const state = circuitBreaker.getState();
      expect(state).toBe('closed');
    });
  });

  describe('edge cases', () => {
    it('should handle empty circuit breaker config', () => {
      const factory = ServiceFactory.getInstance({});

      expect(() => factory.getCircuitBreaker('test-service')).not.toThrow();
    });

    it('should handle empty service name', () => {
      const factory = ServiceFactory.getInstance();

      expect(() => factory.getCircuitBreaker('')).not.toThrow();
    });

    it('should handle resetting non-existent service', () => {
      const factory = ServiceFactory.getInstance();

      expect(() => factory.resetService('non-existent')).not.toThrow();
    });

    it('should handle resetting non-existent circuit breaker', () => {
      const factory = ServiceFactory.getInstance();

      expect(() => factory.resetCircuitBreaker('non-existent')).not.toThrow();
    });

    it('should handle special characters in service name', () => {
      const factory = ServiceFactory.getInstance();

      expect(() => factory.getCircuitBreaker('test-service_v1')).not.toThrow();
    });
  });
});
