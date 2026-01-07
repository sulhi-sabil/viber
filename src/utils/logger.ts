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

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog("debug")) {
      console.debug(`[DEBUG] ${message}`, meta || "");
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog("info")) {
      console.info(`[INFO] ${message}`, meta || "");
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog("warn")) {
      console.warn(`[WARN] ${message}`, meta || "");
    }
  }

  error(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog("error")) {
      console.error(`[ERROR] ${message}`, meta || "");
    }
  }
}

export const logger = new ConsoleLogger(
  (process.env.LOG_LEVEL as "debug" | "info" | "warn" | "error") || "info",
);
