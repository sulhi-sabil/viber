/**
 * Metrics Collection System
 *
 * Provides Prometheus-compatible metrics collection for all services
 * with support for counters, histograms, and gauges.
 *
 * @module utils/metrics
 */

import { logger } from "./logger";
import { DEFAULT_LATENCY_HISTOGRAM_BUCKETS } from "../config/constants";

/**
 * Metric label type for dimensional metrics
 */
export type MetricLabels = Record<string, string | number>;

/**
 * Counter metric for incrementing values
 */
export interface Counter {
  /** Metric name */
  name: string;
  /** Metric description */
  help: string;
  /** Metric labels */
  labels?: MetricLabels;
  /** Increment the counter by value (default: 1) */
  increment(value?: number): void;
  /** Get current value */
  getValue(): number;
  /** Get Prometheus-formatted metric string */
  toPrometheusString(): string;
}

/**
 * Histogram metric for tracking value distributions
 */
export interface Histogram {
  /** Metric name */
  name: string;
  /** Metric description */
  help: string;
  /** Bucket boundaries */
  buckets: number[];
  /** Metric labels */
  labels?: MetricLabels;
  /** Observe a value */
  observe(value: number): void;
  /** Get bucket counts */
  getBuckets(): Map<number, number>;
  /** Get sum of all observed values */
  getSum(): number;
  /** Get count of all observations */
  getCount(): number;
  /** Get Prometheus-formatted metric string */
  toPrometheusString(): string;
}

/**
 * Gauge metric for values that can go up and down
 */
export interface Gauge {
  /** Metric name */
  name: string;
  /** Metric description */
  help: string;
  /** Metric labels */
  labels?: MetricLabels;
  /** Set gauge to specific value */
  set(value: number): void;
  /** Increment gauge by value (default: 1) */
  increment(value?: number): void;
  /** Decrement gauge by value (default: 1) */
  decrement(value?: number): void;
  /** Get current value */
  getValue(): number;
  /** Get Prometheus-formatted metric string */
  toPrometheusString(): string;
}

/**
 * Metric type enumeration
 */
export type MetricType = "counter" | "histogram" | "gauge";

/**
 * Counter implementation
 */
class CounterImpl implements Counter {
  public name: string;
  public help: string;
  public labels?: MetricLabels;
  private value: number = 0;

  constructor(name: string, help: string, labels?: MetricLabels) {
    this.name = name;
    this.help = help;
    this.labels = labels;
  }

  increment(value: number = 1): void {
    this.value += value;
  }

  getValue(): number {
    return this.value;
  }

  toPrometheusString(): string {
    const labelsStr = this.formatLabels();
    return [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} counter`,
      `${this.name}${labelsStr} ${this.value}`,
    ].join("\n");
  }

  private formatLabels(): string {
    if (!this.labels || Object.keys(this.labels).length === 0) {
      return "";
    }
    const labelPairs = Object.entries(this.labels).map(
      ([key, value]) => `${key}="${value}"`,
    );
    return `{${labelPairs.join(",")}}`;
  }
}

/**
 * Histogram implementation with bucket tracking
 */
class HistogramImpl implements Histogram {
  public name: string;
  public help: string;
  public buckets: number[];
  public labels?: MetricLabels;
  private bucketCounts: Map<number, number>;
  private sum: number = 0;
  private count: number = 0;

  constructor(
    name: string,
    help: string,
    buckets: number[],
    labels?: MetricLabels,
  ) {
    this.name = name;
    this.help = help;
    this.buckets = [...buckets].sort((a, b) => a - b);
    this.labels = labels;
    this.bucketCounts = new Map(this.buckets.map((b) => [b, 0]));
  }

  observe(value: number): void {
    this.sum += value;
    this.count++;

    // Increment all buckets where value <= bucket boundary
    for (const bucket of this.buckets) {
      if (value <= bucket) {
        const current = this.bucketCounts.get(bucket) || 0;
        this.bucketCounts.set(bucket, current + 1);
      }
    }
  }

  getBuckets(): Map<number, number> {
    return new Map(this.bucketCounts);
  }

  getSum(): number {
    return this.sum;
  }

  getCount(): number {
    return this.count;
  }

  toPrometheusString(): string {
    const labelsStr = this.formatLabels();
    const lines: string[] = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} histogram`,
    ];

    // Bucket lines
    for (const bucket of this.buckets) {
      const count = this.bucketCounts.get(bucket) || 0;
      const bucketLabels = labelsStr
        ? `${labelsStr.slice(0, -1)},le="${bucket}"}`
        : `{le="${bucket}"}`;
      lines.push(`${this.name}_bucket${bucketLabels} ${count}`);
    }

    // +Inf bucket
    const infLabels = labelsStr
      ? `${labelsStr.slice(0, -1)},le="+Inf"}`
      : `{le="+Inf"}`;
    lines.push(`${this.name}_bucket${infLabels} ${this.count}`);

    // Sum and count
    lines.push(`${this.name}_sum${labelsStr} ${this.sum}`);
    lines.push(`${this.name}_count${labelsStr} ${this.count}`);

    return lines.join("\n");
  }

  private formatLabels(): string {
    if (!this.labels || Object.keys(this.labels).length === 0) {
      return "";
    }
    const labelPairs = Object.entries(this.labels).map(
      ([key, value]) => `${key}="${value}"`,
    );
    return `{${labelPairs.join(",")}}`;
  }
}

/**
 * Gauge implementation
 */
class GaugeImpl implements Gauge {
  public name: string;
  public help: string;
  public labels?: MetricLabels;
  private value: number = 0;

  constructor(name: string, help: string, labels?: MetricLabels) {
    this.name = name;
    this.help = help;
    this.labels = labels;
  }

  set(value: number): void {
    this.value = value;
  }

  increment(value: number = 1): void {
    this.value += value;
  }

  decrement(value: number = 1): void {
    this.value -= value;
  }

  getValue(): number {
    return this.value;
  }

  toPrometheusString(): string {
    const labelsStr = this.formatLabels();
    return [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} gauge`,
      `${this.name}${labelsStr} ${this.value}`,
    ].join("\n");
  }

  private formatLabels(): string {
    if (!this.labels || Object.keys(this.labels).length === 0) {
      return "";
    }
    const labelPairs = Object.entries(this.labels).map(
      ([key, value]) => `${key}="${value}"`,
    );
    return `{${labelPairs.join(",")}}`;
  }
}

/**
 * Metrics registry for managing all metrics
 */
export class MetricsRegistry {
  private metrics: Map<string, Counter | Histogram | Gauge> = new Map();
  private metricNames: Set<string> = new Set();

  /**
   * Create or get a counter metric
   */
  createCounter(name: string, help: string, labels?: MetricLabels): Counter {
    const key = this.getMetricKey(name, labels);

    if (this.metrics.has(key)) {
      const existing = this.metrics.get(key);
      if (existing && "increment" in existing) {
        return existing as Counter;
      }
      throw new Error(`Metric ${name} already exists with different type`);
    }

    const counter = new CounterImpl(name, help, labels);
    this.metrics.set(key, counter);
    this.metricNames.add(name);
    return counter;
  }

  /**
   * Create or get a histogram metric
   */
  createHistogram(
    name: string,
    help: string,
    buckets: number[] = DEFAULT_LATENCY_HISTOGRAM_BUCKETS,
    labels?: MetricLabels,
  ): Histogram {
    const key = this.getMetricKey(name, labels);

    if (this.metrics.has(key)) {
      const existing = this.metrics.get(key);
      if (existing && "observe" in existing) {
        return existing as Histogram;
      }
      throw new Error(`Metric ${name} already exists with different type`);
    }

    const histogram = new HistogramImpl(name, help, buckets, labels);
    this.metrics.set(key, histogram);
    this.metricNames.add(name);
    return histogram;
  }

  /**
   * Create or get a gauge metric
   */
  createGauge(name: string, help: string, labels?: MetricLabels): Gauge {
    const key = this.getMetricKey(name, labels);

    if (this.metrics.has(key)) {
      const existing = this.metrics.get(key);
      if (existing && "set" in existing) {
        return existing as Gauge;
      }
      throw new Error(`Metric ${name} already exists with different type`);
    }

    const gauge = new GaugeImpl(name, help, labels);
    this.metrics.set(key, gauge);
    this.metricNames.add(name);
    return gauge;
  }

  /**
   * Get a metric by name and labels
   */
  getMetric(
    name: string,
    labels?: MetricLabels,
  ): Counter | Histogram | Gauge | undefined {
    const key = this.getMetricKey(name, labels);
    return this.metrics.get(key);
  }

  /**
   * Check if a metric exists
   */
  hasMetric(name: string, labels?: MetricLabels): boolean {
    const key = this.getMetricKey(name, labels);
    return this.metrics.has(key);
  }

  /**
   * Remove a metric
   */
  removeMetric(name: string, labels?: MetricLabels): boolean {
    const key = this.getMetricKey(name, labels);
    const existed = this.metrics.delete(key);
    if (existed) {
      logger.debug(`Removed metric: ${key}`);
    }
    return existed;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
    this.metricNames.clear();
    logger.info("Cleared all metrics");
  }

  /**
   * Get all metric names
   */
  getMetricNames(): string[] {
    return Array.from(this.metricNames);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, Counter | Histogram | Gauge> {
    return new Map(this.metrics);
  }

  /**
   * Export all metrics in Prometheus format
   */
  toPrometheusString(): string {
    const outputs: string[] = [];

    // Group metrics by name
    const groupedMetrics = this.groupMetricsByName();

    for (const [, metrics] of groupedMetrics) {
      if (metrics.length > 0) {
        // Add HELP and TYPE once per metric name
        const firstMetric = metrics[0];
        outputs.push(`# HELP ${firstMetric.name} ${firstMetric.help}`);
        outputs.push(
          `# TYPE ${firstMetric.name} ${this.getMetricType(firstMetric)}`,
        );

        // Add value lines for all label combinations
        for (const metric of metrics) {
          if (metric instanceof CounterImpl) {
            outputs.push(metric.toPrometheusString().split("\n").pop() || "");
          } else if (metric instanceof GaugeImpl) {
            outputs.push(metric.toPrometheusString().split("\n").pop() || "");
          } else if (metric instanceof HistogramImpl) {
            outputs.push(metric.toPrometheusString());
          }
        }

        outputs.push(""); // Empty line between metrics
      }
    }

    return outputs.join("\n").trim();
  }

  /**
   * Get metric type string
   */
  private getMetricType(metric: Counter | Histogram | Gauge): string {
    if (metric instanceof CounterImpl) return "counter";
    if (metric instanceof HistogramImpl) return "histogram";
    if (metric instanceof GaugeImpl) return "gauge";
    return "unknown";
  }

  /**
   * Group metrics by name
   */
  private groupMetricsByName(): Map<string, (Counter | Histogram | Gauge)[]> {
    const grouped = new Map<string, (Counter | Histogram | Gauge)[]>();

    for (const [, metric] of this.metrics) {
      const existing = grouped.get(metric.name) || [];
      existing.push(metric);
      grouped.set(metric.name, existing);
    }

    return grouped;
  }

  /**
   * Generate unique key for metric with labels
   */
  private getMetricKey(name: string, labels?: MetricLabels): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(",");
    return `${name}{${labelStr}}`;
  }
}

/**
 * Global metrics registry instance
 */
export const metricsRegistry = new MetricsRegistry();

/**
 * Service metrics collector for automatic metric collection
 */
export class ServiceMetricsCollector {
  private registry: MetricsRegistry;
  private serviceName: string;

  // Metric instances
  private requestCounter: Counter;
  private errorCounter: Counter;
  private requestDuration: Histogram;
  private activeRequests: Gauge;
  private circuitBreakerState: Gauge;
  private rateLimitHits: Counter;
  private rateLimitMisses: Counter;

  constructor(
    serviceName: string,
    registry: MetricsRegistry = metricsRegistry,
  ) {
    this.serviceName = serviceName;
    this.registry = registry;

    // Initialize service-specific metrics
    this.requestCounter = this.registry.createCounter(
      "service_requests_total",
      "Total number of service requests",
      { service: serviceName },
    );

    this.errorCounter = this.registry.createCounter(
      "service_errors_total",
      "Total number of service errors",
      { service: serviceName },
    );

    this.requestDuration = this.registry.createHistogram(
      "service_request_duration_seconds",
      "Service request duration in seconds",
      DEFAULT_LATENCY_HISTOGRAM_BUCKETS,
      { service: serviceName },
    );

    this.activeRequests = this.registry.createGauge(
      "service_active_requests",
      "Number of active requests",
      { service: serviceName },
    );

    this.circuitBreakerState = this.registry.createGauge(
      "service_circuit_breaker_state",
      "Circuit breaker state (0=closed, 1=open, 2=half-open)",
      { service: serviceName },
    );

    this.rateLimitHits = this.registry.createCounter(
      "service_rate_limit_hits_total",
      "Total number of rate limit hits",
      { service: serviceName },
    );

    this.rateLimitMisses = this.registry.createCounter(
      "service_rate_limit_misses_total",
      "Total number of rate limit misses (allowed)",
      { service: serviceName },
    );

    logger.info(`Initialized metrics collector for service: ${serviceName}`);
  }

  /**
   * Record a request
   */
  recordRequest(): void {
    this.requestCounter.increment();
    this.activeRequests.increment();
  }

  /**
   * Record request completion
   */
  recordRequestComplete(durationMs: number): void {
    this.activeRequests.decrement();
    this.requestDuration.observe(durationMs / 1000); // Convert to seconds
  }

  /**
   * Record an error
   */
  recordError(errorType?: string): void {
    this.errorCounter.increment();
    if (errorType) {
      // Create labeled counter for specific error types
      const errorCounter = this.registry.createCounter(
        "service_errors_by_type_total",
        "Total number of errors by type",
        { service: this.serviceName, type: errorType },
      );
      errorCounter.increment();
    }
  }

  /**
   * Update circuit breaker state
   */
  updateCircuitBreakerState(state: "closed" | "open" | "half-open"): void {
    const stateMap = { closed: 0, open: 1, "half-open": 2 };
    this.circuitBreakerState.set(stateMap[state]);
  }

  /**
   * Record rate limit hit (request denied)
   */
  recordRateLimitHit(): void {
    this.rateLimitHits.increment();
  }

  /**
   * Record rate limit miss (request allowed)
   */
  recordRateLimitMiss(): void {
    this.rateLimitMisses.increment();
  }

  /**
   * Get the metrics registry
   */
  getRegistry(): MetricsRegistry {
    return this.registry;
  }
}

/**
 * Helper to create a service metrics collector
 */
export function createServiceMetrics(
  serviceName: string,
  registry?: MetricsRegistry,
): ServiceMetricsCollector {
  return new ServiceMetricsCollector(serviceName, registry);
}
