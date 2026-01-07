import {
  GeminiService,
  createGeminiClient,
  getGeminiClient,
  resetGeminiClient,
} from "../services/gemini";
import { RateLimitError, GeminiError, TimeoutError } from "../utils/errors";

describe("GeminiService", () => {
  let geminiService: GeminiService;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    resetGeminiClient();

    geminiService = new GeminiService({
      apiKey: "test-api-key-12345678",
      timeout: 30000,
      maxRetries: 3,
      circuitBreakerThreshold: 5,
      circuitBreakerResetTimeout: 60000,
      rateLimitRequests: 15,
      rateLimitWindow: 60000,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should throw error if API key is not provided", () => {
      expect(
        () =>
          new GeminiService({
            apiKey: "",
          }),
      ).toThrow("Gemini API key is required");
    });

    it("should initialize with default config", () => {
      const service = new GeminiService({
        apiKey: "test-api-key-12345678",
      });

      expect(service).toBeInstanceOf(GeminiService);
    });

    it("should initialize with custom config", () => {
      const service = new GeminiService({
        apiKey: "test-api-key-12345678",
        timeout: 60000,
        maxRetries: 5,
      });

      expect(service).toBeInstanceOf(GeminiService);
    });
  });

  describe("generateText", () => {
    it("should generate text successfully", async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: "Hello, World!" }],
            },
            finishReason: "STOP",
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await geminiService.generateText("Say hello");

      expect(result).toBe("Hello, World!");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should throw GeminiError if no content generated", async () => {
      const mockResponse = {
        candidates: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await expect(geminiService.generateText("Say hello")).rejects.toThrow(
        GeminiError,
      );
    });

    it("should handle API error responses", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message: "Bad request",
            code: 400,
          },
        }),
      });

      await expect(geminiService.generateText("Say hello")).rejects.toThrow(
        GeminiError,
      );
    });

    it("should handle rate limit errors", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        headers: {
          get: (name: string) => (name === "Retry-After" ? "60" : null),
        },
        json: async () => ({
          error: {
            message: "Rate limit exceeded",
          },
        }),
      });

      await expect(geminiService.generateText("Say hello")).rejects.toThrow(
        RateLimitError,
      );
    });

    it("should handle server errors with retry", async () => {
      let callCount = 0;

      mockFetch.mockImplementation(() => {
        callCount++;

        if (callCount < 3) {
          return Promise.resolve({
            ok: false,
            status: 503,
            json: async () => ({
              error: {
                message: "Service unavailable",
              },
            }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [{ text: "Hello, World!" }],
                },
              },
            ],
          }),
        });
      });

      const result = await geminiService.generateText("Say hello");

      expect(result).toBe("Hello, World!");
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("generateContent", () => {
    it("should generate content successfully with messages", async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: "Response" }],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const messages = [{ role: "user" as const, parts: [{ text: "Hello" }] }];

      const result = await geminiService.generateContent(messages);

      expect(result.candidates[0].content.parts[0].text).toBe("Response");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should pass generation config options", async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: "Response" }],
            },
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const messages = [{ role: "user" as const, parts: [{ text: "Hello" }] }];

      await geminiService.generateContent(messages, {
        temperature: 0.5,
        maxOutputTokens: 2048,
        topK: 50,
        topP: 0.9,
      });

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.generationConfig.temperature).toBe(0.5);
      expect(requestBody.generationConfig.maxOutputTokens).toBe(2048);
      expect(requestBody.generationConfig.topK).toBe(50);
      expect(requestBody.generationConfig.topP).toBe(0.9);
    });
  });

  describe("generateContentStream", () => {
    it("should handle streaming responses", async () => {
      const chunks: string[] = [];

      const streamData = [
        `data: ${JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: "Hello" }] },
            },
          ],
        })}\n\n`,
        `data: ${JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: " World" }] },
            },
          ],
        })}\n\n`,
        `data: ${JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: "!" }] },
              finishReason: "STOP",
            },
          ],
        })}\n\n`,
      ].join("");

      const mockReadableStream = new ReadableStream({
        async start(controller) {
          controller.enqueue(new TextEncoder().encode(streamData));
          controller.close();
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        body: mockReadableStream,
      });

      const messages = [
        { role: "user" as const, parts: [{ text: "Say hello" }] },
      ];

      await geminiService.generateContentStream(messages, {
        onChunk: (chunk) => {
          chunks.push(chunk.text);
        },
      });

      expect(chunks).toEqual(["Hello", " World", "!"]);
    });

    it("should handle streaming with onChunk callback", async () => {
      const receivedChunks: string[] = [];

      const streamData = `data: ${JSON.stringify({
        candidates: [
          {
            content: { parts: [{ text: "Streaming" }] },
          },
        ],
      })}\n\n`;

      const mockReadableStream = new ReadableStream({
        async start(controller) {
          controller.enqueue(new TextEncoder().encode(streamData));
          controller.close();
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        body: mockReadableStream,
      });

      await geminiService.generateContentStream(
        [{ role: "user" as const, parts: [{ text: "Test" }] }],
        {
          onChunk: (chunk) => {
            receivedChunks.push(chunk.text);
          },
        },
      );

      expect(receivedChunks).toContain("Streaming");
    });
  });

  describe("generateTextStream", () => {
    it("should stream text responses", async () => {
      const receivedText: string[] = [];

      const streamData = `data: ${JSON.stringify({
        candidates: [
          {
            content: { parts: [{ text: "Partial" }] },
          },
        ],
      })}\n\n`;

      const mockReadableStream = new ReadableStream({
        async start(controller) {
          controller.enqueue(new TextEncoder().encode(streamData));
          controller.close();
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        body: mockReadableStream,
      });

      await geminiService.generateTextStream("Test prompt", {
        onChunk: (text) => {
          receivedText.push(text);
        },
      });

      expect(receivedText).toContain("Partial");
    });
  });

  describe("circuit breaker", () => {
    it("should open circuit breaker after threshold failures", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const attempts = Array.from({ length: 6 }, () =>
        geminiService.generateText("Test").catch(() => null),
      );

      await Promise.all(attempts);

      const state = geminiService.getCircuitBreakerState();
      expect(state.state).toBe("open");
    });

    it("should reject requests when circuit is open", async () => {
      const service = new GeminiService({
        apiKey: "test-api-key-12345678",
        circuitBreakerThreshold: 2,
        circuitBreakerResetTimeout: 10000,
      });

      mockFetch.mockRejectedValue(new Error("Network error"));

      await service.generateText("Test").catch(() => {});
      await service.generateText("Test").catch(() => {});

      const state = service.getCircuitBreakerState();
      expect(state.state).toBe("open");

      await expect(service.generateText("Test")).rejects.toThrow(
        "Circuit breaker is OPEN",
      );
    });

    it("should allow manual reset of circuit breaker", () => {
      const service = new GeminiService({
        apiKey: "test-api-key-12345678",
      });

      service.resetCircuitBreaker();

      const state = service.getCircuitBreakerState();
      expect(state.state).toBe("closed");
    });

    it("should return circuit breaker state", () => {
      const state = geminiService.getCircuitBreakerState();

      expect(state).toHaveProperty("state");
      expect(state).toHaveProperty("metrics");
      expect(state).toHaveProperty("metrics.failureCount");
      expect(state).toHaveProperty("metrics.successCount");
    });
  });

  describe("rate limiting", () => {
    it("should return rate limiter status", () => {
      const status = geminiService.getRateLimiterStatus();

      expect(status).toHaveProperty("remainingRequests");
      expect(status).toHaveProperty("maxRequests");
      expect(status).toHaveProperty("windowMs");
    });
  });

  describe("cost tracking", () => {
    it("should track token usage", async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: "Response" }],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await geminiService.generateText("Test");

      expect(geminiService.getCostTracker()).toBe(15);
    });

    it("should allow resetting cost tracker", async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: "Response" }],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await geminiService.generateText("Test");

      geminiService.resetCostTracker();

      expect(geminiService.getCostTracker()).toBe(0);
    });
  });

  describe("health check", () => {
    it("should return healthy when service is working", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: "Hello" }],
              },
            },
          ],
        }),
      });

      const result = await geminiService.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it("should return unhealthy when service fails", async () => {
      mockFetch.mockRejectedValue(new Error("Service unavailable"));

      const result = await geminiService.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("singleton pattern", () => {
    it("should create singleton instance", () => {
      resetGeminiClient();

      const instance1 = createGeminiClient({ apiKey: "test-api-key-12345678" });
      const instance2 = createGeminiClient({ apiKey: "test-api-key-12345678" });

      expect(instance1).toBe(instance2);
    });

    it("should return existing instance", () => {
      const instance = createGeminiClient({ apiKey: "test-api-key-12345678" });
      const retrievedInstance = getGeminiClient();

      expect(retrievedInstance).toBe(instance);
    });

    it("should allow resetting instance", () => {
      createGeminiClient({ apiKey: "test-api-key-12345678" });
      resetGeminiClient();

      const instance = getGeminiClient();

      expect(instance).toBeNull();
    });
  });

  describe("timeout handling", () => {
    it("should timeout after configured duration", async () => {
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({
                  candidates: [
                    {
                      content: {
                        parts: [{ text: "Response" }],
                      },
                    },
                  ],
                }),
              });
            }, 60000);
          }),
      );

      const service = new GeminiService({
        apiKey: "test-api-key-12345678",
        timeout: 100,
      });

      await expect(service.generateText("Test")).rejects.toThrow(TimeoutError);
    });
  });

  describe("resilience integration", () => {
    it("should integrate with circuit breaker and retry", async () => {
      let attemptCount = 0;

      mockFetch.mockImplementation(() => {
        attemptCount++;

        if (attemptCount <= 2) {
          return Promise.resolve({
            ok: false,
            status: 503,
            json: async () => ({
              error: {
                message: "Service unavailable",
              },
            }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [{ text: "Success" }],
                },
              },
            ],
          }),
        });
      });

      const result = await geminiService.generateText("Test");

      expect(result).toBe("Success");
      expect(attemptCount).toBe(3);
    });
  });
});
