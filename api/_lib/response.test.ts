import {
  json,
  error,
  badRequest,
  unauthorized,
  serviceUnavailable,
  internalError,
  rateLimited,
} from "./response";

type MockResponse = {
  status: jest.Mock;
  json: jest.Mock;
  setHeader: jest.Mock;
};

const createMockResponse = (): MockResponse => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
  setHeader: jest.fn().mockReturnThis(),
});

describe("response helpers", () => {
  let mockRes: MockResponse;

  beforeEach(() => {
    mockRes = createMockResponse();
  });

  describe("json", () => {
    it("should send success response with data", () => {
      json(mockRes as unknown as any, { message: "test" });

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { message: "test" },
          timestamp: expect.any(String),
        }),
      );
    });

    it("should accept custom status code", () => {
      json(mockRes as unknown as any, { id: 1 }, 201);

      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });

  describe("error", () => {
    it("should send error response", () => {
      error(mockRes as unknown as any, "TEST_ERROR", "Test message", 400, {
        field: "value",
      });

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: {
            code: "TEST_ERROR",
            message: "Test message",
            details: { field: "value" },
          },
          timestamp: expect.any(String),
        }),
      );
    });
  });

  describe("badRequest", () => {
    it("should send 400 error", () => {
      badRequest(mockRes as unknown as any, "Invalid input");

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: "BAD_REQUEST",
            message: "Invalid input",
          }),
        }),
      );
    });
  });

  describe("unauthorized", () => {
    it("should send 401 error with default message", () => {
      unauthorized(mockRes as unknown as any);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "UNAUTHORIZED",
            message: "Unauthorized",
          }),
        }),
      );
    });

    it("should send 401 error with custom message", () => {
      unauthorized(mockRes as unknown as any, "Token expired");

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: "Token expired",
          }),
        }),
      );
    });
  });

  describe("serviceUnavailable", () => {
    it("should send 503 error", () => {
      serviceUnavailable(mockRes as unknown as any, "API key not configured");

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "SERVICE_UNAVAILABLE",
            message: "API key not configured",
          }),
        }),
      );
    });
  });

  describe("internalError", () => {
    it("should send 500 error", () => {
      internalError(mockRes as unknown as any, "Something went wrong", {
        stack: "...",
      });

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "INTERNAL_ERROR",
            message: "Something went wrong",
            details: { stack: "..." },
          }),
        }),
      );
    });
  });

  describe("rateLimited", () => {
    it("should send 429 error with default options", () => {
      rateLimited(mockRes as unknown as any, "Too many requests");

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many requests",
          }),
        }),
      );
    });

    it("should set rate limit headers when provided", () => {
      rateLimited(mockRes as unknown as any, "Rate limit exceeded", {
        limit: 100,
        remaining: 0,
        reset: 1700000000,
        retryAfter: 60,
      });

      expect(mockRes.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", 100);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "X-RateLimit-Remaining",
        0,
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "X-RateLimit-Reset",
        1700000000,
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith("Retry-After", 60);
    });

    it("should work with partial options", () => {
      rateLimited(mockRes as unknown as any, "Rate limited", {
        retryAfter: 30,
      });

      expect(mockRes.setHeader).toHaveBeenCalledWith("Retry-After", 30);
      expect(mockRes.setHeader).not.toHaveBeenCalledWith(
        "X-RateLimit-Limit",
        expect.anything(),
      );
    });
  });
});
