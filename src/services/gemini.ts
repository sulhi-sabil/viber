import { CircuitBreaker } from "../utils/circuit-breaker";
import { GeminiError, InternalError, RateLimitError } from "../utils/errors";
import { logger } from "../utils/logger";
import { Validator } from "../utils/validator";
import { RateLimiter } from "../utils/rate-limiter";
import { ResilienceConfig, RateLimitConfig } from "../types/service-config";
import {
  BaseService,
  ServiceHealth,
  ServiceResilienceConfig,
} from "./base-service";
import {
  MIN_API_KEY_LENGTH,
  HEALTH_CHECK_TIMEOUT_MS,
  STREAMING_TIMEOUT_MS,
  DEFAULT_MAX_RETRY_ATTEMPTS,
  CIRCUIT_BREAKER_DEFAULT_FAILURE_THRESHOLD,
  CIRCUIT_BREAKER_DEFAULT_RESET_TIMEOUT_MS,
  RATE_LIMITER_DEFAULT_MAX_REQUESTS,
  RATE_LIMITER_DEFAULT_WINDOW_MS,
  RETRYABLE_HTTP_STATUS_CODES,
  RETRYABLE_ERROR_CODES,
  MAX_PROMPT_LENGTH,
  MAX_OUTPUT_TOKENS,
  GEMINI_DEFAULT_TEMPERATURE,
  GEMINI_DEFAULT_TOP_K,
  GEMINI_DEFAULT_TOP_P,
  GEMINI_DEFAULT_MODEL,
  GEMINI_API_BASE_URL,
  GEMINI_API_VERSION_PATH,
  API_KEY_PREFIX_LENGTH,
  HTTP_STATUS_TOO_MANY_REQUESTS,
  HTTP_STATUS_INTERNAL_ERROR,
} from "../config/constants";

export interface GeminiConfig extends ResilienceConfig, RateLimitConfig {
  apiKey: string;
  model?: string;
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
    | "model"
  >
> = {
  timeout: STREAMING_TIMEOUT_MS,
  maxRetries: DEFAULT_MAX_RETRY_ATTEMPTS,
  circuitBreakerThreshold: CIRCUIT_BREAKER_DEFAULT_FAILURE_THRESHOLD,
  circuitBreakerResetTimeout: CIRCUIT_BREAKER_DEFAULT_RESET_TIMEOUT_MS,
  rateLimitRequests: RATE_LIMITER_DEFAULT_MAX_REQUESTS,
  rateLimitWindow: RATE_LIMITER_DEFAULT_WINDOW_MS,
  model: GEMINI_DEFAULT_MODEL,
};

export class GeminiService extends BaseService {
  protected serviceName = "Gemini";
  private apiKey: string;
  private config: Required<
    Pick<
      GeminiConfig,
      | "timeout"
      | "maxRetries"
      | "circuitBreakerThreshold"
      | "circuitBreakerResetTimeout"
      | "model"
    >
  >;
  private rateLimiter: RateLimiter;
  private costTracker: number;

  constructor(config: GeminiConfig, circuitBreaker?: CircuitBreaker) {
    if (!config.apiKey) {
      throw new InternalError("Gemini API key is required");
    }

    Validator.string(config.apiKey, "apiKey");
    Validator.minLength(config.apiKey, MIN_API_KEY_LENGTH, "apiKey");

    const failureThreshold =
      config.circuitBreakerThreshold ??
      DEFAULT_GEMINI_CONFIG.circuitBreakerThreshold;
    const resetTimeout =
      config.circuitBreakerResetTimeout ??
      DEFAULT_GEMINI_CONFIG.circuitBreakerResetTimeout;

    const cb =
      circuitBreaker ??
      BaseService.createCircuitBreaker("Gemini", {
        failureThreshold,
        resetTimeout,
      });

    super(cb);

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
      model: config.model ?? DEFAULT_GEMINI_CONFIG.model,
    };

    this.rateLimiter = new RateLimiter({
      maxRequests:
        config.rateLimitRequests ?? DEFAULT_GEMINI_CONFIG.rateLimitRequests,
      windowMs: config.rateLimitWindow ?? DEFAULT_GEMINI_CONFIG.rateLimitWindow,
      serviceName: "Gemini",
    });

    this.costTracker = 0;

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

    return this.executeWithResilience(
      async () => {
        await this.rateLimiter.checkRateLimit();

        const {
          temperature = GEMINI_DEFAULT_TEMPERATURE,
          maxOutputTokens = MAX_OUTPUT_TOKENS,
          topK = GEMINI_DEFAULT_TOP_K,
          topP = GEMINI_DEFAULT_TOP_P,
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
          `${GEMINI_API_BASE_URL}${GEMINI_API_VERSION_PATH}${this.config.model}:generateContent?key=${this.apiKey}`,
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
      },
      options,
      "Gemini generateContent",
    );
  }

  async generateContentStream(
    messages: GeminiMessage[],
    options: GeminiRequestOptions & {
      onChunk?: (chunk: StreamingChunk) => void;
    } = {},
  ): Promise<void> {
    Validator.array(messages, "messages");

    return this.executeWithResilience(
      async () => {
        await this.rateLimiter.checkRateLimit();

        const {
          temperature = GEMINI_DEFAULT_TEMPERATURE,
          maxOutputTokens = MAX_OUTPUT_TOKENS,
          topK = GEMINI_DEFAULT_TOP_K,
          topP = GEMINI_DEFAULT_TOP_P,
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
          `${GEMINI_API_BASE_URL}${GEMINI_API_VERSION_PATH}${this.config.model}:streamGenerateContent?key=${this.apiKey}`,
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

                // Safely extract text from nested arrays with validation
                const candidate = chunk.candidates?.[0];
                const text = candidate?.content?.parts?.[0]?.text || "";
                const finishReason = candidate?.finishReason;

                const streamingChunk: StreamingChunk = {
                  text,
                  finishReason,
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
      },
      options,
      "Gemini generateContentStream",
    );
  }

  async generateText(
    prompt: string,
    options: GeminiRequestOptions = {},
  ): Promise<string> {
    Validator.string(prompt, "prompt");
    Validator.minLength(prompt, 1, "prompt");
    Validator.maxLength(prompt, MAX_PROMPT_LENGTH, "prompt");

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
    Validator.maxLength(prompt, MAX_PROMPT_LENGTH, "prompt");

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

    if (response.status === HTTP_STATUS_TOO_MANY_REQUESTS) {
      const retryAfter = response.headers.get("Retry-After");
      let retryDelay: number | undefined;
      if (retryAfter) {
        const parsed = parseInt(retryAfter, 10);
        retryDelay = isNaN(parsed) ? undefined : parsed;
      }
      throw new RateLimitError("Gemini API rate limit exceeded", retryDelay);
    }

    if (response.status >= HTTP_STATUS_INTERNAL_ERROR) {
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

  protected getResilienceConfig(): ServiceResilienceConfig {
    return {
      timeout: this.config.timeout || STREAMING_TIMEOUT_MS,
      maxRetries: this.config.maxRetries,
      retryableErrors: RETRYABLE_HTTP_STATUS_CODES,
      retryableErrorCodes: RETRYABLE_ERROR_CODES,
    };
  }

  async healthCheck(): Promise<ServiceHealth> {
    return this.executeHealthCheck(async () => {
      const response = await this.generateText("Hello", {
        timeout: HEALTH_CHECK_TIMEOUT_MS,
        useCircuitBreaker: false,
        useRetry: false,
      });

      if (!response) {
        throw new GeminiError("Empty response from Gemini");
      }
    });
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

  /**
   * Get API key prefix for configuration comparison
   * @internal
   */
  getApiKeyPrefix(): string {
    return this.apiKey.length >= API_KEY_PREFIX_LENGTH ? this.apiKey.substring(0, API_KEY_PREFIX_LENGTH) : this.apiKey;
  }

  /**
   * Get current model configuration
   * @internal
   */
  getModel(): string {
    return this.config.model;
  }
}

// Import ServiceFactory for singleton management (consolidated pattern)
import { serviceFactory } from "../utils/service-factory";

let geminiInstance: GeminiService | null = null;

/**
 * Create a singleton Gemini client using ServiceFactory
 * @deprecated Use serviceFactory.createGeminiClient() for new code
 * @param config - Gemini configuration
 * @returns GeminiService instance
 */
export function createGeminiClient(config: GeminiConfig): GeminiService {
  // Use ServiceFactory for proper singleton management with health checks and metrics
  const service = serviceFactory.createGeminiClient(config);
  geminiInstance = service;
  return service;
}

/**
 * Get the current Gemini client instance
 * @deprecated Use serviceFactory.getService() for new code
 * @returns GeminiService instance or null
 */
export function getGeminiClient(): GeminiService | null {
  return geminiInstance;
}

/**
 * Reset the Gemini client instance
 * @deprecated Use serviceFactory.resetService() for new code
 */
export function resetGeminiClient(): void {
  serviceFactory.resetService("gemini");
  geminiInstance = null;
}

/**
 * Type guard to check if a service is a GeminiService
 * @param service - Service instance to check
 * @returns True if the service is a GeminiService
 */
export function isGeminiService(service: unknown): service is GeminiService {
  return service instanceof GeminiService;
}
