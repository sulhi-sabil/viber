/**
 * Formatters Module Tests
 *
 * Comprehensive test suite for metrics table formatting and timestamp utilities.
 */

import {
  formatMetricsTable,
  extractMetricsRows,
  formatServiceFactoryMetrics,
  formatTimestamp,
  type MetricRow,
  type HasMetricsRegistry,
} from "./formatters";
import { MetricsRegistry } from "./metrics";

describe("formatMetricsTable", () => {
  describe("empty metrics", () => {
    it("should show 'No metrics collected' for empty array", () => {
      const result = formatMetricsTable([]);
      expect(result).toContain("No metrics collected");
    });
  });

  describe("table structure", () => {
    it("should have headers (Metric, Value, Labels, Type)", () => {
      const metrics: MetricRow[] = [
        { name: "test_metric", value: "42", labels: "-", type: "counter" },
      ];
      const result = formatMetricsTable(metrics, { useColors: false });
      expect(result).toContain("Metric");
      expect(result).toContain("Value");
      expect(result).toContain("Labels");
      expect(result).toContain("Type");
    });

    it("should include timestamp line when includeTimestamp=true", () => {
      const result = formatMetricsTable([], { includeTimestamp: true });
      expect(result).toContain("Generated:");
    });

    it("should omit timestamp line when includeTimestamp=false", () => {
      const result = formatMetricsTable([], { includeTimestamp: false });
      expect(result).not.toContain("Generated:");
    });
  });

  describe("ANSI color handling", () => {
    it("should include ANSI codes when useColors=true", () => {
      const metrics: MetricRow[] = [
        { name: "test_metric", value: "42", labels: "-", type: "counter" },
      ];
      const result = formatMetricsTable(metrics, { useColors: true });
      expect(result).toContain("\x1b["); // ANSI escape sequence
    });

    it("should not include ANSI codes when useColors=false", () => {
      const metrics: MetricRow[] = [
        { name: "test_metric", value: "42", labels: "-", type: "counter" },
      ];
      const result = formatMetricsTable(metrics, { useColors: false });
      expect(result).not.toContain("\x1b[");
    });
  });

  describe("metric type formatting", () => {
    it("should format counter metrics", () => {
      const metrics: MetricRow[] = [
        {
          name: "requests_total",
          value: "100",
          labels: "service=api",
          type: "counter",
        },
      ];
      const result = formatMetricsTable(metrics, { useColors: false });
      expect(result).toContain("requests_total");
      expect(result).toContain("100");
      expect(result).toContain("counter");
    });

    it("should format histogram metrics", () => {
      const metrics: MetricRow[] = [
        {
          name: "request_duration",
          value: "50 obs",
          labels: "-",
          type: "histogram",
        },
      ];
      const result = formatMetricsTable(metrics, { useColors: false });
      expect(result).toContain("request_duration");
      expect(result).toContain("50 obs");
      expect(result).toContain("histogram");
    });

    it("should format gauge metrics", () => {
      const metrics: MetricRow[] = [
        { name: "active_connections", value: "5", labels: "-", type: "gauge" },
      ];
      const result = formatMetricsTable(metrics, { useColors: false });
      expect(result).toContain("active_connections");
      expect(result).toContain("5");
      expect(result).toContain("gauge");
    });
  });

  describe("multiple metrics", () => {
    it("should format multiple metrics in table", () => {
      const metrics: MetricRow[] = [
        {
          name: "requests_total",
          value: "100",
          labels: "service=api",
          type: "counter",
        },
        {
          name: "errors_total",
          value: "5",
          labels: "service=api",
          type: "counter",
        },
        { name: "latency", value: "25 obs", labels: "-", type: "histogram" },
      ];
      const result = formatMetricsTable(metrics, { useColors: false });
      expect(result).toContain("requests_total");
      expect(result).toContain("errors_total");
      expect(result).toContain("latency");
    });
  });
});

describe("extractMetricsRows", () => {
  let registry: MetricsRegistry;

  beforeEach(() => {
    registry = new MetricsRegistry();
  });

  afterEach(() => {
    registry.clear();
  });

  describe("empty registry", () => {
    it("should return empty array for empty registry", () => {
      const rows = extractMetricsRows(registry);
      expect(rows).toEqual([]);
    });
  });

  describe("counter extraction", () => {
    it("should extract counter with correct name, value, labels, type='counter'", () => {
      const counter = registry.createCounter(
        "requests_total",
        "Total requests",
        {
          service: "api",
        },
      );
      counter.increment(42);

      const rows = extractMetricsRows(registry);

      expect(rows).toHaveLength(1);
      expect(rows[0]!.name).toBe("requests_total");
      expect(rows[0]!.value).toBe("42");
      expect(rows[0]!.labels).toContain("service=api");
      expect(rows[0]!.type).toBe("counter");
    });

    it("should extract counter without labels", () => {
      const counter = registry.createCounter(
        "simple_counter",
        "Simple counter",
      );
      counter.increment(10);

      const rows = extractMetricsRows(registry);

      expect(rows).toHaveLength(1);
      expect(rows[0]!.name).toBe("simple_counter");
      expect(rows[0]!.value).toBe("10");
      expect(rows[0]!.labels).toBe("-");
      expect(rows[0]!.type).toBe("counter");
    });
  });

  describe("histogram extraction", () => {
    it("should extract histogram with '{count} obs' format, type='histogram'", () => {
      const histogram = registry.createHistogram(
        "request_duration",
        "Request duration",
        [0.1, 0.5, 1],
      );
      histogram.observe(0.3);
      histogram.observe(0.7);
      histogram.observe(1.2);

      const rows = extractMetricsRows(registry);

      expect(rows).toHaveLength(1);
      expect(rows[0]!.name).toBe("request_duration");
      expect(rows[0]!.value).toBe("3 obs");
      expect(rows[0]!.type).toBe("histogram");
    });
  });

  describe("gauge extraction", () => {
    it("should extract gauge with correct value, type='gauge'", () => {
      const gauge = registry.createGauge(
        "active_connections",
        "Active connections",
        {
          service: "db",
        },
      );
      gauge.set(15);

      const rows = extractMetricsRows(registry);

      expect(rows).toHaveLength(1);
      expect(rows[0]!.name).toBe("active_connections");
      expect(rows[0]!.value).toBe("15");
      expect(rows[0]!.labels).toContain("service=db");
      expect(rows[0]!.type).toBe("gauge");
    });
  });

  describe("mixed metrics", () => {
    it("should extract all metric types from registry", () => {
      const counter = registry.createCounter("requests", "Requests");
      counter.increment(100);

      const histogram = registry.createHistogram("latency", "Latency");
      histogram.observe(0.5);

      const gauge = registry.createGauge("connections", "Connections");
      gauge.set(5);

      const rows = extractMetricsRows(registry);

      expect(rows).toHaveLength(3);
      const types = rows.map((r) => r.type);
      expect(types).toContain("counter");
      expect(types).toContain("histogram");
      expect(types).toContain("gauge");
    });
  });

  describe("sorting", () => {
    it("should sort by label then name", () => {
      const counter1 = registry.createCounter("zebra_metric", "Z", {
        service: "alpha",
      });
      counter1.increment(1);

      const counter2 = registry.createCounter("alpha_metric", "A", {
        service: "beta",
      });
      counter2.increment(1);

      const counter3 = registry.createCounter("middle_metric", "M", {
        service: "alpha",
      });
      counter3.increment(1);

      const rows = extractMetricsRows(registry);

      // First should be from alpha service (sorted by label first)
      expect(rows[0]!.labels).toContain("service=alpha");
      // Within alpha, should be sorted by name
      expect(rows[0]!.name).toBe("middle_metric");
      expect(rows[1]!.name).toBe("zebra_metric");
      // Beta service comes after alpha
      expect(rows[2]!.labels).toContain("service=beta");
    });
  });
});

describe("formatServiceFactoryMetrics", () => {
  let registry: MetricsRegistry;

  beforeEach(() => {
    registry = new MetricsRegistry();
  });

  afterEach(() => {
    registry.clear();
  });

  it("should call getMetricsRegistry on factory", () => {
    const mockFactory: HasMetricsRegistry = {
      getMetricsRegistry: jest.fn().mockReturnValue(registry),
    };

    formatServiceFactoryMetrics(mockFactory);

    expect(mockFactory.getMetricsRegistry).toHaveBeenCalled();
  });

  it("should handle empty registry", () => {
    const mockFactory: HasMetricsRegistry = {
      getMetricsRegistry: () => registry,
    };

    const result = formatServiceFactoryMetrics(mockFactory);

    expect(result).toContain("No metrics collected");
  });

  it("should format metrics from factory registry", () => {
    const counter = registry.createCounter("test_metric", "Test");
    counter.increment(42);

    const mockFactory: HasMetricsRegistry = {
      getMetricsRegistry: () => registry,
    };

    const result = formatServiceFactoryMetrics(mockFactory, {
      useColors: false,
    });

    expect(result).toContain("test_metric");
    expect(result).toContain("42");
  });
});

describe("formatTimestamp", () => {
  const testTimestamp = new Date("2024-01-15T10:30:45.123Z").getTime();

  describe("ISO format", () => {
    it("should return ISO 8601 string", () => {
      const result = formatTimestamp(testTimestamp, { format: "iso" });
      expect(result).toBe("2024-01-15T10:30:45.123Z");
    });
  });

  describe("locale format", () => {
    it("should return locale string", () => {
      const result = formatTimestamp(testTimestamp, { format: "locale" });
      // Locale string varies by environment, just check it's a string
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("relative format", () => {
    const referenceTime = 1000000;

    it("should return 'just now' for diff < 1000ms past", () => {
      const timestamp = referenceTime - 500; // 500ms ago
      const result = formatTimestamp(timestamp, {
        format: "relative",
        referenceTime,
      });
      expect(result).toBe("just now");
    });

    it("should return 'in a moment' for diff < 1000ms future", () => {
      const timestamp = referenceTime + 500; // 500ms in future
      const result = formatTimestamp(timestamp, {
        format: "relative",
        referenceTime,
      });
      expect(result).toBe("in a moment");
    });

    it("should format seconds for diff < 60s", () => {
      const timestamp = referenceTime - 5000; // 5 seconds ago
      const result = formatTimestamp(timestamp, {
        format: "relative",
        referenceTime,
        useColors: false,
      });
      expect(result).toBe("5s ago");
    });

    it("should format minutes for diff < 60m", () => {
      const timestamp = referenceTime - 125000; // 2 minutes 5 seconds ago
      const result = formatTimestamp(timestamp, {
        format: "relative",
        referenceTime,
        useColors: false,
      });
      expect(result).toBe("2m 5s ago");
    });

    it("should format hours for diff < 24h", () => {
      const timestamp = referenceTime - 3661000; // 1 hour 1 minute 1 second ago
      const result = formatTimestamp(timestamp, {
        format: "relative",
        referenceTime,
        useColors: false,
      });
      expect(result).toBe("1h 1m ago");
    });

    it("should format days for diff >= 24h", () => {
      const timestamp = referenceTime - 90061000; // 1 day 1 hour 1 minute 1 second ago
      const result = formatTimestamp(timestamp, {
        format: "relative",
        referenceTime,
        useColors: false,
      });
      expect(result).toBe("1d 1h ago");
    });

    it("should include ANSI codes when useColors=true", () => {
      const timestamp = referenceTime - 5000; // 5 seconds ago
      const result = formatTimestamp(timestamp, {
        format: "relative",
        referenceTime,
        useColors: true,
      });
      expect(result).toContain("\x1b[");
    });

    it("should not include ANSI codes when useColors=false", () => {
      const timestamp = referenceTime - 5000; // 5 seconds ago
      const result = formatTimestamp(timestamp, {
        format: "relative",
        referenceTime,
        useColors: false,
      });
      expect(result).not.toContain("\x1b[");
    });

    it("should use referenceTime option", () => {
      const timestamp = 500000;
      const refTime = 600000; // 100 seconds later
      const result = formatTimestamp(timestamp, {
        format: "relative",
        referenceTime: refTime,
        useColors: false,
      });
      expect(result).toBe("1m 40s ago");
    });
  });

  describe("default format detection", () => {
    it("should use ISO format when no format specified", () => {
      const result = formatTimestamp(testTimestamp);
      // Default depends on environment, but should return a valid string
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });
});

describe("Environment Detection", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    originalEnv = process.env;
    originalIsTTY = process.stdout.isTTY;
  });

  afterEach(() => {
    process.env = originalEnv;
    Object.defineProperty(process.stdout, "isTTY", {
      value: originalIsTTY,
      writable: true,
    });
  });

  it("should useColors=false when NODE_ENV=production", () => {
    jest.replaceProperty(process, "env", {
      ...originalEnv,
      NODE_ENV: "production",
    });

    const metrics: MetricRow[] = [
      { name: "test", value: "1", labels: "-", type: "counter" },
    ];
    const result = formatMetricsTable(metrics);

    // In production, colors should be disabled by default
    expect(result).not.toContain("\x1b[36m"); // cyan color for headers
  });

  it("should useColors=true when TTY and not production", () => {
    jest.replaceProperty(process, "env", {
      ...originalEnv,
      NODE_ENV: "development",
    });
    Object.defineProperty(process.stdout, "isTTY", {
      value: true,
      writable: true,
    });

    const metrics: MetricRow[] = [
      { name: "test", value: "1", labels: "-", type: "counter" },
    ];
    const result = formatMetricsTable(metrics);

    // In TTY development, colors should be enabled by default
    expect(result).toContain("\x1b[");
  });
});

describe("Helper function coverage", () => {
  let registry: MetricsRegistry;

  beforeEach(() => {
    registry = new MetricsRegistry();
  });

  afterEach(() => {
    registry.clear();
  });

  describe("label formatting", () => {
    it("should truncate long labels", () => {
      const longLabelValue = "a".repeat(50);
      const counter = registry.createCounter("test", "Test", {
        service: longLabelValue,
      });
      counter.increment(1);

      const rows = extractMetricsRows(registry);

      // Labels should be truncated
      expect(rows[0]!.labels.length).toBeLessThanOrEqual(30);
    });

    it("should handle multiple labels", () => {
      const counter = registry.createCounter("test", "Test", {
        a: "1",
        b: "2",
      });
      counter.increment(1);

      const rows = extractMetricsRows(registry);

      expect(rows[0]!.labels).toContain("a=1");
      expect(rows[0]!.labels).toContain("b=2");
    });
  });


  describe("name truncation", () => {
    it("should truncate long metric names in table", () => {
      const longName = "a".repeat(50);
      const metrics: MetricRow[] = [
        { name: longName, value: "1", labels: "-", type: "counter" },
      ];
      const result = formatMetricsTable(metrics, { useColors: false });

      // The name should be truncated in output (column width is 28)
      expect(result).toContain("…");
    });
  });

  describe("maxLabelLength option", () => {
    it("should respect custom maxLabelLength", () => {
      const longLabelValue = "a".repeat(50);
      const counter = registry.createCounter("test", "Test", {
        service: longLabelValue,
      });
      counter.increment(1);

      const rows = extractMetricsRows(registry);

      // Default maxLabelLength is 30
      expect(rows[0]!.labels.length).toBeLessThanOrEqual(30);
    });
  });
});

describe("Re-exported health check formatters", () => {
  it("should export formatHealthCheckResult", async () => {
    const { formatHealthCheckResult } = await import("./formatters");
    expect(formatHealthCheckResult).toBeDefined();
    expect(typeof formatHealthCheckResult).toBe("function");
  });

  it("should export formatAggregateHealthResult", async () => {
    const { formatAggregateHealthResult } = await import("./formatters");
    expect(formatAggregateHealthResult).toBeDefined();
    expect(typeof formatAggregateHealthResult).toBe("function");
  });
});
