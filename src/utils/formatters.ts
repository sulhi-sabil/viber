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
  if (
    typeof process !== "undefined" &&
    process.env?.NODE_ENV === "production"
  ) {
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

// ═══════════════════════════════════════════════════════════════════════════
// STATUS TABLE FORMATTER
// ═══════════════════════════════════════════════════════════════════════════

/** Circuit breaker state type */
export type CircuitBreakerState = "closed" | "open" | "half-open";

/** Circuit breaker status info */
export interface CircuitBreakerStatus {
  state: CircuitBreakerState;
  failures?: number;
  lastFailureTime?: number;
  nextRetryTime?: number;
}

/** Rate limiter status info */
export interface RateLimiterStatus {
  available?: number;
  limit?: number;
  resetTime?: number;
  blocked?: boolean;
}

/** Status output for formatting */
export interface StatusOutput {
  circuitBreakers: Record<string, CircuitBreakerStatus>;
  rateLimiters: Record<string, RateLimiterStatus | null>;
  timestamp?: string;
}

/** Column widths for status table */
const STATUS_COLUMN_WIDTHS = {
  service: 20,
  status: 14,
  details: 36,
} as const;

/** Status emojis */
const STATUS_EMOJIS = {
  healthy: "✅",
  degraded: "⚠️",
  unhealthy: "❌",
  blocked: "🚫",
  available: "🟢",
  unknown: "❓",
} as const;

/**
 * Format a status table with ASCII borders
 *
 * @param status - Status output from /api/status endpoint
 * @param options - Formatter options
 * @returns Formatted ASCII table string
 *
 * @example
 * ```typescript
 * const status = {
 *   circuitBreakers: {
 *     supabase: { state: "closed", failures: 0 },
 *     gemini: { state: "open", failures: 5 }
 *   },
 *   rateLimiters: {
 *     gemini: { available: 50, limit: 60, blocked: false }
 *   }
 * };
 * console.log(formatStatusTable(status));
 * ```
 */
export function formatStatusTable(
  status: StatusOutput,
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

  const col1 = STATUS_COLUMN_WIDTHS.service;
  const col2 = STATUS_COLUMN_WIDTHS.status;
  const col3 = STATUS_COLUMN_WIDTHS.details;
  const totalWidth = col1 + col2 + col3 + 4; // +4 for separators

  // Header
  lines.push(`${tl}${h.repeat(totalWidth - 2)}${tr}`);
  lines.push(`${v}${padCenter("SERVICE STATUS", totalWidth - 2)}${v}`);

  if (opts.includeTimestamp) {
    const timestamp = status.timestamp ?? new Date().toLocaleString();
    lines.push(
      `${v}${colorize(padCenter(`Generated: ${timestamp}`, totalWidth - 2), "dim", opts.useColors)}${v}`,
    );
  }

  lines.push(`${v}${" ".repeat(totalWidth - 2)}${v}`);

  // Column headers
  const headerLine = [
    padRight("Service", col1),
    padRight("Status", col2),
    padRight("Details", col3),
  ].join(`${v}`);
  lines.push(`${v}${colorize(headerLine, "cyan", opts.useColors)}${v}`);

  // Separator
  lines.push(
    `${lt}${h.repeat(col1)}${tt}${h.repeat(col2)}${tt}${h.repeat(col3)}${rt}`,
  );

  // Circuit Breakers section
  const cbEntries = Object.entries(status.circuitBreakers);
  if (cbEntries.length > 0) {
    lines.push(
      `${v}${colorize(padRight("  Circuit Breakers", totalWidth - 2), "dim", opts.useColors)}${v}`,
    );

    for (const [service, cb] of cbEntries) {
      const { emoji, statusText, color } = formatCircuitBreakerStatus(cb);
      const details = formatCircuitBreakerDetails(cb);

      const row = [
        padRight(`  ${service}`, col1),
        padRight(
          colorize(`${emoji} ${statusText}`, color, opts.useColors),
          col2,
        ),
        padRight(colorize(details, "dim", opts.useColors), col3),
      ].join(`${v}`);
      lines.push(`${v}${row}${v}`);
    }
  }

  // Rate Limiters section
  const rlEntries = Object.entries(status.rateLimiters).filter(
    ([, val]) => val !== null,
  ) as [string, RateLimiterStatus][];
  if (rlEntries.length > 0) {
    lines.push(
      `${v}${colorize(padRight("  Rate Limiters", totalWidth - 2), "dim", opts.useColors)}${v}`,
    );

    for (const [service, rl] of rlEntries) {
      const { emoji, statusText, color } = formatRateLimiterStatus(rl);
      const details = formatRateLimiterDetails(rl);

      const row = [
        padRight(`  ${service}`, col1),
        padRight(
          colorize(`${emoji} ${statusText}`, color, opts.useColors),
          col2,
        ),
        padRight(colorize(details, "dim", opts.useColors), col3),
      ].join(`${v}`);
      lines.push(`${v}${row}${v}`);
    }
  }

  // Empty state
  if (cbEntries.length === 0 && rlEntries.length === 0) {
    lines.push(
      `${v}${padCenter("No status data available", totalWidth - 2)}${v}`,
    );
  }

  // Footer
  lines.push(`${bl}${h.repeat(totalWidth - 2)}${br}`);
  lines.push("");

  return lines.join("\n");
}

/** Format circuit breaker status for display */
function formatCircuitBreakerStatus(cb: CircuitBreakerStatus): {
  emoji: string;
  statusText: string;
  color: keyof typeof COLORS;
} {
  switch (cb.state) {
    case "closed":
      return {
        emoji: STATUS_EMOJIS.healthy,
        statusText: "Healthy",
        color: "green",
      };
    case "half-open":
      return {
        emoji: STATUS_EMOJIS.degraded,
        statusText: "Recovering",
        color: "yellow",
      };
    case "open":
      return {
        emoji: STATUS_EMOJIS.unhealthy,
        statusText: "Tripped",
        color: "magenta",
      };
    default:
      return {
        emoji: STATUS_EMOJIS.unknown,
        statusText: "Unknown",
        color: "dim",
      };
  }
}

/** Format circuit breaker details */
function formatCircuitBreakerDetails(cb: CircuitBreakerStatus): string {
  const parts: string[] = [];

  if (cb.failures !== undefined && cb.failures > 0) {
    parts.push(`failures: ${cb.failures}`);
  }

  if (cb.nextRetryTime) {
    const remaining = Math.max(0, cb.nextRetryTime - Date.now());
    if (remaining > 0) {
      parts.push(`retry in ${Math.ceil(remaining / 1000)}s`);
    }
  }

  return parts.length > 0 ? parts.join(", ") : "operational";
}

/** Format rate limiter status for display */
function formatRateLimiterStatus(rl: RateLimiterStatus): {
  emoji: string;
  statusText: string;
  color: keyof typeof COLORS;
} {
  if (rl.blocked) {
    return {
      emoji: STATUS_EMOJIS.blocked,
      statusText: "Blocked",
      color: "magenta",
    };
  }

  if (rl.available !== undefined && rl.limit !== undefined) {
    const ratio = rl.available / rl.limit;
    if (ratio > 0.5) {
      return {
        emoji: STATUS_EMOJIS.available,
        statusText: "Available",
        color: "green",
      };
    } else if (ratio > 0.2) {
      return {
        emoji: STATUS_EMOJIS.degraded,
        statusText: "Limited",
        color: "yellow",
      };
    }
  }

  return { emoji: STATUS_EMOJIS.healthy, statusText: "OK", color: "green" };
}

/** Format rate limiter details */
function formatRateLimiterDetails(rl: RateLimiterStatus): string {
  const parts: string[] = [];

  if (rl.available !== undefined && rl.limit !== undefined) {
    parts.push(`${rl.available}/${rl.limit} remaining`);
  }

  if (rl.resetTime) {
    const remaining = Math.max(0, rl.resetTime - Date.now());
    if (remaining > 0) {
      parts.push(`resets in ${Math.ceil(remaining / 1000)}s`);
    }
  }

  return parts.length > 0 ? parts.join(", ") : "active";
}
