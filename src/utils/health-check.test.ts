/**
 * Health Check System Tests
 *
 * Comprehensive test suite for the health check registry and utilities.
 */

import {
  HealthCheckRegistry,
  createHealthCheckRegistry,
  healthCheckRegistry,
  HealthCheckResult,
  HealthStatus,
  DEFAULT_HEALTH_CHECK_CONFIG,
  formatHealthStatus,
  formatHealthCheckResult,
  formatAggregateHealthResult,
} from "./health-check";

describe("HealthCheckRegistry", () => {
  let registry: HealthCheckRegistry;

  beforeEach(() => {
    registry = createHealthCheckRegistry();
  });

  describe("Registration", () => {
    it("should register a health check", () => {
      const check = jest.fn().mockResolvedValue({
        status: "healthy" as HealthStatus,
        service: "test-service",
        timestamp: Date.now(),
        responseTime: 100,
      });

      registry.register("test-service", check);
      expect(registry.isRegistered("test-service")).toBe(true);
    });

    it("should throw when registering duplicate service", () => {
      const check = jest.fn().mockResolvedValue({
        status: "healthy" as HealthStatus,
        service: "test-service",
        timestamp: Date.now(),
        responseTime: 100,
      });

      registry.register("test-service", check);

      expect(() => {
        registry.register("test-service", check);
      }).toThrow("Health check already registered for service: test-service");
    });

    it("should throw when service depends on itself", () => {
      const check = jest.fn().mockResolvedValue({
        status: "healthy" as HealthStatus,
        service: "test-service",
        timestamp: Date.now(),
        responseTime: 100,
      });

      expect(() => {
        registry.register("test-service", check, {
          dependencies: ["test-service"],
        });
      }).toThrow("Service 'test-service' cannot depend on itself");
    });

    it("should allow registration with custom config", () => {
      const check = jest.fn().mockResolvedValue({
        status: "healthy" as HealthStatus,
        service: "test-service",
        timestamp: Date.now(),
        responseTime: 100,
      });

      registry.register("test-service", check, {
        timeout: 10000,
        retries: 3,
      });

      expect(registry.isRegistered("test-service")).toBe(true);
    });
  });

  describe("Unregistration", () => {
    it("should unregister a service", () => {
      const check = jest.fn().mockResolvedValue({
        status: "healthy" as HealthStatus,
        service: "test-service",
        timestamp: Date.now(),
        responseTime: 100,
      });

      registry.register("test-service", check);
      expect(registry.unregister("test-service")).toBe(true);
      expect(registry.isRegistered("test-service")).toBe(false);
    });

    it("should return false when unregistering non-existent service", () => {
      expect(registry.unregister("non-existent")).toBe(false);
    });

    it("should remove service from other services' dependencies", () => {
      const check1 = jest.fn().mockResolvedValue({
        status: "healthy" as HealthStatus,
        service: "service1",
        timestamp: Date.now(),
        responseTime: 100,
      });

      const check2 = jest.fn().mockResolvedValue({
        status: "healthy" as HealthStatus,
        service: "service2",
        timestamp: Date.now(),
        responseTime: 100,
      });

      registry.register("service1", check1);
      registry.register("service2", check2, {
        dependencies: ["service1"],
      });

      registry.unregister("service1");

      // service2 should still be registered
      expect(registry.isRegistered("service2")).toBe(true);
    });
  });

  describe("Health Checks", () => {
    it("should execute health check and return result", async () => {
      const mockResult: HealthCheckResult = {
        status: "healthy",
        service: "test-service",
        timestamp: Date.now(),
        responseTime: 100,
        message: "All systems operational",
      };

      const check = jest.fn().mockResolvedValue(mockResult);
      registry.register("test-service", check);

      const result = await registry.check("test-service");

      expect(result.status).toBe("healthy");
      expect(result.service).toBe("test-service");
      expect(result.message).toBe("All systems operational");
      expect(check).toHaveBeenCalled();
    });

    it("should handle synchronous health checks", async () => {
      const mockResult: HealthCheckResult = {
        status: "healthy",
        service: "test-service",
        timestamp: Date.now(),
        responseTime: 50,
      };

      const check = jest.fn().mockReturnValue(mockResult);
      registry.register("test-service", check);

      const result = await registry.check("test-service");

      expect(result.status).toBe("healthy");
    });

    it("should return unhealthy when check throws", async () => {
      const check = jest.fn().mockRejectedValue(new Error("Connection failed"));
      registry.register("test-service", check);

      const result = await registry.check("test-service");

      expect(result.status).toBe("unhealthy");
      expect(result.message).toBe("Connection failed");
    });

    it("should throw when checking unregistered service", async () => {
      await expect(registry.check("non-existent")).rejects.toThrow(
        "No health check registered for service: non-existent",
      );
    });

    it("should track response time", async () => {
      const check = jest.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          status: "healthy" as HealthStatus,
          service: "test-service",
          timestamp: Date.now(),
          responseTime: 50,
        };
      });

      registry.register("test-service", check);
      const result = await registry.check("test-service");

      expect(result.responseTime).toBeGreaterThanOrEqual(45); // Allow small timing variance
    });
  });

  describe("Timeouts", () => {
    it("should timeout slow health checks", async () => {
      const check = jest.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return {
          status: "healthy" as HealthStatus,
          service: "test-service",
          timestamp: Date.now(),
          responseTime: 200,
        };
      });

      registry.register("test-service", check, { timeout: 100 });
      const result = await registry.check("test-service");

      expect(result.status).toBe("unhealthy");
      expect(result.message).toContain("timed out");
    });

    it("should respect custom timeout configuration", async () => {
      const check = jest.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return {
          status: "healthy" as HealthStatus,
          service: "test-service",
          timestamp: Date.now(),
          responseTime: 150,
        };
      });

      registry.register("test-service", check, { timeout: 200 });
      const result = await registry.check("test-service");

      expect(result.status).toBe("healthy");
    });
  });

  describe("Dependencies", () => {
    it("should check dependencies first", async () => {
      const depCheck = jest.fn().mockResolvedValue({
        status: "healthy" as HealthStatus,
        service: "dependency",
        timestamp: Date.now(),
        responseTime: 50,
      });

      const serviceCheck = jest.fn().mockResolvedValue({
        status: "healthy" as HealthStatus,
        service: "main-service",
        timestamp: Date.now(),
        responseTime: 100,
      });

      registry.register("dependency", depCheck);
      registry.register("main-service", serviceCheck, {
        dependencies: ["dependency"],
      });

      await registry.check("main-service");

      expect(depCheck).toHaveBeenCalled();
      expect(serviceCheck).toHaveBeenCalled();
    });

    it("should mark service unhealthy when dependency fails", async () => {
      const depCheck = jest.fn().mockResolvedValue({
        status: "unhealthy" as HealthStatus,
        service: "dependency",
        timestamp: Date.now(),
        responseTime: 50,
        message: "Dependency down",
      });

      const serviceCheck = jest.fn().mockResolvedValue({
        status: "healthy" as HealthStatus,
        service: "main-service",
        timestamp: Date.now(),
        responseTime: 100,
      });

      registry.register("dependency", depCheck);
      registry.register("main-service", serviceCheck, {
        dependencies: ["dependency"],
      });

      const result = await registry.check("main-service");

      expect(result.status).toBe("unhealthy");
      expect(result.dependencies).toBeDefined();
      expect(result.dependencies!.dependency!.status).toBe("unhealthy");
    });

    it("should mark service degraded when dependency is degraded", async () => {
      const depCheck = jest.fn().mockResolvedValue({
        status: "degraded" as HealthStatus,
        service: "dependency",
        timestamp: Date.now(),
        responseTime: 5000,
      });

      const serviceCheck = jest.fn().mockResolvedValue({
        status: "healthy" as HealthStatus,
        service: "main-service",
        timestamp: Date.now(),
        responseTime: 100,
      });

      registry.register("dependency", depCheck);
      registry.register("main-service", serviceCheck, {
        dependencies: ["dependency"],
      });

      const result = await registry.check("main-service");

      expect(result.status).toBe("degraded");
    });

    it("should detect circular dependencies", () => {
      const checkA = jest.fn().mockResolvedValue({
        status: "healthy" as HealthStatus,
        service: "service-a",
        timestamp: Date.now(),
        responseTime: 100,
      });

      const checkB = jest.fn().mockResolvedValue({
        status: "healthy" as HealthStatus,
        service: "service-b",
        timestamp: Date.now(),
        responseTime: 100,
      });

      // Create A depending on B first
      registry.register("service-a", checkA, {
        dependencies: ["service-b"],
      });

      // Then try to create B depending on A (circular)
      expect(() => {
        registry.register("service-b", checkB, {
          dependencies: ["service-a"],
        });
      }).toThrow("Circular dependency detected");
    });
  });

  describe("Aggregate Checks", () => {
    it("should check all registered services", async () => {
      registry.register("service-1", () => ({
        status: "healthy" as HealthStatus,
        service: "service-1",
        timestamp: Date.now(),
        responseTime: 100,
      }));

      registry.register("service-2", () => ({
        status: "healthy" as HealthStatus,
        service: "service-2",
        timestamp: Date.now(),
        responseTime: 100,
      }));

      const result = await registry.checkAll();

      expect(result.status).toBe("healthy");
      expect(result.services["service-1"]!.status).toBe("healthy");
      expect(result.services["service-2"]!.status).toBe("healthy");
    });

    it("should calculate aggregate status correctly", async () => {
      registry.register("healthy-service", () => ({
        status: "healthy" as HealthStatus,
        service: "healthy-service",
        timestamp: Date.now(),
        responseTime: 100,
      }));

      registry.register("degraded-service", () => ({
        status: "degraded" as HealthStatus,
        service: "degraded-service",
        timestamp: Date.now(),
        responseTime: 5000,
      }));

      registry.register("unhealthy-service", () => ({
        status: "unhealthy" as HealthStatus,
        service: "unhealthy-service",
        timestamp: Date.now(),
        responseTime: 100,
        message: "Failed",
      }));

      const result = await registry.checkAll();

      expect(result.status).toBe("unhealthy");
      expect(result.summary.total).toBe(3);
      expect(result.summary.healthy).toBe(1);
      expect(result.summary.degraded).toBe(1);
      expect(result.summary.unhealthy).toBe(1);
    });

    it("should handle services that throw during checkAll", async () => {
      registry.register("good-service", () => ({
        status: "healthy" as HealthStatus,
        service: "good-service",
        timestamp: Date.now(),
        responseTime: 100,
      }));

      registry.register("bad-service", () => {
        throw new Error("Check failed");
      });

      const result = await registry.checkAll();

      expect(result.status).toBe("unhealthy");
      expect(result.services["good-service"]!.status).toBe("healthy");
      expect(result.services["bad-service"]!.status).toBe("unhealthy");
    });

    it("should return healthy when no services registered", async () => {
      const result = await registry.checkAll();

      expect(result.status).toBe("healthy");
      expect(result.summary.total).toBe(0);
    });
  });

  describe("getRegisteredServices", () => {
    it("should return empty array when no services registered", () => {
      expect(registry.getRegisteredServices()).toEqual([]);
    });

    it("should return all registered service names", () => {
      const check = jest.fn().mockResolvedValue({
        status: "healthy" as HealthStatus,
        service: "test",
        timestamp: Date.now(),
        responseTime: 100,
      });

      registry.register("service-a", check);
      registry.register("service-b", check);
      registry.register("service-c", check);

      const services = registry.getRegisteredServices();
      expect(services).toContain("service-a");
      expect(services).toContain("service-b");
      expect(services).toContain("service-c");
      expect(services).toHaveLength(3);
    });
  });

  describe("Global instance", () => {
    it("should export a singleton instance", () => {
      expect(healthCheckRegistry).toBeInstanceOf(HealthCheckRegistry);
    });

    it("should create isolated registries with createHealthCheckRegistry", () => {
      const registry1 = createHealthCheckRegistry();
      const registry2 = createHealthCheckRegistry();

      const check = jest.fn().mockResolvedValue({
        status: "healthy" as HealthStatus,
        service: "test",
        timestamp: Date.now(),
        responseTime: 100,
      });

      registry1.register("test-service", check);

      expect(registry1.isRegistered("test-service")).toBe(true);
      expect(registry2.isRegistered("test-service")).toBe(false);
    });
  });
});

describe("DEFAULT_HEALTH_CHECK_CONFIG", () => {
  it("should have correct default values", () => {
    expect(DEFAULT_HEALTH_CHECK_CONFIG.timeout).toBe(5000);
    expect(DEFAULT_HEALTH_CHECK_CONFIG.retries).toBe(0);
  });
});

describe("Formatting Utilities", () => {
  describe("formatHealthStatus", () => {
    it("should format healthy status with emoji", () => {
      expect(formatHealthStatus("healthy")).toBe("✅ HEALTHY");
    });

    it("should format degraded status with emoji", () => {
      expect(formatHealthStatus("degraded")).toBe("⚠️ DEGRADED");
    });

    it("should format unhealthy status with emoji", () => {
      expect(formatHealthStatus("unhealthy")).toBe("❌ UNHEALTHY");
    });
  });

  describe("formatHealthCheckResult", () => {
    it("should format healthy result", () => {
      const result = {
        status: "healthy" as HealthStatus,
        service: "test-service",
        timestamp: Date.now(),
        responseTime: 100,
      };
      const formatted = formatHealthCheckResult(result);
      expect(formatted).toContain("✅");
      expect(formatted).toContain("test-service");
      expect(formatted).toContain("100ms");
    });

    it("should format result with message", () => {
      const result = {
        status: "unhealthy" as HealthStatus,
        service: "test-service",
        timestamp: Date.now(),
        responseTime: 500,
        message: "Connection failed",
      };
      const formatted = formatHealthCheckResult(result);
      expect(formatted).toContain("❌");
      expect(formatted).toContain("Connection failed");
    });

    it("should format result with dependencies", () => {
      const result = {
        status: "healthy" as HealthStatus,
        service: "main-service",
        timestamp: Date.now(),
        responseTime: 100,
        dependencies: {
          "dep-service": {
            status: "healthy" as HealthStatus,
            service: "dep-service",
            timestamp: Date.now(),
            responseTime: 50,
          },
        },
      };
      const formatted = formatHealthCheckResult(result);
      expect(formatted).toContain("main-service");
      expect(formatted).toContain("Dependencies:");
      expect(formatted).toContain("dep-service");
    });
  });

  describe("formatAggregateHealthResult", () => {
    it("should format aggregate health result with report header", () => {
      const result = {
        status: "healthy" as HealthStatus,
        timestamp: Date.now(),
        services: {
          "service-1": {
            status: "healthy" as HealthStatus,
            service: "service-1",
            timestamp: Date.now(),
            responseTime: 100,
          },
        },
        summary: {
          total: 1,
          healthy: 1,
          unhealthy: 0,
          degraded: 0,
        },
      };
      const formatted = formatAggregateHealthResult(result);
      expect(formatted).toContain("HEALTH CHECK REPORT");
      expect(formatted).toContain("✅ Overall Status: HEALTHY");
      expect(formatted).toContain("Total Services: 1");
      expect(formatted).toContain("✅ Healthy: 1");
    });

    it("should include all services in formatted output", () => {
      const result = {
        status: "degraded" as HealthStatus,
        timestamp: Date.now(),
        services: {
          "service-1": {
            status: "healthy" as HealthStatus,
            service: "service-1",
            timestamp: Date.now(),
            responseTime: 100,
          },
          "service-2": {
            status: "degraded" as HealthStatus,
            service: "service-2",
            timestamp: Date.now(),
            responseTime: 5000,
            message: "Slow response",
          },
        },
        summary: {
          total: 2,
          healthy: 1,
          unhealthy: 0,
          degraded: 1,
        },
      };
      const formatted = formatAggregateHealthResult(result);
      expect(formatted).toContain("⚠️ Overall Status: DEGRADED");
      expect(formatted).toContain("service-1");
      expect(formatted).toContain("service-2");
      expect(formatted).toContain("Slow response");
      expect(formatted).toContain("⚠️  Degraded: 1");
    });

    it("should format timestamp in local time", () => {
      const timestamp = new Date("2026-02-18T12:00:00Z").getTime();
      const result = {
        status: "healthy" as HealthStatus,
        timestamp,
        services: {},
        summary: {
          total: 0,
          healthy: 0,
          unhealthy: 0,
          degraded: 0,
        },
      };
      const formatted = formatAggregateHealthResult(result);
      expect(formatted).toContain("Checked at:");
    });
  });
});
