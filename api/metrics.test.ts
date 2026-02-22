import handler from "./metrics";

const createMockRes = () => {
  const res: any = {
    _status: 0,
    _body: null,
    _headers: {} as Record<string, string>,
  };
  res.status = jest.fn((code: number) => {
    res._status = code;
    return res;
  });
  res.json = jest.fn((data: unknown) => {
    res._body = data;
    return res;
  });
  res.send = jest.fn((data: unknown) => {
    res._body = data;
    return res;
  });
  res.setHeader = jest.fn((key: string, value: string) => {
    res._headers[key] = value;
    return res;
  });
  return res;
};

jest.mock("./_lib/services", () => ({
  getServiceFactory: jest.fn(() => ({
    exportMetrics: jest.fn(
      () => `# HELP requests_total Total requests
# TYPE requests_total counter
requests_total{service="gemini"} 100
`,
    ),
  })),
}));

describe("metrics endpoint", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.METRICS_BEARER_TOKEN;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("should reject non-GET methods", async () => {
    const req = { method: "POST" } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(405);
    expect(res._headers["Allow"]).toEqual(["GET"]);
  });

  it("should return Prometheus metrics", async () => {
    const req = { method: "GET" } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._headers["Content-Type"]).toContain("text/plain");
    expect(res._body).toContain("requests_total");
  });

  it("should set no-cache headers", async () => {
    const req = { method: "GET" } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._headers["Cache-Control"]).toBe(
      "no-store, no-cache, must-revalidate",
    );
  });

  it("should require auth when METRICS_BEARER_TOKEN is set", async () => {
    process.env.METRICS_BEARER_TOKEN = "test-token-123";
    const req = {
      method: "GET",
      headers: {},
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(401);
    expect(res._body).toEqual({ error: "Unauthorized" });
  });

  it("should accept valid bearer token", async () => {
    process.env.METRICS_BEARER_TOKEN = "test-token-123";
    const req = {
      method: "GET",
      headers: { authorization: "Bearer test-token-123" },
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._body).toContain("requests_total");
  });

  it("should reject invalid bearer token", async () => {
    process.env.METRICS_BEARER_TOKEN = "test-token-123";
    const req = {
      method: "GET",
      headers: { authorization: "Bearer wrong-token" },
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(401);
    expect(res._body).toEqual({ error: "Unauthorized" });
  });
});
