import { CircuitBreaker } from "../utils/circuit-breaker";
import { executeWithResilience } from "../utils/resilience";
import { GeminiError, InternalError, RateLimitError } from "../utils/errors";
import { logger } from "../utils/logger";
import { Validator } from "../utils/validator";
import { RateLimiter } from "../utils/rate-limiter";
import { ResilienceConfig, RateLimitConfig } from "../types/service-config";

export interface GeminiConfig extends ResilienceConfig, RateLimitConfig {
  apiKey: string;
}

export interface GeminiMessage {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

export interface GeminiRequestOptions {
  timeout?: number;
  useCircuitBreaker?: boolean;
  useRetry?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  topK?: number;
  topP?: number;
}

export interface GeminiResponse {
  candidates: Array<{
    content: { parts: Array<{ text: string }> };
    finishReason?: string;
    index?: number;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export interface StreamingChunk {
  text: string;
  finishReason?: string;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

const DEFAULT_GEMINI_CONFIG: Required<
  Pick<
    GeminiConfig,
    | "timeout"
    | "maxRetries"
    | "circuitBreakerThreshold"
    | "circuitBreakerResetTimeout"
    | "rateLimitRequests"
    | "rateLimitWindow"
  >
> = {
  timeout: 30000,
  maxRetries: 3,
  circuitBreakerThreshold: 5,
  circuitBreakerResetTimeout: 60000,
  rateLimitRequests: 15,
  rateLimitWindow: 60000,
};

const DEFAULT_MODEL = "gemini-1.5-flash";

export class GeminiService {
  private apiKey: string;
  private config: Required<
    Pick<
      GeminiConfig,
      | "timeout"
      | "maxRetries"
      | "circuitBreakerThreshold"
      | "circuitBreakerResetTimeout"
    >
  >;
  private circuitBreaker: CircuitBreaker;
  private rateLimiter: RateLimiter;
  private costTracker: number;

  constructor(config: GeminiConfig, circuitBreaker?: CircuitBreaker) {
    if (!config.apiKey) {
      throw new InternalError("Gemini API key is required");
    }

    Validator.string(config.apiKey, "apiKey");
    Validator.minLength(config.apiKey, 10, "apiKey");

    this.apiKey = config.apiKey;
    this.config = {
      timeout: config.timeout ?? DEFAULT_GEMINI_CONFIG.timeout,
      maxRetries: config.maxRetries ?? DEFAULT_GEMINI_CONFIG.maxRetries,
      circuitBreakerThreshold:
        config.circuitBreakerThreshold ??
        DEFAULT_GEMINI_CONFIG.circuitBreakerThreshold,
      circuitBreakerResetTimeout:
        config.circuitBreakerResetTimeout ??
        DEFAULT_GEMINI_CONFIG.circuitBreakerResetTimeout,
    };

    this.rateLimiter = new RateLimiter({
      maxRequests:
        config.rateLimitRequests ?? DEFAULT_GEMINI_CONFIG.rateLimitRequests,
      windowMs: config.rateLimitWindow ?? DEFAULT_GEMINI_CONFIG.rateLimitWindow,
      serviceName: "Gemini",
    });

    this.costTracker = 0;

    this.circuitBreaker =
      circuitBreaker ??
      new CircuitBreaker({
        failureThreshold: this.config.circuitBreakerThreshold,
        resetTimeout: this.config.circuitBreakerResetTimeout,
        onStateChange: (state, reason) => {
          logger.warn(
            `Gemini circuit breaker state changed to ${state}: ${reason}`,
          );
        },
      });

    logger.info("Gemini service initialized", {
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      rateLimitRequests: config.rateLimitRequests,
      rateLimitWindow: config.rateLimitWindow,
      usesProvidedCircuitBreaker: !!circuitBreaker,
    });
  }

  async generateContent(
    messages: GeminiMessage[],
    options: GeminiRequestOptions = {},
  ): Promise<GeminiResponse> {
    Validator.array(messages, "messages");

    return this.executeWithResilience(async () => {
      await this.rateLimiter.checkRateLimit();

      const {
        temperature = 0.7,
        maxOutputTokens = 1024,
        topK = 40,
        topP = 0.95,
      } = options;

      const requestBody = {
        contents: messages,
        generationConfig: {
          temperature,
          maxOutputTokens,
          topK,
          topP,
        },
      };

      logger.debug("Gemini generateContent request", {
        messageCount: messages.length,
        temperature,
        maxOutputTokens,
      });

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data = (await response.json()) as GeminiResponse;

      if (data.usageMetadata) {
        this.costTracker += data.usageMetadata.totalTokenCount;
        logger.debug("Gemini token usage", {
          promptTokens: data.usageMetadata.promptTokenCount,
          candidatesTokens: data.usageMetadata.candidatesTokenCount,
          totalTokens: data.usageMetadata.totalTokenCount,
        });
      }

      return data;
    }, options);
  }

  async generateContentStream(
    messages: GeminiMessage[],
    options: GeminiRequestOptions & {
      onChunk?: (chunk: StreamingChunk) => void;
    } = {},
  ): Promise<void> {
    Validator.array(messages, "messages");

    return this.executeWithResilience(async () => {
      await this.rateLimiter.checkRateLimit();

      const {
        temperature = 0.7,
        maxOutputTokens = 1024,
        topK = 40,
        topP = 0.95,
        onChunk,
      } = options;

      const requestBody = {
        contents: messages,
        generationConfig: {
          temperature,
          maxOutputTokens,
          topK,
          topP,
        },
      };

      logger.debug("Gemini generateContentStream request", {
        messageCount: messages.length,
        temperature,
        maxOutputTokens,
      });

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:streamGenerateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      if (!response.body) {
        throw new GeminiError("Response body is empty");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim().startsWith("data:")) {
            try {
              const jsonStr = line.trim().slice(5);
              const chunk = JSON.parse(jsonStr) as GeminiResponse;

              const streamingChunk: StreamingChunk = {
                text: chunk.candidates[0]?.content?.parts[0]?.text || "",
                finishReason: chunk.candidates[0]?.finishReason,
                usageMetadata: chunk.usageMetadata,
              };

              if (onChunk) {
                onChunk(streamingChunk);
              }

              if (chunk.usageMetadata) {
                this.costTracker += chunk.usageMetadata.totalTokenCount;
              }
            } catch (e) {
              logger.warn("Failed to parse streaming chunk", {
                error: e instanceof Error ? e.message : String(e),
              });
            }
          }
        }
      }

      logger.debug("Gemini streaming complete");
    }, options);
  }

  async generateText(
    prompt: string,
    options: GeminiRequestOptions = {},
  ): Promise<string> {
    Validator.string(prompt, "prompt");
    Validator.minLength(prompt, 1, "prompt");
    Validator.maxLength(prompt, 100000, "prompt");

    const messages: GeminiMessage[] = [
      { role: "user", parts: [{ text: prompt }] },
    ];
    const response = await this.generateContent(messages, options);

    const text = response.candidates[0]?.content?.parts[0]?.text;

    if (!text) {
      throw new GeminiError("No content generated");
    }

    return text;
  }

  async generateTextStream(
    prompt: string,
    options: GeminiRequestOptions & { onChunk?: (text: string) => void } = {},
  ): Promise<void> {
    Validator.string(prompt, "prompt");
    Validator.minLength(prompt, 1, "prompt");
    Validator.maxLength(prompt, 100000, "prompt");

    const messages: GeminiMessage[] = [
      { role: "user", parts: [{ text: prompt }] },
    ];

    await this.generateContentStream(messages, {
      ...options,
      onChunk: options.onChunk
        ? (chunk) => options.onChunk?.(chunk.text)
        : undefined,
    });
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    let errorMessage = "Unknown error";
    let errorDetails: Record<string, unknown> = {};

    try {
      const errorData = (await response.json()) as {
        error?: { message?: string; [key: string]: unknown };
      };
      errorMessage = errorData.error?.message || errorMessage;
      errorDetails = errorData.error || {};
    } catch {
      errorMessage = await response.text();
    }

    logger.error("Gemini API error", {
      status: response.status,
      message: errorMessage,
      details: errorDetails,
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      throw new RateLimitError(
        "Gemini API rate limit exceeded",
        retryAfter ? parseInt(retryAfter, 10) : undefined,
      );
    }

    if (response.status >= 500) {
      throw new GeminiError(`Gemini API server error: ${errorMessage}`, {
        status: response.status,
        details: errorDetails,
      });
    }

    throw new GeminiError(`Gemini API error: ${errorMessage}`, {
      status: response.status,
      details: errorDetails,
    });
  }

  private async executeWithResilience<T>(
    operation: () => Promise<T>,
    options: GeminiRequestOptions = {},
  ): Promise<T> {
    return executeWithResilience<T>({
      operation,
      options,
      defaultTimeout: this.config.timeout || 30000,
      circuitBreaker: this.circuitBreaker,
      maxRetries: this.config.maxRetries,
      retryableErrors: [408, 429, 500, 502, 503, 504],
      retryableErrorCodes: ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT"],
      onRetry: (attempt: number, error: Error) => {
        logger.warn(`Gemini operation retry attempt ${attempt}`, {
          error: error.message,
        });
      },
      timeoutOperationName: "Gemini operation",
    });
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    latency: number;
    error?: string;
  }> {
    const start = Date.now();

    try {
      await this.executeWithResilience(
        async () => {
          const response = await this.generateText("Hello", {
            timeout: 5000,
            useCircuitBreaker: false,
            useRetry: false,
          });

          if (!response) {
            throw new Error("Empty response from Gemini");
          }
        },
        { timeout: 5000, useCircuitBreaker: false, useRetry: false },
      );

      const latency = Date.now() - start;

      logger.info("Gemini health check passed", { latency });

      return {
        healthy: true,
        latency,
      };
    } catch (error) {
      const latency = Date.now() - start;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error("Gemini health check failed", {
        error: errorMessage,
        latency,
      });

      return {
        healthy: false,
        latency,
        error: errorMessage,
      };
    }
  }

  getCircuitBreakerState() {
    return {
      state: this.circuitBreaker.getState(),
      metrics: this.circuitBreaker.getMetrics(),
    };
  }

  getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }

  resetCircuitBreaker(): void {
    logger.warn("Manually resetting Gemini circuit breaker");
    this.circuitBreaker.reset();
  }

  getCostTracker(): number {
    return this.costTracker;
  }

  resetCostTracker(): void {
    this.costTracker = 0;
    logger.info("Gemini cost tracker reset");
  }

  getRateLimiterStatus() {
    return {
      remainingRequests: this.rateLimiter.getRemainingRequests(),
      maxRequests: this.rateLimiter["maxRequests"],
      windowMs: this.rateLimiter["windowMs"],
    };
  }
}

let geminiInstance: GeminiService | null = null;

export function createGeminiClient(config: GeminiConfig): GeminiService {
  if (!geminiInstance) {
    geminiInstance = new GeminiService(config);
  }

  return geminiInstance;
}

export function getGeminiClient(): GeminiService | null {
  return geminiInstance;
}

export function resetGeminiClient(): void {
  geminiInstance = null;
}
