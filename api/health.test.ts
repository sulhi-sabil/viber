import handler from "./health";

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

describe("health endpoint", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("should reject non-GET methods", async () => {
    const req = { method: "POST", body: {} } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(405);
    expect(res._headers["Allow"]).toBe("GET");
  });

  it("should return not_configured when no services are configured", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.GEMINI_API_KEY;

    const req = { method: "GET" } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.data.status).toBe("not_configured");
    expect(res._json.data.services.supabase.status).toBe("not_configured");
    expect(res._json.data.services.gemini.status).toBe("not_configured");
  });

  it("should include timestamp in response", async () => {
    const req = { method: "GET" } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._json.data.timestamp).toBeDefined();
    expect(new Date(res._json.data.timestamp).toISOString()).toBe(
      res._json.data.timestamp,
    );
  });

  it("should include configured flags", async () => {
    const req = { method: "GET" } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._json.data.configured).toBeDefined();
    expect(typeof res._json.data.configured.supabase).toBe("boolean");
    expect(typeof res._json.data.configured.gemini).toBe("boolean");
  });
});
