/**
 * Health Check System
 *
 * Provides unified health monitoring for all services with support for:
 * - Individual service health checks
 * - Aggregate health status
 * - Dependency chain validation
 * - Response time tracking
 * - Extensible health check registry
 *
 * @module utils/health-check
 */

import { HEALTH_CHECK_TIMEOUT_MS } from "../config/constants";
import { logger } from "./logger";

/**
 * Health status values
 */
export type HealthStatus = "healthy" | "unhealthy" | "degraded";

/**
 * Result of a health check operation
 */
export interface HealthCheckResult {
  /** Health status of the service */
  status: HealthStatus;
  /** Service identifier */
  service: string;
  /** Timestamp of the health check (Unix ms) */
  timestamp: number;
  /** Response time in milliseconds */
  responseTime: number;
  /** Optional status message */
  message?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Health of dependencies */
  dependencies?: Record<string, HealthCheckResult>;
}

/**
 * Configuration for health checks
 */
export interface HealthCheckConfig {
  /** Timeout for health check in milliseconds */
  timeout: number;
  /** Number of retries on failure */
  retries?: number;
  /** Services this service depends on */
  dependencies?: string[];
}

/**
 * Function signature for health check implementations
 */
export type HealthCheckFunction = () =>
  | Promise<HealthCheckResult>
  | HealthCheckResult;

/**
 * Registry entry for a health check
 */
interface HealthCheckEntry {
  service: string;
  check: HealthCheckFunction;
  config: HealthCheckConfig;
  dependencies: Set<string>;
}

/**
 * Aggregate health status for multiple services
 */
export interface AggregateHealthResult {
  /** Overall system status */
  status: HealthStatus;
  /** Timestamp of the check */
  timestamp: number;
  /** Individual service health results */
  services: Record<string, HealthCheckResult>;
  /** Summary statistics */
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    degraded: number;
  };
}

/**
 * Default configuration for health checks
 */
export const DEFAULT_HEALTH_CHECK_CONFIG: HealthCheckConfig = {
  timeout: HEALTH_CHECK_TIMEOUT_MS,
  retries: 0,
};

/**
 * Centralized registry for managing health checks across all services.
 *
 * Features:
 * - Register/unregister service health checks
 * - Execute individual or aggregate health checks
 * - Support for service dependencies
 * - Response time tracking
 * - Circular dependency detection
 *
 * @example
 * ```typescript
 * // Register a service health check
 * healthCheckRegistry.register("supabase", async () => {
 *   const start = Date.now();
 *   // Perform health check
 *   return {
 *     status: "healthy",
 *     service: "supabase",
 *     timestamp: Date.now(),
 *     responseTime: Date.now() - start
 *   };
 * });
 *
 * // Check individual service
 * const result = await healthCheckRegistry.check("supabase");
 *
 * // Check all services
 * const allHealth = await healthCheckRegistry.checkAll();
 * ```
 */
export class HealthCheckRegistry {
  private checks: Map<string, HealthCheckEntry> = new Map();
  private dependencyGraph: Map<string, Set<string>> = new Map();

  /**
   * Register a health check for a service
   *
   * @param service - Service identifier
   * @param check - Health check function
   * @param config - Health check configuration
   * @throws Error if service is already registered
   */
  register(
    service: string,
    check: HealthCheckFunction,
    config: Partial<HealthCheckConfig> = {},
  ): void {
    if (this.checks.has(service)) {
      throw new Error(
        `Health check already registered for service: ${service}`,
      );
    }

    const fullConfig = { ...DEFAULT_HEALTH_CHECK_CONFIG, ...config };
    const dependencies = new Set(fullConfig.dependencies || []);

    // Validate dependencies exist
    for (const dep of dependencies) {
      if (!this.checks.has(dep)) {
        logger.warn(
          `Health check dependency '${dep}' not yet registered for '${service}'`,
        );
      }
    }

    // Check for circular dependencies
    if (dependencies.has(service)) {
      throw new Error(`Service '${service}' cannot depend on itself`);
    }

    this.checks.set(service, {
      service,
      check,
      config: fullConfig,
      dependencies,
    });

    this.dependencyGraph.set(service, dependencies);

    // Validate no circular dependencies
    this.validateNoCircularDependencies(service);

    logger.info(`Registered health check for service: ${service}`, {
      dependencies: Array.from(dependencies),
    });
  }

  /**
   * Unregister a health check
   *
   * @param service - Service identifier
   * @returns true if service was registered, false otherwise
   */
  unregister(service: string): boolean {
    const existed = this.checks.has(service);
    if (existed) {
      this.checks.delete(service);
      this.dependencyGraph.delete(service);

      // Remove from other services' dependencies
      this.dependencyGraph.forEach((deps) => deps.delete(service));
      this.checks.forEach((entry) => entry.dependencies.delete(service));

      logger.info(`Unregistered health check for service: ${service}`);
    }
    return existed;
  }

  /**
   * Check if a service is registered
   *
   * @param service - Service identifier
   * @returns true if registered, false otherwise
   */
  isRegistered(service: string): boolean {
    return this.checks.has(service);
  }

  /**
   * Get list of all registered services
   *
   * @returns Array of service names
   */
  getRegisteredServices(): string[] {
    return Array.from(this.checks.keys());
  }

  /**
   * Execute health check for a specific service
   *
   * @param service - Service identifier
   * @returns Health check result
   * @throws Error if service is not registered
   */
  async check(service: string): Promise<HealthCheckResult> {
    const entry = this.checks.get(service);
    if (!entry) {
      throw new Error(`No health check registered for service: ${service}`);
    }

    const startTime = Date.now();

    try {
      // Check dependencies first
      const dependencyResults: Record<string, HealthCheckResult> = {};
      let dependencyStatus: HealthStatus = "healthy";

      for (const dep of entry.dependencies) {
        const depResult = await this.check(dep);
        dependencyResults[dep] = depResult;

        if (depResult.status === "unhealthy") {
          dependencyStatus = "unhealthy";
        } else if (
          depResult.status === "degraded" &&
          dependencyStatus !== "unhealthy"
        ) {
          dependencyStatus = "degraded";
        }
      }

      // Execute actual health check with timeout
      const result = await this.executeWithTimeout(
        () => entry.check(),
        entry.config.timeout,
      );

      const responseTime = Date.now() - startTime;

      // Determine overall status considering dependencies
      let finalStatus = result.status;
      if (dependencyStatus === "unhealthy") {
        finalStatus = "unhealthy";
      } else if (dependencyStatus === "degraded" && finalStatus === "healthy") {
        finalStatus = "degraded";
      }

      const finalResult: HealthCheckResult = {
        ...result,
        status: finalStatus,
        responseTime,
        dependencies:
          entry.dependencies.size > 0 ? dependencyResults : undefined,
      };

      this.logHealthCheck(service, finalResult);
      return finalResult;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorResult: HealthCheckResult = {
        status: "unhealthy",
        service,
        timestamp: Date.now(),
        responseTime,
        message: error instanceof Error ? error.message : "Unknown error",
      };

      logger.error(`Health check failed for ${service}`, {
        error: errorResult.message,
      });
      return errorResult;
    }
  }

  /**
   * Execute health checks for all registered services
   *
   * @returns Aggregate health result
   */
  async checkAll(): Promise<AggregateHealthResult> {
    const services = Array.from(this.checks.keys());
    const results: Record<string, HealthCheckResult> = {};
    const timestamp = Date.now();

    // Execute all checks in parallel
    await Promise.all(
      services.map(async (service) => {
        try {
          results[service] = await this.check(service);
        } catch (error) {
          results[service] = {
            status: "unhealthy",
            service,
            timestamp: Date.now(),
            responseTime: 0,
            message:
              error instanceof Error ? error.message : "Check execution failed",
          };
        }
      }),
    );

    // Calculate aggregate status
    const statuses = Object.values(results).map((r) => r.status);
    const summary = {
      total: statuses.length,
      healthy: statuses.filter((s) => s === "healthy").length,
      unhealthy: statuses.filter((s) => s === "unhealthy").length,
      degraded: statuses.filter((s) => s === "degraded").length,
    };

    let overallStatus: HealthStatus = "healthy";
    if (summary.unhealthy > 0) {
      overallStatus = "unhealthy";
    } else if (summary.degraded > 0) {
      overallStatus = "degraded";
    }

    logger.info("Aggregate health check completed", {
      overallStatus,
      summary,
    });

    return {
      status: overallStatus,
      timestamp,
      services: results,
      summary,
    };
  }

  /**
   * Execute health check with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T> | T,
    timeout: number,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
        reject(new Error(`Health check timed out after ${timeout}ms`));
      }, timeout);
      timer.unref();

      Promise.resolve(fn())
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Validate no circular dependencies exist
   */
  private validateNoCircularDependencies(
    service: string,
    visited: Set<string> = new Set(),
  ): void {
    if (visited.has(service)) {
      throw new Error(
        `Circular dependency detected involving service: ${service}`,
      );
    }

    visited.add(service);
    const deps = this.dependencyGraph.get(service);

    if (deps) {
      for (const dep of deps) {
        this.validateNoCircularDependencies(dep, new Set(visited));
      }
    }
  }

  /**
   * Log health check result
   */
  private logHealthCheck(service: string, result: HealthCheckResult): void {
    const logData = {
      service,
      status: result.status,
      responseTime: `${result.responseTime}ms`,
    };

    if (result.status === "healthy") {
      logger.debug("Health check passed", logData);
    } else if (result.status === "degraded") {
      logger.warn("Health check degraded", {
        ...logData,
        message: result.message,
      });
    } else {
      logger.error("Health check failed", {
        ...logData,
        message: result.message,
      });
    }
  }
}

/**
 * Global health check registry instance
 */
export const healthCheckRegistry = new HealthCheckRegistry();

/**
 * Format health status with visual indicator for better DX
 * @param status - Health status
 * @returns Formatted status string with emoji
 */
export function formatHealthStatus(status: HealthStatus): string {
  const statusEmojis: Record<HealthStatus, string> = {
    healthy: "✅",
    degraded: "⚠️",
    unhealthy: "❌",
  };
  return `${statusEmojis[status]} ${status.toUpperCase()}`;
}

/**
 * Format a single health check result for human-readable output
 * @param result - Health check result
 * @param indentLevel - Indentation level for nested output
 * @returns Formatted string
 */
export function formatHealthCheckResult(
  result: HealthCheckResult,
  indentLevel = 0,
): string {
  const indent = "  ".repeat(indentLevel);
  const statusIcon =
    result.status === "healthy"
      ? "✅"
      : result.status === "degraded"
        ? "⚠️"
        : "❌";

  let output = `${indent}${statusIcon} ${result.service} (${result.responseTime}ms)`;

  if (result.message) {
    output += `\n${indent}   └─ ${result.message}`;
  }

  if (result.dependencies && Object.keys(result.dependencies).length > 0) {
    output += `\n${indent}   └─ Dependencies:`;
    for (const [depName, depResult] of Object.entries(result.dependencies)) {
      output +=
        "\n" +
        formatHealthCheckResult(depResult, indentLevel + 2).replace(
          depResult.service,
          depName,
        );
    }
  }

  return output;
}

/**
 * Format aggregate health result as a human-readable report
 * @param result - Aggregate health result
 * @returns Formatted multi-line string
 */
export function formatAggregateHealthResult(
  result: AggregateHealthResult,
): string {
  const statusIcon =
    result.status === "healthy"
      ? "✅"
      : result.status === "degraded"
        ? "⚠️"
        : "❌";

  const lines: string[] = [
    "",
    `╔══════════════════════════════════════════════════════════╗`,
    `║           HEALTH CHECK REPORT                            ║`,
    `╚══════════════════════════════════════════════════════════╝`,
    "",
    `${statusIcon} Overall Status: ${result.status.toUpperCase()}`,
    `🕐 Checked at: ${new Date(result.timestamp).toLocaleString()}`,
    "",
    `📊 Summary:`,
    `   • Total Services: ${result.summary.total}`,
    `   • ✅ Healthy: ${result.summary.healthy}`,
    `   • ⚠️  Degraded: ${result.summary.degraded}`,
    `   • ❌ Unhealthy: ${result.summary.unhealthy}`,
    "",
    `📋 Service Details:`,
    "",
  ];

  for (const [, serviceResult] of Object.entries(result.services)) {
    lines.push(formatHealthCheckResult(serviceResult));
    lines.push("");
  }

  lines.push("═══════════════════════════════════════════════════════════", "");

  return lines.join("\n");
}

/**
 * Create a new health check registry (for testing or isolation)
 */
export function createHealthCheckRegistry(): HealthCheckRegistry {
  return new HealthCheckRegistry();
}
