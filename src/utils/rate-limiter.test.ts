import {
  RateLimiter,
  createRateLimiter,
  RateLimiterOptions,
} from "./rate-limiter";

describe("RateLimiter", () => {
  describe("Constructor", () => {
    it("should create instance with default options", () => {
      const limiter = new RateLimiter();
      expect(limiter).toBeInstanceOf(RateLimiter);
    });

    it("should create instance with custom options", () => {
      const options: RateLimiterOptions = {
        maxRequests: 10,
        windowMs: 30000,
        serviceName: "TestService",
      };
      const limiter = new RateLimiter(options);
      expect(limiter).toBeInstanceOf(RateLimiter);
    });

    it("should create instance via factory function", () => {
      const limiter = createRateLimiter();
      expect(limiter).toBeInstanceOf(RateLimiter);
    });

    it("should create instance via factory function with options", () => {
      const options: RateLimiterOptions = {
        maxRequests: 20,
        windowMs: 90000,
      };
      const limiter = createRateLimiter(options);
      expect(limiter).toBeInstanceOf(RateLimiter);
    });
  });

  describe("checkRateLimit", () => {
    it("should allow requests within limit", async () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowMs: 1000 });

      for (let i = 0; i < 5; i++) {
        await expect(limiter.checkRateLimit()).resolves.not.toThrow();
      }
    });

    it("should wait when limit is reached", async () => {
      const limiter = new RateLimiter({ maxRequests: 2, windowMs: 1000 });

      const startTime = Date.now();

      await limiter.checkRateLimit();
      await limiter.checkRateLimit();
      await limiter.checkRateLimit();

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(900);
    });

    it("should allow requests after window expires", async () => {
      const limiter = new RateLimiter({ maxRequests: 2, windowMs: 100 });

      await limiter.checkRateLimit();
      await limiter.checkRateLimit();

      await new Promise((resolve) => setTimeout(resolve, 150));

      await expect(limiter.checkRateLimit()).resolves.not.toThrow();
    });

    it("should handle multiple rapid requests", async () => {
      const limiter = new RateLimiter({ maxRequests: 10, windowMs: 1000 });

      const promises = Array(15)
        .fill(null)
        .map(() => limiter.checkRateLimit());

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });
  });

  describe("getRemainingRequests", () => {
    it("should return max requests initially", () => {
      const limiter = new RateLimiter({ maxRequests: 10, windowMs: 1000 });
      expect(limiter.getRemainingRequests()).toBe(10);
    });

    it("should decrease as requests are made", async () => {
      const limiter = new RateLimiter({ maxRequests: 10, windowMs: 1000 });

      await limiter.checkRateLimit();
      await limiter.checkRateLimit();
      await limiter.checkRateLimit();

      expect(limiter.getRemainingRequests()).toBe(7);
    });

    it("should not go below zero", async () => {
      const limiter = new RateLimiter({ maxRequests: 3, windowMs: 1000 });

      await limiter.checkRateLimit();
      await limiter.checkRateLimit();
      await limiter.checkRateLimit();

      const remaining = limiter.getRemainingRequests();
      expect(remaining).toBeGreaterThanOrEqual(0);
      expect(remaining).toBeLessThanOrEqual(3);
    });

    it("should reset after window expires", async () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowMs: 100 });

      await limiter.checkRateLimit();
      await limiter.checkRateLimit();
      await limiter.checkRateLimit();

      expect(limiter.getRemainingRequests()).toBe(2);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(limiter.getRemainingRequests()).toBe(5);
    });
  });

  describe("getMetrics", () => {
    it("should return initial metrics", () => {
      const limiter = new RateLimiter({ maxRequests: 10, windowMs: 1000 });

      const metrics = limiter.getMetrics();

      expect(metrics.totalRequests).toBe(0);
      expect(metrics.activeRequests).toBe(0);
      expect(metrics.remainingRequests).toBe(10);
      expect(typeof metrics.windowStart).toBe("number");
      expect(typeof metrics.windowEnd).toBe("number");
    });

    it("should update metrics after requests", async () => {
      const limiter = new RateLimiter({ maxRequests: 10, windowMs: 1000 });

      await limiter.checkRateLimit();
      await limiter.checkRateLimit();
      await limiter.checkRateLimit();

      const metrics = limiter.getMetrics();

      expect(metrics.totalRequests).toBeGreaterThanOrEqual(3);
      expect(metrics.activeRequests).toBe(3);
      expect(metrics.remainingRequests).toBe(7);
    });

    it("should track active requests correctly", async () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowMs: 100 });

      await limiter.checkRateLimit();
      await limiter.checkRateLimit();
      await limiter.checkRateLimit();

      await new Promise((resolve) => setTimeout(resolve, 150));

      const metrics = limiter.getMetrics();

      expect(metrics.activeRequests).toBe(0);
    });
  });

  describe("reset", () => {
    it("should clear all requests", async () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowMs: 1000 });

      await limiter.checkRateLimit();
      await limiter.checkRateLimit();
      await limiter.checkRateLimit();

      expect(limiter.getRemainingRequests()).toBeLessThan(5);

      limiter.reset();

      expect(limiter.getRemainingRequests()).toBe(5);
    });

    it("should reset metrics", async () => {
      const limiter = new RateLimiter({ maxRequests: 10, windowMs: 1000 });

      await limiter.checkRateLimit();
      await limiter.checkRateLimit();

      limiter.reset();

      const metrics = limiter.getMetrics();

      expect(metrics.totalRequests).toBe(0);
      expect(metrics.activeRequests).toBe(0);
    });
  });

  describe("Performance", () => {
    it("should handle high request volume efficiently", async () => {
      const limiter = new RateLimiter({
        maxRequests: 200,
        windowMs: 60000,
      });

      const startTime = Date.now();

      for (let i = 0; i < 150; i++) {
        await limiter.checkRateLimit();
      }

      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(500);
    });

    it("should not block synchronous checks", () => {
      const limiter = new RateLimiter({
        maxRequests: 100,
        windowMs: 60000,
      });

      const startTime = Date.now();

      for (let i = 0; i < 200; i++) {
        limiter.getRemainingRequests();
      }

      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(10);
    });
  });

  describe("Edge Cases", () => {
    it("should handle maxRequests of 1", async () => {
      const limiter = new RateLimiter({ maxRequests: 1, windowMs: 100 });

      expect(limiter.getRemainingRequests()).toBe(1);
      await limiter.checkRateLimit();
      expect(limiter.getRemainingRequests()).toBe(0);
    });

    it("should handle very short windows", async () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowMs: 50 });

      await limiter.checkRateLimit();
      await limiter.checkRateLimit();

      await new Promise((resolve) => setTimeout(resolve, 60));

      await expect(limiter.checkRateLimit()).resolves.not.toThrow();
    });

    it("should handle very long windows", async () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowMs: 600000 });

      for (let i = 0; i < 5; i++) {
        await limiter.checkRateLimit();
      }

      expect(limiter.getRemainingRequests()).toBe(0);
    });

    it("should handle service name in logs", async () => {
      const limiter = new RateLimiter({
        maxRequests: 2,
        windowMs: 1000,
        serviceName: "CustomService",
      });

      await limiter.checkRateLimit();
      await limiter.checkRateLimit();
      await limiter.checkRateLimit();

      await new Promise((resolve) => setTimeout(resolve, 1200));
    });
  });

  describe("Lazy Cleanup", () => {
    it("should not cleanup when below threshold", async () => {
      const limiter = new RateLimiter({
        maxRequests: 10,
        windowMs: 1000,
        cleanupThreshold: 100,
      });

      for (let i = 0; i < 50; i++) {
        await limiter.checkRateLimit();
      }

      expect(limiter.getRemainingRequests()).toBeLessThan(10);
    });

    it("should cleanup when above threshold", async () => {
      const limiter = new RateLimiter({
        maxRequests: 10,
        windowMs: 100,
        cleanupThreshold: 50,
      });

      for (let i = 0; i < 60; i++) {
        await limiter.checkRateLimit();
      }

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(limiter.getRemainingRequests()).toBeGreaterThan(0);
    });
  });
});
