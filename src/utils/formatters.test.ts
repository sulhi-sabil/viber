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
  describe("with empty metrics", () => {
    it("should render 'No metrics collected' message", () => {
      const result = formatMetricsTable([]);
      expect(result).toContain("No metrics collected");
    });

    it("should still render table structure", () => {
      const result = formatMetricsTable([]);
      expect(result).toContain("SERVICE METRICS");
      expect(result).toContain("┌");
      expect(result).toContain("└");
    });
  });

  describe("with metrics data", () => {
    const testMetrics: MetricRow[] = [
      {
        name: "service_requests_total",
        value: "42",
        labels: "service=supabase",
        type: "counter",
      },
      {
        name: "service_errors_total",
        value: "3",
        labels: "service=supabase",
        type: "counter",
      },
      {
        name: "request_duration",
        value: "150 obs",
        labels: "-",
        type: "histogram",
      },
      {
        name: "active_connections",
        value: "5",
        labels: "pool=main",
        type: "gauge",
      },
    ];

    it("should render all metrics", () => {
      const result = formatMetricsTable(testMetrics);
      expect(result).toContain("service_requests_total");
      expect(result).toContain("service_errors_total");
      expect(result).toContain("request_duration");
      expect(result).toContain("active_connections");
    });

    it("should render values", () => {
      const result = formatMetricsTable(testMetrics);
      expect(result).toContain("42");
      expect(result).toContain("3");
      expect(result).toContain("150 obs");
      expect(result).toContain("5");
    });

    it("should render labels", () => {
      const result = formatMetricsTable(testMetrics);
      expect(result).toContain("service=supabase");
      expect(result).toContain("pool=main");
    });

    it("should render metric types", () => {
      const result = formatMetricsTable(testMetrics);
      expect(result).toContain("counter");
      expect(result).toContain("histogram");
      expect(result).toContain("gauge");
    });

    it("should render table borders", () => {
      const result = formatMetricsTable(testMetrics);
      expect(result).toContain("┌");
      expect(result).toContain("┐");
      expect(result).toContain("└");
      expect(result).toContain("┘");
      expect(result).toContain("│");
      expect(result).toContain("─");
    });
  });

  describe("with color options", () => {
    const testMetrics: MetricRow[] = [
      { name: "test_metric", value: "10", labels: "-", type: "counter" },
    ];

    it("should include ANSI codes when useColors is true", () => {
      const result = formatMetricsTable(testMetrics, { useColors: true });
      expect(result).toContain("\x1b[");
    });

    it("should not include ANSI codes when useColors is false", () => {
      const result = formatMetricsTable(testMetrics, { useColors: false });
      expect(result).not.toContain("\x1b[");
    });
  });

  describe("with timestamp options", () => {
    const testMetrics: MetricRow[] = [
      { name: "test_metric", value: "10", labels: "-", type: "counter" },
    ];

    it("should include timestamp when includeTimestamp is true", () => {
      const result = formatMetricsTable(testMetrics, {
        includeTimestamp: true,
        useColors: false,
      });
      expect(result).toContain("Generated:");
    });

    it("should not include timestamp when includeTimestamp is false", () => {
      const result = formatMetricsTable(testMetrics, {
        includeTimestamp: false,
        useColors: false,
      });
      expect(result).not.toContain("Generated:");
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

  describe("with counter", () => {
    it("should extract counter with correct value", () => {
      const counter = registry.createCounter("test_counter", "Test counter");
      counter.increment(42);

      const rows = extractMetricsRows(registry);
      const counterRow = rows.find((r) => r.name === "test_counter");

      expect(counterRow).toBeDefined();
      expect(counterRow?.value).toBe("42");
      expect(counterRow?.type).toBe("counter");
    });

    it("should extract counter with labels", () => {
      const counter = registry.createCounter("test_counter", "Test counter", {
        service: "api",
      });
      counter.increment(10);

      const rows = extractMetricsRows(registry);
      const counterRow = rows.find((r) => r.name === "test_counter");

      expect(counterRow).toBeDefined();
      expect(counterRow?.labels).toContain("service=api");
    });
  });

  describe("with histogram", () => {
    it("should extract histogram with count", () => {
      const histogram = registry.createHistogram(
        "test_histogram",
        "Test histogram",
      );
      histogram.observe(0.1);
      histogram.observe(0.5);
      histogram.observe(1.0);

      const rows = extractMetricsRows(registry);
      const histogramRow = rows.find((r) => r.name === "test_histogram");

      expect(histogramRow).toBeDefined();
      expect(histogramRow?.value).toBe("3 obs");
      expect(histogramRow?.type).toBe("histogram");
    });
  });

  describe("with gauge", () => {
    it("should extract gauge with current value", () => {
      const gauge = registry.createGauge("test_gauge", "Test gauge");
      gauge.set(123);

      const rows = extractMetricsRows(registry);
      const gaugeRow = rows.find((r) => r.name === "test_gauge");

      expect(gaugeRow).toBeDefined();
      expect(gaugeRow?.value).toBe("123");
      expect(gaugeRow?.type).toBe("gauge");
    });
  });

  describe("with mixed metrics", () => {
    it("should extract all metric types", () => {
      const counter = registry.createCounter("counter1", "Counter");
      counter.increment(5);

      const histogram = registry.createHistogram("histogram1", "Histogram");
      histogram.observe(0.5);

      const gauge = registry.createGauge("gauge1", "Gauge");
      gauge.set(100);

      const rows = extractMetricsRows(registry);

      expect(rows).toHaveLength(3);
      expect(rows.find((r) => r.type === "counter")).toBeDefined();
      expect(rows.find((r) => r.type === "histogram")).toBeDefined();
      expect(rows.find((r) => r.type === "gauge")).toBeDefined();
    });
  });

  describe("with empty registry", () => {
    it("should return empty array", () => {
      const rows = extractMetricsRows(registry);
      expect(rows).toHaveLength(0);
    });
  });

  describe("sorting", () => {
    it("should sort metrics by label then by name", () => {
      registry.createCounter("zebra_counter", "Z", { service: "beta" });
      registry.createCounter("alpha_counter", "A", { service: "alpha" });
      registry.createCounter("middle_counter", "M", { service: "alpha" });

      const rows = extractMetricsRows(registry);

      const alphaIndex = rows.findIndex((r) =>
        r.labels.includes("service=alpha"),
      );
      const betaIndex = rows.findIndex((r) =>
        r.labels.includes("service=beta"),
      );
      expect(alphaIndex).toBeLessThan(betaIndex);

      const alphaCounterIndex = rows.findIndex(
        (r) => r.name === "alpha_counter",
      );
      const middleCounterIndex = rows.findIndex(
        (r) => r.name === "middle_counter",
      );
      expect(alphaCounterIndex).toBeLessThan(middleCounterIndex);
    });
  });
});

describe("formatServiceFactoryMetrics", () => {
  it("should format metrics from factory", () => {
    const mockRegistry = new MetricsRegistry();
    const counter = mockRegistry.createCounter("test_counter", "Test");
    counter.increment(100);

    const mockFactory: HasMetricsRegistry = {
      getMetricsRegistry: () => mockRegistry,
    };

    const result = formatServiceFactoryMetrics(mockFactory, {
      useColors: false,
      includeTimestamp: false,
    });

    expect(result).toContain("test_counter");
    expect(result).toContain("100");
  });
});

describe("formatTimestamp", () => {
  const testTimestamp = new Date("2024-01-15T10:30:45.123Z").getTime();

  describe("iso format", () => {
    it("should return ISO 8601 format", () => {
      const result = formatTimestamp(testTimestamp, { format: "iso" });
      expect(result).toBe("2024-01-15T10:30:45.123Z");
    });
  });

  describe("locale format", () => {
    it("should return locale string", () => {
      const result = formatTimestamp(testTimestamp, { format: "locale" });
      expect(result).toContain("2024");
    });
  });

  describe("relative format", () => {
    it("should return 'just now' for very recent timestamps", () => {
      const now = Date.now();
      const result = formatTimestamp(now, {
        format: "relative",
        referenceTime: now,
      });
      expect(result).toBe("just now");
    });

    it("should return 'in a moment' for future timestamps within 1 second", () => {
      const now = Date.now();
      const result = formatTimestamp(now + 500, {
        format: "relative",
        referenceTime: now,
      });
      expect(result).toBe("in a moment");
    });

    it("should return seconds for timestamps less than a minute ago", () => {
      const now = Date.now();
      const result = formatTimestamp(now - 30000, {
        format: "relative",
        referenceTime: now,
      });
      expect(result).toBe("30s ago");
    });

    it("should return minutes for timestamps less than an hour ago", () => {
      const now = Date.now();
      const result = formatTimestamp(now - 90000, {
        format: "relative",
        referenceTime: now,
      });
      expect(result).toContain("m");
      expect(result).toContain("s");
      expect(result).toContain("ago");
    });

    it("should return hours for timestamps less than a day ago", () => {
      const now = Date.now();
      const result = formatTimestamp(now - 7200000, {
        format: "relative",
        referenceTime: now,
      });
      expect(result).toContain("h");
      expect(result).toContain("ago");
    });

    it("should return days for timestamps more than a day ago", () => {
      const now = Date.now();
      const result = formatTimestamp(now - 90000000, {
        format: "relative",
        referenceTime: now,
      });
      expect(result).toContain("d");
      expect(result).toContain("ago");
    });

    it("should include ANSI codes when useColors is true", () => {
      const now = Date.now();
      const result = formatTimestamp(now - 5000, {
        format: "relative",
        referenceTime: now,
        useColors: true,
      });
      expect(result).toContain("\x1b[");
    });

    it("should not include ANSI codes when useColors is false", () => {
      const now = Date.now();
      const result = formatTimestamp(now - 5000, {
        format: "relative",
        referenceTime: now,
        useColors: false,
      });
      expect(result).not.toContain("\x1b[");
    });
  });
});
