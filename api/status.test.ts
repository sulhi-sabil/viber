import handler from "./status";

const createMockRes = () => {
  const res: any = {
    _status: 0,
    _json: null,
    _headers: {} as Record<string, string>,
  };
  res.status = jest.fn((code: number) => {
    res._status = code;
    return res;
  });
  res.json = jest.fn((data: unknown) => {
    res._json = data;
    return res;
  });
  res.setHeader = jest.fn((key: string, value: string) => {
    res._headers[key] = value;
    return res;
  });
  return res;
};

jest.mock("../_lib/services", () => ({
  getServiceFactory: jest.fn(() => ({
    getAllCircuitBreakerStates: jest.fn(() => ({
      supabase: { state: "CLOSED", metrics: { failureCount: 0 } },
      gemini: { state: "CLOSED", metrics: { failureCount: 0 } },
    })),
  })),
  getSupabase: jest.fn(() => null),
  getGemini: jest.fn(() => ({
    getRateLimiterStatus: jest.fn(() => ({
      remainingRequests: 10,
      maxRequests: 15,
      windowMs: 60000,
    })),
  })),
}));

describe("status endpoint", () => {
  it("should reject non-GET methods", async () => {
    const req = { method: "POST" } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(405);
    expect(res._headers["Allow"]).toBe("GET");
  });

  it("should return circuit breaker states", async () => {
    const req = { method: "GET" } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.data.circuitBreakers).toBeDefined();
    expect(res._json.data.circuitBreakers.supabase).toBeDefined();
    expect(res._json.data.circuitBreakers.gemini).toBeDefined();
  });

  it("should return rate limiter status", async () => {
    const req = { method: "GET" } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._json.data.rateLimiters).toBeDefined();
    expect(res._json.data.rateLimiters.gemini).toBeDefined();
  });

  it("should include timestamp", async () => {
    const req = { method: "GET" } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._json.data.timestamp).toBeDefined();
    expect(new Date(res._json.data.timestamp).toISOString()).toBe(
      res._json.data.timestamp,
    );
  });
});
