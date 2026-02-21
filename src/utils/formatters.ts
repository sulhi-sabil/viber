/**
 * Formatters Module
 *
 * Provides human-readable console output formatters for metrics and status.
 * Uses native ANSI codes - no external dependencies.
 *
 * @module utils/formatters
 */

import type {
  MetricLabels,
  Counter,
  Histogram,
  Gauge,
  MetricsRegistry,
} from "./metrics";
// ═══════════════════════════════════════════════════════════════════════════
// RE-EXPORT HEALTH FORMATTERS (for convenience)
// ═══════════════════════════════════════════════════════════════════════════

export {
  formatHealthCheckResult,
  formatAggregateHealthResult,
} from "./health-check";

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

/** Minimum column widths for metrics table */
const COLUMN_WIDTHS = {
  metric: 28,
  value: 12,
  labels: 18,
  type: 10,
} as const;

/** ANSI color codes */
const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// FORMATTER OPTIONS
// ═══════════════════════════════════════════════════════════════════════════

export interface FormatterOptions {
  /** Enable ANSI colors (default: auto-detect TTY in non-production) */
  useColors?: boolean;
  /** Include timestamp in output */
  includeTimestamp?: boolean;
  /** Max label string length before truncation */
  maxLabelLength?: number;
}

function getDefaultOptions(
  options: FormatterOptions,
): Required<FormatterOptions> {
  return {
    useColors:
      options.useColors ??
      (typeof process !== "undefined" &&
        process.env?.NODE_ENV !== "production" &&
        process.stdout?.isTTY === true),
    includeTimestamp: options.includeTimestamp ?? true,
    maxLabelLength: options.maxLabelLength ?? 30,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function colorize(
  text: string,
  color: keyof typeof COLORS,
  enabled: boolean,
): string {
  return enabled ? `${COLORS[color]}${text}${COLORS.reset}` : text;
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + "…";
}

function formatLabels(
  labels: MetricLabels | undefined,
  maxLength: number,
): string {
  if (!labels || Object.keys(labels).length === 0) return "-";
  const formatted = Object.entries(labels)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  return truncate(formatted, maxLength);
}

function padCenter(str: string, width: number): string {
  const padding = Math.max(0, width - str.length);
  const leftPad = Math.floor(padding / 2);
  const rightPad = padding - leftPad;
  return " ".repeat(leftPad) + str + " ".repeat(rightPad);
}

function padRight(str: string, width: number): string {
  return str + " ".repeat(Math.max(0, width - str.length));
}

// ═══════════════════════════════════════════════════════════════════════════
// METRICS TABLE FORMATTER
// ═══════════════════════════════════════════════════════════════════════════

export interface MetricRow {
  name: string;
  value: string;
  labels: string;
  type: "counter" | "histogram" | "gauge";
}

/**
 * Format a metrics table with ASCII borders
 *
 * @param metrics - Array of metric rows to display
 * @param options - Formatter options
 * @returns Formatted ASCII table string
 *
 * @example
 * ```typescript
 * const rows = [
 *   { name: "service_requests_total", value: "42", labels: "service=supabase", type: "counter" },
 *   { name: "service_errors_total", value: "3", labels: "service=supabase", type: "counter" },
 * ];
 * console.log(formatMetricsTable(rows));
 * ```
 */
export function formatMetricsTable(
  metrics: MetricRow[],
  options: FormatterOptions = {},
): string {
  const opts = getDefaultOptions(options);
  const lines: string[] = [];

  // Border characters
  const tl = "┌",
    tr = "┐",
    bl = "└",
    br = "┘";
  const h = "─",
    v = "│";
  const lt = "├",
    rt = "┤",
    tt = "┬";

  const col1 = COLUMN_WIDTHS.metric;
  const col2 = COLUMN_WIDTHS.value;
  const col3 = COLUMN_WIDTHS.labels;
  const col4 = COLUMN_WIDTHS.type;
  const totalWidth = col1 + col2 + col3 + col4 + 5; // +5 for separators

  // Header
  lines.push(`${tl}${h.repeat(totalWidth - 2)}${tr}`);
  lines.push(`${v}${padCenter("SERVICE METRICS", totalWidth - 2)}${v}`);

  if (opts.includeTimestamp) {
    const timestamp = new Date().toLocaleString();
    lines.push(
      `${v}${colorize(padCenter(`Generated: ${timestamp}`, totalWidth - 2), "dim", opts.useColors)}${v}`,
    );
  }

  lines.push(`${v}${" ".repeat(totalWidth - 2)}${v}`);

  // Column headers
  const headerLine = [
    padRight("Metric", col1),
    padRight("Value", col2),
    padRight("Labels", col3),
    padRight("Type", col4),
  ].join(`${v}`);
  lines.push(`${v}${colorize(headerLine, "cyan", opts.useColors)}${v}`);

  // Separator
  lines.push(
    `${lt}${h.repeat(col1)}${tt}${h.repeat(col2)}${tt}${h.repeat(col3)}${tt}${h.repeat(col4)}${rt}`,
  );

  // Data rows
  if (metrics.length === 0) {
    lines.push(`${v}${padCenter("No metrics collected", totalWidth - 2)}${v}`);
  } else {
    for (const metric of metrics) {
      const typeColor: keyof typeof COLORS =
        metric.type === "counter"
          ? "green"
          : metric.type === "histogram"
            ? "yellow"
            : "blue";

      const row = [
        padRight(truncate(metric.name, col1), col1),
        padRight(colorize(metric.value, "green", opts.useColors), col2),
        padRight(colorize(metric.labels, "dim", opts.useColors), col3),
        padRight(colorize(metric.type, typeColor, opts.useColors), col4),
      ].join(`${v}`);
      lines.push(`${v}${row}${v}`);
    }
  }

  // Footer
  lines.push(`${bl}${h.repeat(totalWidth - 2)}${br}`);
  lines.push(""); // Trailing newline

  return lines.join("\n");
}

/**
 * Extract metrics from MetricsRegistry into table rows
 */
export function extractMetricsRows(registry: MetricsRegistry): MetricRow[] {
  const rows: MetricRow[] = [];
  const metrics = registry.getAllMetrics();

  for (const [, metric] of metrics) {
    let value: string;
    let type: "counter" | "histogram" | "gauge";

    // Determine metric type and extract value
    if (
      "observe" in metric &&
      typeof (metric as Histogram).observe === "function"
    ) {
      // Histogram
      const hist = metric as Histogram;
      value = `${hist.getCount()} obs`;
      type = "histogram";
    } else if ("set" in metric && typeof (metric as Gauge).set === "function") {
      // Gauge
      const gauge = metric as Gauge;
      value = String(gauge.getValue());
      type = "gauge";
    } else if (
      "getValue" in metric &&
      typeof (metric as Counter).getValue === "function"
    ) {
      // Counter
      const counter = metric as Counter;
      value = String(counter.getValue());
      type = "counter";
    } else {
      continue;
    }

    rows.push({
      name: metric.name,
      value,
      labels: formatLabels(metric.labels, COLUMN_WIDTHS.labels),
      type,
    });
  }

  // Sort by service label, then by name
  return rows.sort((a, b) => {
    const labelA = a.labels.split(",")[0] || "";
    const labelB = b.labels.split(",")[0] || "";
    if (labelA !== labelB) return labelA.localeCompare(labelB);
    return a.name.localeCompare(b.name);
  });
}

/**
 * Interface for ServiceFactory-like objects that have a metrics registry
 */
export interface HasMetricsRegistry {
  getMetricsRegistry(): MetricsRegistry;
}

/**
 * Format and print metrics table for a ServiceFactory
 * Convenience function that extracts and formats in one call
 */
export function formatServiceFactoryMetrics(
  factory: HasMetricsRegistry,
  options: FormatterOptions = {},
): string {
  const registry = factory.getMetricsRegistry();
  const rows = extractMetricsRows(registry);
  return formatMetricsTable(rows, options);
}

// ═══════════════════════════════════════════════════════════════════════════
// TIMESTAMP FORMATTING
// ═══════════════════════════════════════════════════════════════════════════

/** Timestamp format options */
export type TimestampFormat = "iso" | "locale" | "relative";

/** Options for timestamp formatting */
export interface TimestampOptions {
  /** Output format: iso (default for prod), locale (default for dev), relative */
  format?: TimestampFormat;
  /** Reference time for relative format (defaults to now) */
  referenceTime?: number;
  /** Enable colors for relative time indicators */
  useColors?: boolean;
}

/**
 * Format a timestamp for display
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @param options - Formatting options
 * @returns Formatted timestamp string
 *
 * @example
 * ```typescript
 * // Auto-detect mode: locale for TTY, ISO for production
 * formatTimestamp(Date.now()) // "1/15/2024, 10:30:45 AM" (TTY)
 * formatTimestamp(Date.now()) // "2024-01-15T10:30:45.123Z" (production)
 *
 * // Explicit format
 * formatTimestamp(Date.now(), { format: 'iso' })     // ISO 8601
 * formatTimestamp(Date.now(), { format: 'locale' })  // Localized
 * formatTimestamp(Date.now(), { format: 'relative' }) // "2s ago"
 * ```
 */
export function formatTimestamp(
  timestamp: number,
  options: TimestampOptions = {},
): string {
  const format = options.format ?? getDefaultTimestampFormat();

  switch (format) {
    case "iso":
      return new Date(timestamp).toISOString();

    case "locale":
      return new Date(timestamp).toLocaleString();

    case "relative": {
      const now = options.referenceTime ?? Date.now();
      const diff = now - timestamp;
      return formatRelativeTime(diff, options.useColors ?? false);
    }

    default:
      return new Date(timestamp).toISOString();
  }
}

/**
 * Get default timestamp format based on environment
 */
function getDefaultTimestampFormat(): TimestampFormat {
  // Use ISO in production for log aggregation, locale in dev for readability
  if (typeof process !== "undefined" && process.env?.NODE_ENV === "production") {
    return "iso";
  }
  // Use locale in TTY environments for better readability
  if (typeof process !== "undefined" && process.stdout?.isTTY === true) {
    return "locale";
  }
  return "iso";
}

/**
 * Format relative time with optional colors
 */
function formatRelativeTime(diffMs: number, useColors: boolean): string {
  const absDiff = Math.abs(diffMs);
  const isPast = diffMs >= 0;

  const colorize = (text: string, color: string): string =>
    useColors ? `${color}${text}${COLORS.reset}` : text;

  if (absDiff < 1000) {
    return isPast ? "just now" : "in a moment";
  }

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let result: string;
  let color: string;

  if (days > 0) {
    result = `${days}d ${hours % 24}h`;
    color = COLORS.dim;
  } else if (hours > 0) {
    result = `${hours}h ${minutes % 60}m`;
    color = COLORS.dim;
  } else if (minutes > 0) {
    result = `${minutes}m ${seconds % 60}s`;
    color = COLORS.cyan;
  } else {
    result = `${seconds}s`;
    color = COLORS.green;
  }

  const suffix = isPast ? " ago" : "";
  return colorize(result + suffix, color);
}
