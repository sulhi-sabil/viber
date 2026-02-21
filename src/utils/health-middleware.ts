/**
 * Health Middleware
 *
 * Framework-agnostic HTTP middleware for health check endpoints.
 * Provides Express-compatible handlers for Kubernetes-style health probes.
 *
 * Endpoints:
 * - GET /health - Overall system health (aggregated)
 * - GET /health/ready - Readiness probe (can serve traffic)
 * - GET /health/live - Liveness probe (process is alive)
 *
 * @module utils/health-middleware
 */

import {
  type HealthCheckRegistry,
  type AggregateHealthResult,
} from "./health-check";

/**
 * Framework-agnostic response shape for health endpoints
 */
export interface HealthEndpointResponse {
  /** HTTP status code */
  statusCode: number;
  /** Response body */
  body: AggregateHealthResult | ReadinessResponse | LivenessResponse;
  /** Response headers */
  headers: Record<string, string>;
}

/**
 * Response shape for readiness probe
 */
export interface ReadinessResponse {
  /** Whether the service is ready to accept traffic */
  ready: boolean;
  /** Timestamp of the check */
  timestamp: number;
  /** Optional details about why not ready */
  reasons?: string[];
}

/**
 * Response shape for liveness probe
 */
export interface LivenessResponse {
  /** Whether the process is alive */
  alive: boolean;
  /** Timestamp of the check */
  timestamp: number;
}

/**
 * Configuration options for health middleware
 */
export interface HealthMiddlewareOptions {
  /** Custom health check registry (defaults to global registry) */
  registry?: HealthCheckRegistry;
  /** Include detailed service info in responses */
  includeDetails?: boolean;
  /** Custom error handler */
  onError?: (error: Error, endpoint: string) => void;
}

/**
 * Minimal Express-like request interface
 */
interface Request {
  method?: string;
  path?: string;
  headers?: Record<string, string | string[] | undefined>;
}

/**
 * Minimal Express-like response interface
 */
interface Response {
  status: (code: number) => Response;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string) => void;
}

/**
 * Create a framework-agnostic health handler for GET /health endpoint
 *
 * Returns aggregate health status for all registered services.
 * - HTTP 200 if system is healthy or degraded
 * - HTTP 503 if system is unhealthy
 *
 * @param registry - Health check registry instance
 * @returns Function that returns health endpoint response
 *
 * @example
 * ```typescript
 * const handler = createHealthHandler(healthCheckRegistry);
 * const response = await handler();
 * // response.statusCode: 200 | 503
 * // response.body: AggregateHealthResult
 * ```
 */
export function createHealthHandler(
  registry: HealthCheckRegistry,
  onError?: (error: Error) => void,
): () => Promise<HealthEndpointResponse> {
  return async (): Promise<HealthEndpointResponse> => {
    try {
      const result = await registry.checkAll();

      const statusCode =
        result.status === "unhealthy"
          ? 503
          : result.status === "degraded"
            ? 200 // Degraded is still serving
            : 200;

      return {
        statusCode,
        body: result,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);

      const errorBody: AggregateHealthResult = {
        status: "unhealthy",
        timestamp: Date.now(),
        services: {},
        summary: {
          total: 0,
          healthy: 0,
          unhealthy: 0,
          degraded: 0,
        },
      };

      return {
        statusCode: 503,
        body: errorBody,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      };
    }
  };
}

/**
 * Create a framework-agnostic readiness handler for GET /health/ready endpoint
 *
 * Kubernetes-style readiness probe. Returns 200 only if all services are healthy.
 * Degraded services are considered ready (still serving traffic).
 *
 * @param registry - Health check registry instance
 * @returns Function that returns readiness endpoint response
 *
 * @example
 * ```typescript
 * const handler = createReadinessHandler(healthCheckRegistry);
 * const response = await handler();
 * // response.statusCode: 200 | 503
 * // response.body: { ready: true/false, timestamp, reasons? }
 * ```
 */
export function createReadinessHandler(
  registry: HealthCheckRegistry,
  onError?: (error: Error) => void,
): () => Promise<HealthEndpointResponse> {
  return async (): Promise<HealthEndpointResponse> => {
    try {
      const result = await registry.checkAll();
      const timestamp = Date.now();

      // Ready if no services are unhealthy
      // Degraded services are still serving, so they're "ready"
      const isReady = result.summary.unhealthy === 0;

      // If no services registered, consider not ready
      const actuallyReady = isReady && result.summary.total > 0;

      const body: ReadinessResponse = {
        ready: actuallyReady,
        timestamp,
        ...(actuallyReady === false && {
          reasons: Object.entries(result.services)
            .filter(([, r]) => r.status === "unhealthy")
            .map(([name, r]) => `${name}: ${r.message || "unhealthy"}`),
        }),
      };

      return {
        statusCode: actuallyReady ? 200 : 503,
        body,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);

      const body: ReadinessResponse = {
        ready: false,
        timestamp: Date.now(),
        reasons: [err.message],
      };

      return {
        statusCode: 503,
        body,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      };
    }
  };
}

/**
 * Create a framework-agnostic liveness handler for GET /health/live endpoint
 *
 * Kubernetes-style liveness probe. Always returns 200 if the process is running.
 * Does NOT check service health - only confirms the process is alive.
 *
 * @returns Function that returns liveness endpoint response
 *
 * @example
 * ```typescript
 * const handler = createLivenessHandler();
 * const response = await handler();
 * // response.statusCode: always 200
 * // response.body: { alive: true, timestamp }
 * ```
 */
export function createLivenessHandler(): () => Promise<HealthEndpointResponse> {
  return async (): Promise<HealthEndpointResponse> => {
    const body: LivenessResponse = {
      alive: true,
      timestamp: Date.now(),
    };

    return {
      statusCode: 200,
      body,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    };
  };
}

/**
 * Express-compatible middleware object
 */
export interface ExpressHealthMiddleware {
  /** Handler for GET /health */
  health: (req: Request, res: Response) => Promise<void>;
  /** Handler for GET /health/ready */
  ready: (req: Request, res: Response) => Promise<void>;
  /** Handler for GET /health/live */
  live: (req: Request, res: Response) => Promise<void>;
}

/**
 * Create Express-compatible health middleware
 *
 * Returns an object with three handlers that can be used with Express.js:
 *
 * @param registry - Health check registry instance
 * @param options - Middleware configuration options
 * @returns Object with health, ready, and live handlers
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { createExpressHealthMiddleware, healthCheckRegistry } from 'viber-integration-layer';
 *
 * const app = express();
 * const healthMiddleware = createExpressHealthMiddleware(healthCheckRegistry);
 *
 * app.get('/health', healthMiddleware.health);
 * app.get('/health/ready', healthMiddleware.ready);
 * app.get('/health/live', healthMiddleware.live);
 * ```
 */
export function createExpressHealthMiddleware(
  registry: HealthCheckRegistry,
  options?: HealthMiddlewareOptions,
): ExpressHealthMiddleware {
  const actualRegistry = options?.registry ?? registry;

  // Create error handler that wraps the options.onError with endpoint name
  const handleError = (endpoint: string) => (error: Error) => {
    options?.onError?.(error, endpoint);
  };

  const healthHandler = createHealthHandler(actualRegistry, handleError("health"));
  const readinessHandler = createReadinessHandler(
    actualRegistry,
    handleError("ready"),
  );
  const livenessHandler = createLivenessHandler();

  const sendResponse = (
    res: Response,
    response: HealthEndpointResponse,
  ): void => {
    if (res.setHeader) {
      for (const [name, value] of Object.entries(response.headers)) {
        res.setHeader(name, value);
      }
    }
    res.status(response.statusCode).json(response.body);
  };

  return {
    health: async (_req: Request, res: Response): Promise<void> => {
      try {
        const response = await healthHandler();
        sendResponse(res, response);
      } catch (error) {
        options?.onError?.(
          error instanceof Error ? error : new Error(String(error)),
          "health",
        );
        res.status(503).json({
          status: "unhealthy",
          timestamp: Date.now(),
          services: {},
          summary: { total: 0, healthy: 0, unhealthy: 0, degraded: 0 },
        });
      }
    },

    ready: async (_req: Request, res: Response): Promise<void> => {
      try {
        const response = await readinessHandler();
        sendResponse(res, response);
      } catch (error) {
        options?.onError?.(
          error instanceof Error ? error : new Error(String(error)),
          "ready",
        );
        res.status(503).json({
          ready: false,
          timestamp: Date.now(),
          reasons: [
            error instanceof Error ? error.message : "Health check failed",
          ],
        });
      }
    },

    live: async (_req: Request, res: Response): Promise<void> => {
      try {
        const response = await livenessHandler();
        sendResponse(res, response);
      } catch (error) {
        // Liveness should always return 200 if process is alive
        // Even if there's an error in the handler itself
        options?.onError?.(
          error instanceof Error ? error : new Error(String(error)),
          "live",
        );
        res.status(200).json({
          alive: true,
          timestamp: Date.now(),
        });
      }
    },
  };
}

/**
 * Create a router-ready middleware object with route paths
 *
 * Returns handlers bound to specific paths for easy integration.
 *
 * @param registry - Health check registry instance
 * @param options - Middleware configuration options
 * @returns Object with route handlers mapped to paths
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { createHealthRoutes, healthCheckRegistry } from 'viber-integration-layer';
 *
 * const app = express();
 * const routes = createHealthRoutes(healthCheckRegistry);
 *
 * // Attach all health routes at once
 * for (const [path, handler] of Object.entries(routes)) {
 *   app.get(path, handler);
 * }
 * ```
 */
export function createHealthRoutes(
  registry: HealthCheckRegistry,
  options?: HealthMiddlewareOptions,
): Record<string, (req: Request, res: Response) => Promise<void>> {
  const middleware = createExpressHealthMiddleware(registry, options);

  return {
    "/health": middleware.health,
    "/health/ready": middleware.ready,
    "/health/live": middleware.live,
  };
}
