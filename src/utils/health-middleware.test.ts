/**
 * Health Middleware Tests
 *
 * Test suite for HTTP health endpoint middleware.
 */

import {
  createHealthHandler,
  createReadinessHandler,
  createLivenessHandler,
  createExpressHealthMiddleware,
  createHealthRoutes,
  type ReadinessResponse,
  type LivenessResponse,
  type ExpressHealthMiddleware,
} from "./health-middleware";
import {
  createHealthCheckRegistry,
  type HealthCheckRegistry,
  type HealthStatus,
} from "./health-check";

describe("Health Middleware", () => {
  let registry: HealthCheckRegistry;

  beforeEach(() => {
    registry = createHealthCheckRegistry();
  });

  describe("createHealthHandler", () => {
    it("should return 200 with healthy status when all services are healthy", async () => {
      registry.register("service-a", async () => ({
        status: "healthy" as HealthStatus,
        service: "service-a",
        timestamp: Date.now(),
        responseTime: 50,
      }));

      const handler = createHealthHandler(registry);
      const response = await handler();

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty("status", "healthy");
      expect(response.body).toHaveProperty("services");
      expect(response.body).toHaveProperty("summary");
      expect(response.headers["Content-Type"]).toBe("application/json");
    });

    it("should return 200 with degraded status when some services are degraded", async () => {
      registry.register("healthy-service", async () => ({
        status: "healthy" as HealthStatus,
        service: "healthy-service",
        timestamp: Date.now(),
        responseTime: 50,
      }));

      registry.register("degraded-service", async () => ({
        status: "degraded" as HealthStatus,
        service: "degraded-service",
        timestamp: Date.now(),
        responseTime: 500,
        message: "High latency",
      }));

      const handler = createHealthHandler(registry);
      const response = await handler();

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty("status", "degraded");
    });

    it("should return 503 with unhealthy status when any service is unhealthy", async () => {
      registry.register("unhealthy-service", async () => ({
        status: "unhealthy" as HealthStatus,
        service: "unhealthy-service",
        timestamp: Date.now(),
        responseTime: 0,
        message: "Connection refused",
      }));

      const handler = createHealthHandler(registry);
      const response = await handler();

      expect(response.statusCode).toBe(503);
      expect(response.body).toHaveProperty("status", "unhealthy");
    });

    it("should include cache-control header", async () => {
      const handler = createHealthHandler(registry);
      const response = await handler();

      expect(response.headers["Cache-Control"]).toBe(
        "no-cache, no-store, must-revalidate",
      );
    });

    it("should return unhealthy when registry throws error", async () => {
      const errorHandler = createHealthHandler({
        checkAll: jest.fn().mockRejectedValue(new Error("Registry error")),
      } as unknown as HealthCheckRegistry);

      const response = await errorHandler();

      expect(response.statusCode).toBe(503);
      expect(response.body).toHaveProperty("status", "unhealthy");
    });
  });

  describe("createReadinessHandler", () => {
    it("should return 200 ready when all services are healthy", async () => {
      registry.register("service-a", async () => ({
        status: "healthy" as HealthStatus,
        service: "service-a",
        timestamp: Date.now(),
        responseTime: 50,
      }));

      const handler = createReadinessHandler(registry);
      const response = await handler();

      expect(response.statusCode).toBe(200);
      const body = response.body as ReadinessResponse;
      expect(body.ready).toBe(true);
      expect(body.timestamp).toBeDefined();
    });

    it("should return 200 ready when services are degraded (still serving)", async () => {
      registry.register("degraded-service", async () => ({
        status: "degraded" as HealthStatus,
        service: "degraded-service",
        timestamp: Date.now(),
        responseTime: 500,
        message: "High latency",
      }));

      const handler = createReadinessHandler(registry);
      const response = await handler();

      expect(response.statusCode).toBe(200);
      const body = response.body as ReadinessResponse;
      expect(body.ready).toBe(true);
    });

    it("should return 503 not ready when any service is unhealthy", async () => {
      registry.register("unhealthy-service", async () => ({
        status: "unhealthy" as HealthStatus,
        service: "unhealthy-service",
        timestamp: Date.now(),
        responseTime: 0,
        message: "Connection failed",
      }));

      const handler = createReadinessHandler(registry);
      const response = await handler();

      expect(response.statusCode).toBe(503);
      const body = response.body as ReadinessResponse;
      expect(body.ready).toBe(false);
      expect(body.reasons).toContain("unhealthy-service: Connection failed");
    });

    it("should return 503 not ready when no services are registered", async () => {
      const handler = createReadinessHandler(registry);
      const response = await handler();

      expect(response.statusCode).toBe(503);
      const body = response.body as ReadinessResponse;
      expect(body.ready).toBe(false);
    });

    it("should include reasons when not ready", async () => {
      registry.register("service-a", async () => ({
        status: "unhealthy" as HealthStatus,
        service: "service-a",
        timestamp: Date.now(),
        responseTime: 0,
        message: "Timeout",
      }));

      registry.register("service-b", async () => ({
        status: "unhealthy" as HealthStatus,
        service: "service-b",
        timestamp: Date.now(),
        responseTime: 0,
        message: "Connection refused",
      }));

      const handler = createReadinessHandler(registry);
      const response = await handler();

      const body = response.body as ReadinessResponse;
      expect(body.reasons).toHaveLength(2);
      expect(body.reasons).toContain("service-a: Timeout");
      expect(body.reasons).toContain("service-b: Connection refused");
    });

    it("should handle registry errors gracefully", async () => {
      const errorHandler = createReadinessHandler({
        checkAll: jest.fn().mockRejectedValue(new Error("Check failed")),
      } as unknown as HealthCheckRegistry);

      const response = await errorHandler();

      expect(response.statusCode).toBe(503);
      const body = response.body as ReadinessResponse;
      expect(body.ready).toBe(false);
      expect(body.reasons).toContain("Check failed");
    });
  });

  describe("createLivenessHandler", () => {
    it("should always return 200 alive", async () => {
      const handler = createLivenessHandler();
      const response = await handler();

      expect(response.statusCode).toBe(200);
      const body = response.body as LivenessResponse;
      expect(body.alive).toBe(true);
      expect(body.timestamp).toBeDefined();
    });

    it("should not depend on registry", async () => {
      const handler = createLivenessHandler();
      const response = await handler();

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty("alive", true);
    });

    it("should return proper headers", async () => {
      const handler = createLivenessHandler();
      const response = await handler();

      expect(response.headers["Content-Type"]).toBe("application/json");
      expect(response.headers["Cache-Control"]).toBe(
        "no-cache, no-store, must-revalidate",
      );
    });
  });

  describe("createExpressHealthMiddleware", () => {
    let middleware: ExpressHealthMiddleware;
    let mockRes: {
      status: jest.Mock;
      json: jest.Mock;
      setHeader: jest.Mock;
    };

    beforeEach(() => {
      registry.register("test-service", async () => ({
        status: "healthy" as HealthStatus,
        service: "test-service",
        timestamp: Date.now(),
        responseTime: 50,
      }));

      middleware = createExpressHealthMiddleware(registry);

      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
      };
    });

    describe("health handler", () => {
      it("should return aggregate health status", async () => {
        await middleware.health(
          {},
          mockRes as unknown as Parameters<typeof middleware.health>[1],
        );

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            status: "healthy",
            services: expect.any(Object),
            summary: expect.any(Object),
          }),
        );
      });

      it("should set response headers", async () => {
        await middleware.health(
          {},
          mockRes as unknown as Parameters<typeof middleware.health>[1],
        );

        expect(mockRes.setHeader).toHaveBeenCalledWith(
          "Content-Type",
          "application/json",
        );
        expect(mockRes.setHeader).toHaveBeenCalledWith(
          "Cache-Control",
          "no-cache, no-store, must-revalidate",
        );
      });

      it("should handle errors and return 503", async () => {
        const errorRegistry = {
          checkAll: jest.fn().mockRejectedValue(new Error("Check failed")),
        } as unknown as HealthCheckRegistry;

        const errorMiddleware = createExpressHealthMiddleware(errorRegistry);

        await errorMiddleware.health(
          {},
          mockRes as unknown as Parameters<typeof middleware.health>[1],
        );

        expect(mockRes.status).toHaveBeenCalledWith(503);
      });
    });

    describe("ready handler", () => {
      it("should return ready status when services are healthy", async () => {
        await middleware.ready(
          {},
          mockRes as unknown as Parameters<typeof middleware.ready>[1],
        );

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            ready: true,
          }),
        );
      });

      it("should return not ready when services are unhealthy", async () => {
        const unhealthyRegistry = createHealthCheckRegistry();
        unhealthyRegistry.register("unhealthy-service", async () => ({
          status: "unhealthy" as HealthStatus,
          service: "unhealthy-service",
          timestamp: Date.now(),
          responseTime: 0,
          message: "Failed",
        }));

        const unhealthyMiddleware =
          createExpressHealthMiddleware(unhealthyRegistry);

        await unhealthyMiddleware.ready(
          {},
          mockRes as unknown as Parameters<typeof middleware.ready>[1],
        );

        expect(mockRes.status).toHaveBeenCalledWith(503);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            ready: false,
          }),
        );
      });
    });

    describe("live handler", () => {
      it("should always return alive", async () => {
        await middleware.live(
          {},
          mockRes as unknown as Parameters<typeof middleware.live>[1],
        );

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            alive: true,
          }),
        );
      });

      it("should return 200 even on error", async () => {
        const errorMiddleware = createExpressHealthMiddleware(registry, {
          onError: jest.fn(),
        });

        await errorMiddleware.live(
          {},
          mockRes as unknown as Parameters<typeof middleware.live>[1],
        );

        expect(mockRes.status).toHaveBeenCalledWith(200);
      });
    });

    describe("error handling", () => {
      it("should call onError callback on health handler error", async () => {
        const onError = jest.fn();
        const errorRegistry = {
          checkAll: jest.fn().mockRejectedValue(new Error("Test error")),
        } as unknown as HealthCheckRegistry;

        const errorMiddleware = createExpressHealthMiddleware(errorRegistry, {
          onError,
        });

        await errorMiddleware.health(
          {},
          mockRes as unknown as Parameters<typeof middleware.health>[1],
        );

        expect(onError).toHaveBeenCalledWith(expect.any(Error), "health");
      });

      it("should call onError callback on ready handler error", async () => {
        const onError = jest.fn();
        const errorRegistry = {
          checkAll: jest.fn().mockRejectedValue(new Error("Test error")),
        } as unknown as HealthCheckRegistry;

        const errorMiddleware = createExpressHealthMiddleware(errorRegistry, {
          onError,
        });

        await errorMiddleware.ready(
          {},
          mockRes as unknown as Parameters<typeof middleware.ready>[1],
        );

        expect(onError).toHaveBeenCalledWith(expect.any(Error), "ready");
      });
    });
  });

  describe("createHealthRoutes", () => {
    it("should return route handlers mapped to paths", () => {
      const routes = createHealthRoutes(registry);

      expect(routes).toHaveProperty("/health");
      expect(routes).toHaveProperty("/health/ready");
      expect(routes).toHaveProperty("/health/live");

      expect(typeof routes["/health"]).toBe("function");
      expect(typeof routes["/health/ready"]).toBe("function");
      expect(typeof routes["/health/live"]).toBe("function");
    });

    it("should return working handlers", async () => {
      registry.register("test-service", async () => ({
        status: "healthy" as HealthStatus,
        service: "test-service",
        timestamp: Date.now(),
        responseTime: 50,
      }));

      const routes = createHealthRoutes(registry);
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
      };

      const healthHandler = routes["/health"]!;
      await healthHandler(
        {},
        mockRes as unknown as Parameters<typeof healthHandler>[1],
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("should use custom registry from options", async () => {
      const customRegistry = createHealthCheckRegistry();
      customRegistry.register("custom-service", async () => ({
        status: "healthy" as HealthStatus,
        service: "custom-service",
        timestamp: Date.now(),
        responseTime: 50,
      }));

      const routes = createHealthRoutes(registry, { registry: customRegistry });
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
      };

      const healthHandler = routes["/health"]!;
      await healthHandler(
        {},
        mockRes as unknown as Parameters<typeof healthHandler>[1],
      );




      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          services: expect.objectContaining({
            "custom-service": expect.any(Object),
          }),
        }),
      );
    });
  });

  describe("Integration with HealthCheckRegistry", () => {
    it("should work with real health checks", async () => {
      registry.register("database", async () => ({
        status: "healthy" as HealthStatus,
        service: "database",
        timestamp: Date.now(),
        responseTime: 10,
        metadata: { connections: 5 },
      }));

      registry.register("cache", async () => ({
        status: "degraded" as HealthStatus,
        service: "cache",
        timestamp: Date.now(),
        responseTime: 200,
        message: "High latency",
      }));

      const handler = createHealthHandler(registry);
      const response = await handler();

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty("status", "degraded");
      expect(response.body).toHaveProperty("services");
      expect((response.body as any).services).toHaveProperty("database");
      expect((response.body as any).services).toHaveProperty("cache");
    });

    it("should handle mixed health states correctly", async () => {
      registry.register("healthy", async () => ({
        status: "healthy" as HealthStatus,
        service: "healthy",
        timestamp: Date.now(),
        responseTime: 10,
      }));

      registry.register("degraded", async () => ({
        status: "degraded" as HealthStatus,
        service: "degraded",
        timestamp: Date.now(),
        responseTime: 100,
      }));

      registry.register("unhealthy", async () => ({
        status: "unhealthy" as HealthStatus,
        service: "unhealthy",
        timestamp: Date.now(),
        responseTime: 0,
        message: "Failed",
      }));

      const healthHandler = createHealthHandler(registry);
      const readyHandler = createReadinessHandler(registry);

      const healthResponse = await healthHandler();
      const readyResponse = await readyHandler();

      expect(healthResponse.statusCode).toBe(503);
      expect(healthResponse.body).toHaveProperty("status", "unhealthy");

      expect(readyResponse.statusCode).toBe(503);
      const readyBody = readyResponse.body as ReadinessResponse;
      expect(readyBody.ready).toBe(false);
      expect(readyBody.reasons).toHaveLength(1);
    });
  });
});
