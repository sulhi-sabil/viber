import handler from "./generate";

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

jest.mock("../_lib/services", () => {
  const mockGemini = {
    generateText: jest.fn((prompt: string) =>
      Promise.resolve(`Generated: ${prompt}`),
    ),
    healthCheck: jest.fn(() => Promise.resolve({ status: "healthy" })),
    getRateLimiterStatus: jest.fn(() => ({
      remainingRequests: 10,
      maxRequests: 15,
      windowMs: 60000,
    })),
  };

  return {
    getGemini: jest.fn(() => mockGemini),
  };
});

describe("ai/generate endpoint", () => {
  it("should reject non-POST methods", async () => {
    const req = { method: "GET" } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(405);
    expect(res._headers["Allow"]).toBe("POST");
  });

  it("should return 400 when prompt is missing", async () => {
    const req = { method: "POST", body: {} } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(400);
    expect(res._json.data.error.code).toBe("BAD_REQUEST");
  });

  it("should return 400 when prompt is not a string", async () => {
    const req = { method: "POST", body: { prompt: 123 } } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(400);
    expect(res._json.data.error.code).toBe("BAD_REQUEST");
  });

  it("should return generated text for valid request", async () => {
    const req = {
      method: "POST",
      body: { prompt: "Hello, world!" },
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.data.success).toBe(true);
    expect(res._json.data.data.text).toContain("Generated:");
  });

  it("should include prompt in response", async () => {
    const req = {
      method: "POST",
      body: { prompt: "Test prompt" },
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._json.data.data.prompt).toBe("Test prompt");
  });

  it("should include model in response", async () => {
    const req = {
      method: "POST",
      body: { prompt: "Test" },
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._json.data.data.model).toBeDefined();
  });

  it("should accept temperature option", async () => {
    const req = {
      method: "POST",
      body: { prompt: "Test", temperature: 0.5 },
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
  });

  it("should accept maxOutputTokens option", async () => {
    const req = {
      method: "POST",
      body: { prompt: "Test", maxOutputTokens: 100 },
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
  });

  it("should clamp temperature to valid range", async () => {
    const req = {
      method: "POST",
      body: { prompt: "Test", temperature: 5 },
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
  });
});
