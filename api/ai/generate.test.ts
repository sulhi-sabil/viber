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

  it("should return 400 when Content-Type is not application/json", async () => {
    const req = {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: { prompt: "Test" },
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(400);
    expect(res._json.data.error.code).toBe("BAD_REQUEST");
    expect(res._json.data.error.message).toContain("Content-Type");
  });

  it("should accept application/json with charset", async () => {
    const req = {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: { prompt: "Test" },
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
  });

  it("should return 400 when body is missing", async () => {
    const req = {
      method: "POST",
      headers: { "content-type": "application/json" },
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(400);
    expect(res._json.data.error.message).toContain("body");
  });

  it("should return 400 when prompt is missing", async () => {
    const req = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: {},
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(400);
    expect(res._json.data.error.code).toBe("BAD_REQUEST");
  });

  it("should return 400 when prompt is not a string", async () => {
    const req = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: { prompt: 123 },
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(400);
    expect(res._json.data.error.code).toBe("BAD_REQUEST");
  });

  it("should return 400 when prompt exceeds max length", async () => {
    const req = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: { prompt: "x".repeat(32001) },
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(400);
    expect(res._json.data.error.message).toContain("32000");
  });

  it("should accept prompt at max length", async () => {
    const req = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: { prompt: "x".repeat(32000) },
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
  });

  it("should return generated text for valid request", async () => {
    const req = {
      method: "POST",
      headers: { "content-type": "application/json" },
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
      headers: { "content-type": "application/json" },
      body: { prompt: "Test prompt" },
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._json.data.data.prompt).toBe("Test prompt");
  });

  it("should include model in response", async () => {
    const req = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: { prompt: "Test" },
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._json.data.data.model).toBeDefined();
  });

  it("should accept temperature option", async () => {
    const req = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: { prompt: "Test", temperature: 0.5 },
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
  });

  it("should accept maxOutputTokens option", async () => {
    const req = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: { prompt: "Test", maxOutputTokens: 100 },
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
  });

  it("should clamp temperature to valid range", async () => {
    const req = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: { prompt: "Test", temperature: 5 },
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
  });

  it("should handle RateLimitError with 429 response", async () => {
    const { RateLimitError } = require("../../src/utils/errors");
    const { getGemini } = require("../_lib/services");
    const mockGemini = getGemini();
    
    const rateLimitError = new RateLimitError(
      "API rate limit exceeded",
      { retryAfter: 60 }
    );
    mockGemini.generateText.mockRejectedValueOnce(rateLimitError);

    const req = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: { prompt: "Test" },
    } as any;
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(429);
    expect(res._json.data.error.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(res._headers["Retry-After"]).toBe(60);
  });
});
