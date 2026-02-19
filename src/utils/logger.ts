import {
  LOGGER_MAX_SANITIZATION_DEPTH,
  LOGGER_MAX_SANITIZATION_KEYS,
  LOGGER_SANITIZATION_CACHE_SIZE,
  LOGGER_MAX_ARRAY_ITEMS,
  LOGGER_MAX_OBJECT_KEYS_PER_LEVEL,
  DEFAULT_SENSITIVE_FIELD_PATTERNS,
  SENSITIVE_DATA_REDACTION_FORMAT,
} from "../config/constants";

const SENSITIVE_PATTERNS = DEFAULT_SENSITIVE_FIELD_PATTERNS;

const MAX_DEPTH = LOGGER_MAX_SANITIZATION_DEPTH;
const MAX_KEYS = LOGGER_MAX_SANITIZATION_KEYS;
const CACHE_SIZE_LIMIT = LOGGER_SANITIZATION_CACHE_SIZE;
const MAX_ARRAY_ITEMS = LOGGER_MAX_ARRAY_ITEMS;

let patternCache = new Map<string, boolean>();

interface KeyCounter {
  count: number;
}

function isSensitiveKey(key: string): boolean {
  if (patternCache.has(key)) {
    return patternCache.get(key)!;
  }

  const result = SENSITIVE_PATTERNS.some((pattern) => pattern.test(key));
  patternCache.set(key, result);

  if (patternCache.size > CACHE_SIZE_LIMIT) {
    const entries = Array.from(patternCache.entries());
    patternCache = new Map(entries.slice(Math.floor(CACHE_SIZE_LIMIT / 2)));
  }

  return result;
}

function sanitizeData(
  data: unknown,
  key?: string,
  depth: number = 0,
  keyCount?: KeyCounter,
): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (depth > MAX_DEPTH) {
    return `[Object depth exceeds ${MAX_DEPTH} levels - data truncated]`;
  }

  if (keyCount && keyCount.count >= MAX_KEYS) {
    return `[Key limit exceeded (${MAX_KEYS}) - data truncated]`;
  }

  if (key && isSensitiveKey(key)) {
    return SENSITIVE_DATA_REDACTION_FORMAT(key);
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return data;

    return data.slice(0, MAX_ARRAY_ITEMS).map((item) => {
      if (keyCount) keyCount.count++;
      return sanitizeData(item, undefined, depth + 1, keyCount);
    });
  }

  if (typeof data === "object") {
    const sanitized: Record<string, unknown> = {};
    let localCount = 0;

    for (const [nestedKey, value] of Object.entries(
      data as Record<string, unknown>,
    )) {
      if (localCount >= LOGGER_MAX_OBJECT_KEYS_PER_LEVEL) break;

      if (keyCount) keyCount.count++;
      sanitized[nestedKey] = sanitizeData(
        value,
        nestedKey,
        depth + 1,
        keyCount,
      );
      localCount++;
    }

    return sanitized;
  }

  return data;
}

export interface LogContext {
  requestId?: string;
  correlationId?: string;
  operation?: string;
  component?: string;
  [key: string]: unknown;
}

export interface Logger {
  error(
    message: string,
    meta?: Record<string, unknown>,
    context?: LogContext,
  ): void;
  warn(
    message: string,
    meta?: Record<string, unknown>,
    context?: LogContext,
  ): void;
  success(
    message: string,
    meta?: Record<string, unknown>,
    context?: LogContext,
  ): void;
  info(
    message: string,
    meta?: Record<string, unknown>,
    context?: LogContext,
  ): void;
  debug(
    message: string,
    meta?: Record<string, unknown>,
    context?: LogContext,
  ): void;
  child(additionalContext: LogContext): Logger;
}

export interface LoggerOptions {
  useColors?: boolean;
  useEmoji?: boolean;
  outputFormat?: "console" | "json";
}

const LOG_LEVEL_CONFIG = {
  debug: { emoji: "🔍", label: "DEBUG", color: "\x1b[36m", reset: "\x1b[0m" },
  info: { emoji: "ℹ️ ", label: "INFO", color: "\x1b[32m", reset: "\x1b[0m" },
  success: {
    emoji: "✅",
    label: "SUCCESS",
    color: "\x1b[32m",
    reset: "\x1b[0m",
  },
  warn: { emoji: "⚠️ ", label: "WARN", color: "\x1b[33m", reset: "\x1b[0m" },
  error: { emoji: "❌", label: "ERROR", color: "\x1b[31m", reset: "\x1b[0m" },
} as const;

export class ConsoleLogger implements Logger {
  private level: "debug" | "info" | "warn" | "error";
  private useColors: boolean;
  private useEmoji: boolean;
  private outputFormat: "console" | "json";
  private context: LogContext;

  constructor(
    level: "debug" | "info" | "warn" | "error" = "info",
    options: LoggerOptions = {},
    context: LogContext = {},
  ) {
    this.level = level;
    // Auto-enable colors in development/TTY environments, disable in production
    this.useColors =
      options.useColors ??
      (typeof process !== "undefined" &&
        process.env?.NODE_ENV !== "production" &&
        (process.stdout?.isTTY || false));
    this.useEmoji = options.useEmoji ?? true;
    // Auto-enable JSON format in production environments for log aggregation
    this.outputFormat =
      options.outputFormat ??
      (typeof process !== "undefined" && process.env?.NODE_ENV === "production"
        ? "json"
        : "console");
    this.context = context;
  }

  child(additionalContext: LogContext): Logger {
    return new ConsoleLogger(
      this.level,
      {
        useColors: this.useColors,
        useEmoji: this.useEmoji,
        outputFormat: this.outputFormat,
      },
      { ...this.context, ...additionalContext },
    );
  }

  getLevel(): "debug" | "info" | "warn" | "error" {
    return this.level;
  }

  setLevel(level: "debug" | "info" | "warn" | "error"): void {
    this.level = level;
  }

  private shouldLog(level: "debug" | "info" | "warn" | "error"): boolean {
    const levels = ["debug", "info", "warn", "error"];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private formatContext(context?: LogContext): string {
    if (!context || Object.keys(context).length === 0) {
      return "";
    }

    const parts: string[] = [];
    if (context.requestId) {
      parts.push(`req-${context.requestId.slice(0, 8)}`);
    }
    if (context.correlationId && context.correlationId !== context.requestId) {
      parts.push(`corr-${context.correlationId.slice(0, 8)}`);
    }
    if (context.operation) {
      parts.push(context.operation);
    }
    if (context.component) {
      parts.push(`[${context.component}]`);
    }

    if (parts.length === 0) {
      return "";
    }

    return this.useColors
      ? `\x1b[90m[${parts.join(" ")}]\x1b[0m`
      : `[${parts.join(" ")}]`;
  }

  private mergeMetaWithContext(
    meta: Record<string, unknown> | undefined,
    context: LogContext | undefined,
  ): Record<string, unknown> | undefined {
    if (!context || Object.keys(context).length === 0) {
      return meta;
    }

    const contextFields: Record<string, unknown> = {};
    if (context.requestId) contextFields.requestId = context.requestId;
    if (context.correlationId)
      contextFields.correlationId = context.correlationId;
    if (context.operation) contextFields.operation = context.operation;
    if (context.component) contextFields.component = context.component;

    if (!meta || Object.keys(meta).length === 0) {
      return Object.keys(contextFields).length > 0 ? contextFields : undefined;
    }

    return { ...contextFields, ...meta };
  }

  private formatLogLevel(
    level: "debug" | "info" | "success" | "warn" | "error",
  ): string {
    const config = LOG_LEVEL_CONFIG[level];
    const emoji = this.useEmoji ? `${config.emoji} ` : "";
    const label = `[${config.label}]`;

    if (this.useColors) {
      return `${config.color}${emoji}${label}${config.reset}`;
    }
    return `${emoji}${label}`;
  }

  private formatJsonLog(
    level: "debug" | "info" | "success" | "warn" | "error",
    message: string,
    meta?: Record<string, unknown>,
  ): string {
    const config = LOG_LEVEL_CONFIG[level];
    const logEntry = {
      timestamp: this.formatTimestamp(),
      level: config.label,
      message,
      ...(meta && Object.keys(meta).length > 0
        ? { meta: sanitizeData(meta) }
        : {}),
    };
    return JSON.stringify(logEntry);
  }

  debug(
    message: string,
    meta?: Record<string, unknown>,
    context?: LogContext,
  ): void {
    if (this.shouldLog("debug")) {
      const mergedContext = { ...this.context, ...context };
      const mergedMeta = this.mergeMetaWithContext(meta, mergedContext);
      const sanitizedMeta = mergedMeta ? sanitizeData(mergedMeta) : undefined;

      if (this.outputFormat === "json") {
        console.debug(
          this.formatJsonLog(
            "debug",
            message,
            sanitizedMeta as Record<string, unknown> | undefined,
          ),
        );
      } else {
        const metaStr = sanitizedMeta ? JSON.stringify(sanitizedMeta) : "";
        const contextStr = this.formatContext(mergedContext);
        const logMessage = `${this.formatLogLevel("debug")} ${contextStr} [${this.formatTimestamp()}] ${message}`;
        if (metaStr) {
          console.debug(logMessage, metaStr);
        } else {
          console.debug(logMessage);
        }
      }
    }
  }

  success(
    message: string,
    meta?: Record<string, unknown>,
    context?: LogContext,
  ): void {
    if (this.shouldLog("info")) {
      const mergedContext = { ...this.context, ...context };
      const mergedMeta = this.mergeMetaWithContext(meta, mergedContext);
      const sanitizedMeta = mergedMeta ? sanitizeData(mergedMeta) : undefined;

      if (this.outputFormat === "json") {
        console.info(
          this.formatJsonLog(
            "success",
            message,
            sanitizedMeta as Record<string, unknown> | undefined,
          ),
        );
      } else {
        const metaStr = sanitizedMeta ? JSON.stringify(sanitizedMeta) : "";
        const contextStr = this.formatContext(mergedContext);
        const logMessage = `${this.formatLogLevel("success")} ${contextStr} [${this.formatTimestamp()}] ${message}`;
        if (metaStr) {
          console.info(logMessage, metaStr);
        } else {
          console.info(logMessage);
        }
      }
    }
  }

  info(
    message: string,
    meta?: Record<string, unknown>,
    context?: LogContext,
  ): void {
    if (this.shouldLog("info")) {
      const mergedContext = { ...this.context, ...context };
      const mergedMeta = this.mergeMetaWithContext(meta, mergedContext);
      const sanitizedMeta = mergedMeta ? sanitizeData(mergedMeta) : undefined;

      if (this.outputFormat === "json") {
        console.info(
          this.formatJsonLog(
            "info",
            message,
            sanitizedMeta as Record<string, unknown> | undefined,
          ),
        );
      } else {
        const metaStr = sanitizedMeta ? JSON.stringify(sanitizedMeta) : "";
        const contextStr = this.formatContext(mergedContext);
        const logMessage = `${this.formatLogLevel("info")} ${contextStr} [${this.formatTimestamp()}] ${message}`;
        if (metaStr) {
          console.info(logMessage, metaStr);
        } else {
          console.info(logMessage);
        }
      }
    }
  }

  warn(
    message: string,
    meta?: Record<string, unknown>,
    context?: LogContext,
  ): void {
    if (this.shouldLog("warn")) {
      const mergedContext = { ...this.context, ...context };
      const mergedMeta = this.mergeMetaWithContext(meta, mergedContext);
      const sanitizedMeta = mergedMeta ? sanitizeData(mergedMeta) : undefined;

      if (this.outputFormat === "json") {
        console.warn(
          this.formatJsonLog(
            "warn",
            message,
            sanitizedMeta as Record<string, unknown> | undefined,
          ),
        );
      } else {
        const metaStr = sanitizedMeta ? JSON.stringify(sanitizedMeta) : "";
        const contextStr = this.formatContext(mergedContext);
        const logMessage = `${this.formatLogLevel("warn")} ${contextStr} [${this.formatTimestamp()}] ${message}`;
        if (metaStr) {
          console.warn(logMessage, metaStr);
        } else {
          console.warn(logMessage);
        }
      }
    }
  }

  error(
    message: string,
    meta?: Record<string, unknown>,
    context?: LogContext,
  ): void {
    if (this.shouldLog("error")) {
      const mergedContext = { ...this.context, ...context };
      const mergedMeta = this.mergeMetaWithContext(meta, mergedContext);
      const sanitizedMeta = mergedMeta ? sanitizeData(mergedMeta) : undefined;

      if (this.outputFormat === "json") {
        console.error(
          this.formatJsonLog(
            "error",
            message,
            sanitizedMeta as Record<string, unknown> | undefined,
          ),
        );
      } else {
        const metaStr = sanitizedMeta ? JSON.stringify(sanitizedMeta) : "";
        const contextStr = this.formatContext(mergedContext);
        const logMessage = `${this.formatLogLevel("error")} ${contextStr} [${this.formatTimestamp()}] ${message}`;
        if (metaStr) {
          console.error(logMessage, metaStr);
        } else {
          console.error(logMessage);
        }
      }
    }
  }
}

const getLogLevel = (): "debug" | "info" | "warn" | "error" => {
  if (typeof process !== "undefined" && process.env && process.env.LOG_LEVEL) {
    return process.env.LOG_LEVEL as "debug" | "info" | "warn" | "error";
  }
  return "info";
};

export const logger = new ConsoleLogger(getLogLevel());
