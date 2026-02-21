import {
  MetricsRegistry,
  ServiceMetricsCollector,
  Counter,
  Histogram,
  Gauge,
  metricsRegistry,
  createServiceMetrics,
} from './metrics';

describe('MetricsRegistry', () => {
  let registry: MetricsRegistry;

  beforeEach(() => {
    registry = new MetricsRegistry();
  });

  afterEach(() => {
    registry.clear();
  });

  describe('Counter', () => {
    it('should create a counter', () => {
      const counter = registry.createCounter('test_counter', 'Test counter');
      expect(counter).toBeDefined();
      expect(counter.name).toBe('test_counter');
      expect(counter.help).toBe('Test counter');
    });

    it('should increment counter', () => {
      const counter = registry.createCounter('test_counter', 'Test counter');
      counter.increment();
      expect(counter.getValue()).toBe(1);
    });

    it('should increment counter by value', () => {
      const counter = registry.createCounter('test_counter', 'Test counter');
      counter.increment(5);
      expect(counter.getValue()).toBe(5);
    });

    it('should return same counter for same name and labels', () => {
      const counter1 = registry.createCounter('test_counter', 'Test counter', {
        service: 'test',
      });
      const counter2 = registry.createCounter('test_counter', 'Test counter', {
        service: 'test',
      });
      expect(counter1).toBe(counter2);
    });

    it('should export counter in Prometheus format', () => {
      const counter = registry.createCounter('test_counter', 'Test counter');
      counter.increment(10);
      const output = counter.toPrometheusString();
      expect(output).toContain('# HELP test_counter Test counter');
      expect(output).toContain('# TYPE test_counter counter');
      expect(output).toContain('test_counter 10');
    });

    it('should export counter with labels in Prometheus format', () => {
      const counter = registry.createCounter('test_counter', 'Test counter', {
        service: 'test',
      });
      counter.increment(5);
      const output = counter.toPrometheusString();
      expect(output).toContain('service="test"');
      expect(output).toContain('test_counter{service="test"} 5');
    });
  });

  describe('Histogram', () => {
    it('should create a histogram', () => {
      const histogram = registry.createHistogram('test_histogram', 'Test histogram');
      expect(histogram).toBeDefined();
      expect(histogram.name).toBe('test_histogram');
      expect(histogram.buckets.length).toBeGreaterThan(0);
    });

    it('should observe values in histogram', () => {
      const histogram = registry.createHistogram(
        'test_histogram',
        'Test histogram',
        [0.1, 0.5, 1, 2, 5]
      );
      histogram.observe(0.3);
      histogram.observe(1.5);
      histogram.observe(0.7);

      expect(histogram.getCount()).toBe(3);
      expect(histogram.getSum()).toBe(2.5);
    });

    it('should track bucket counts correctly', () => {
      const histogram = registry.createHistogram(
        'test_histogram',
        'Test histogram',
        [0.1, 0.5, 1, 2, 5]
      );
      histogram.observe(0.3);
      histogram.observe(0.7);
      histogram.observe(1.5);

      const buckets = histogram.getBuckets();
      expect(buckets.get(0.1)).toBe(0);
      expect(buckets.get(0.5)).toBe(1);
      expect(buckets.get(1)).toBe(2);
      expect(buckets.get(2)).toBe(3);
      expect(buckets.get(5)).toBe(3);
    });

    it('should export histogram in Prometheus format', () => {
      const histogram = registry.createHistogram(
        'test_histogram',
        'Test histogram',
        [0.1, 0.5, 1, 2, 5]
      );
      histogram.observe(0.3);
      histogram.observe(1.5);

      const output = histogram.toPrometheusString();
      expect(output).toContain('# HELP test_histogram Test histogram');
      expect(output).toContain('# TYPE test_histogram histogram');
      expect(output).toContain('test_histogram_bucket');
      expect(output).toContain('test_histogram_sum');
      expect(output).toContain('test_histogram_count');
    });
  });

  describe('Gauge', () => {
    it('should create a gauge', () => {
      const gauge = registry.createGauge('test_gauge', 'Test gauge');
      expect(gauge).toBeDefined();
      expect(gauge.name).toBe('test_gauge');
    });

    it('should set gauge value', () => {
      const gauge = registry.createGauge('test_gauge', 'Test gauge');
      gauge.set(42);
      expect(gauge.getValue()).toBe(42);
    });

    it('should increment gauge', () => {
      const gauge = registry.createGauge('test_gauge', 'Test gauge');
      gauge.set(10);
      gauge.increment();
      expect(gauge.getValue()).toBe(11);
    });

    it('should decrement gauge', () => {
      const gauge = registry.createGauge('test_gauge', 'Test gauge');
      gauge.set(10);
      gauge.decrement();
      expect(gauge.getValue()).toBe(9);
    });

    it('should increment gauge by value', () => {
      const gauge = registry.createGauge('test_gauge', 'Test gauge');
      gauge.increment(5);
      expect(gauge.getValue()).toBe(5);
    });

    it('should decrement gauge by value', () => {
      const gauge = registry.createGauge('test_gauge', 'Test gauge');
      gauge.set(10);
      gauge.decrement(3);
      expect(gauge.getValue()).toBe(7);
    });
  });

  describe('Registry Operations', () => {
    it('should check if metric exists', () => {
      registry.createCounter('test_counter', 'Test counter');
      expect(registry.hasMetric('test_counter')).toBe(true);
      expect(registry.hasMetric('nonexistent')).toBe(false);
    });

    it('should get metric by name', () => {
      const counter = registry.createCounter('test_counter', 'Test counter');
      const retrieved = registry.getMetric('test_counter');
      expect(retrieved).toBe(counter);
    });

    it('should remove metric', () => {
      registry.createCounter('test_counter', 'Test counter');
      expect(registry.hasMetric('test_counter')).toBe(true);
      registry.removeMetric('test_counter');
      expect(registry.hasMetric('test_counter')).toBe(false);
    });

    it('should get all metric names', () => {
      registry.createCounter('counter1', 'Counter 1');
      registry.createGauge('gauge1', 'Gauge 1');
      const names = registry.getMetricNames();
      expect(names).toContain('counter1');
      expect(names).toContain('gauge1');
    });

    it('should clear all metrics', () => {
      registry.createCounter('counter1', 'Counter 1');
      registry.createGauge('gauge1', 'Gauge 1');
      registry.clear();
      expect(registry.getMetricNames().length).toBe(0);
    });

    it('should export all metrics in Prometheus format', () => {
      registry.createCounter('requests_total', 'Total requests');
      registry.createGauge('active_requests', 'Active requests');
      const output = registry.toPrometheusString();
      expect(output).toContain('# HELP requests_total');
      expect(output).toContain('# HELP active_requests');
    });

    it('should throw error for duplicate metric with different type', () => {
      registry.createCounter('test_metric', 'Test metric');
      expect(() => {
        registry.createGauge('test_metric', 'Test metric');
      }).toThrow();
    });
  });
});

describe('ServiceMetricsCollector', () => {
  let collector: ServiceMetricsCollector;
  let registry: MetricsRegistry;

  beforeEach(() => {
    registry = new MetricsRegistry();
    collector = new ServiceMetricsCollector('test-service', registry);
  });

  afterEach(() => {
    registry.clear();
  });

  it('should record requests', () => {
    collector.recordRequest();
    collector.recordRequest();
    const metric = registry.getMetric('service_requests_total', {
      service: 'test-service',
    }) as Counter;
    expect(metric.getValue()).toBe(2);
  });

  it('should track active requests', () => {
    collector.recordRequest();
    collector.recordRequest();
    let metric = registry.getMetric('service_active_requests', {
      service: 'test-service',
    }) as Gauge;
    expect(metric.getValue()).toBe(2);

    collector.recordRequestComplete(100);
    metric = registry.getMetric('service_active_requests', {
      service: 'test-service',
    }) as Gauge;
    expect(metric.getValue()).toBe(1);
  });

  it('should record request duration in histogram', () => {
    collector.recordRequestComplete(500); // 500ms
    const metric = registry.getMetric('service_request_duration_seconds', {
      service: 'test-service',
    }) as Histogram;
    expect(metric.getCount()).toBe(1);
    expect(metric.getSum()).toBe(0.5); // Converted to seconds
  });

  it('should record errors', () => {
    collector.recordError();
    collector.recordError();
    const metric = registry.getMetric('service_errors_total', {
      service: 'test-service',
    }) as Counter;
    expect(metric.getValue()).toBe(2);
  });

  it('should record errors by type', () => {
    collector.recordError('timeout');
    collector.recordError('timeout');
    collector.recordError('connection');

    const timeoutMetric = registry.getMetric('service_errors_by_type_total', {
      service: 'test-service',
      type: 'timeout',
    }) as Counter;
    expect(timeoutMetric.getValue()).toBe(2);

    const connMetric = registry.getMetric('service_errors_by_type_total', {
      service: 'test-service',
      type: 'connection',
    }) as Counter;
    expect(connMetric.getValue()).toBe(1);
  });

  it('should update circuit breaker state', () => {
    collector.updateCircuitBreakerState('open');
    const metric = registry.getMetric('service_circuit_breaker_state', {
      service: 'test-service',
    }) as Gauge;
    expect(metric.getValue()).toBe(1);

    collector.updateCircuitBreakerState('closed');
    expect(metric.getValue()).toBe(0);

    collector.updateCircuitBreakerState('half-open');
    expect(metric.getValue()).toBe(2);
  });

  it('should record rate limit hits and misses', () => {
    collector.recordRateLimitHit();
    collector.recordRateLimitHit();
    collector.recordRateLimitMiss();

    const hits = registry.getMetric('service_rate_limit_hits_total', {
      service: 'test-service',
    }) as Counter;
    expect(hits.getValue()).toBe(2);

    const misses = registry.getMetric('service_rate_limit_misses_total', {
      service: 'test-service',
    }) as Counter;
    expect(misses.getValue()).toBe(1);
  });
});

describe('createServiceMetrics helper', () => {
  it('should create a ServiceMetricsCollector', () => {
    const collector = createServiceMetrics('my-service');
    expect(collector).toBeInstanceOf(ServiceMetricsCollector);
  });
});

describe('global metricsRegistry', () => {
  afterEach(() => {
    metricsRegistry.clear();
  });

  it('should be a singleton instance', () => {
    const counter1 = metricsRegistry.createCounter('global_test', 'Test');
    const counter2 = metricsRegistry.createCounter('global_test', 'Test');
    expect(counter1).toBe(counter2);
  });
});
