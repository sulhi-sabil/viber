import {
  LOGGER_MAX_SANITIZATION_DEPTH,
  LOGGER_MAX_SANITIZATION_KEYS,
  LOGGER_SANITIZATION_CACHE_SIZE,
  LOGGER_MAX_ARRAY_ITEMS,
  LOGGER_MAX_OBJECT_KEYS_PER_LEVEL,
} from "../config/constants";

const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /api[_-]?key/i,
  /private[_-]?key/i,
  /access[_-]?token/i,
  /auth[_-]?token/i,
  /bearer/i,
  /session/i,
  /token/i,
  /credit[_-]?card/i,
  /ssn/i,
  /authorization/i,
];

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
    return `[SENSITIVE DATA REDACTED for key: ${key}]`;
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

export interface Logger {
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

export class ConsoleLogger implements Logger {
  private level: "debug" | "info" | "warn" | "error";

  constructor(level: "debug" | "info" | "warn" | "error" = "info") {
    this.level = level;
  }

  private shouldLog(level: "debug" | "info" | "warn" | "error"): boolean {
    const levels = ["debug", "info", "warn", "error"];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog("debug")) {
      const sanitizedMeta = meta ? sanitizeData(meta) : "";
      console.debug(
        `[DEBUG] [${this.formatTimestamp()}] ${message}`,
        sanitizedMeta,
      );
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog("info")) {
      const sanitizedMeta = meta ? sanitizeData(meta) : "";
      console.info(
        `[INFO] [${this.formatTimestamp()}] ${message}`,
        sanitizedMeta,
      );
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog("warn")) {
      const sanitizedMeta = meta ? sanitizeData(meta) : "";
      console.warn(
        `[WARN] [${this.formatTimestamp()}] ${message}`,
        sanitizedMeta,
      );
    }
  }

  error(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog("error")) {
      const sanitizedMeta = meta ? sanitizeData(meta) : "";
      console.error(
        `[ERROR] [${this.formatTimestamp()}] ${message}`,
        sanitizedMeta,
      );
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
