import { CircuitBreaker } from "../utils/circuit-breaker";
import {
  CloudflareError,
  InternalError,
  RateLimitError,
} from "../utils/errors";
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
  DEFAULT_MAX_RETRY_ATTEMPTS,
  CIRCUIT_BREAKER_DEFAULT_FAILURE_THRESHOLD,
  CIRCUIT_BREAKER_DEFAULT_RESET_TIMEOUT_MS,
  RETRYABLE_HTTP_STATUS_CODES,
  RETRYABLE_ERROR_CODES,
  CLOUDFLARE_API_BASE_URL,
  CLOUDFLARE_DEFAULT_TIMEOUT_MS,
  CLOUDFLARE_RATE_LIMIT_PER_WINDOW,
} from "../config/constants";

// ============================================================================
// Configuration Types
// ============================================================================

export interface CloudflareConfig extends ResilienceConfig, RateLimitConfig {
  apiToken: string;
  zoneId?: string;
}

export interface CloudflareRequestOptions {
  timeout?: number;
  useCircuitBreaker?: boolean;
  useRetry?: boolean;
}

// ============================================================================
// DNS Record Types
// ============================================================================

export interface CloudflareDnsRecord {
  id: string;
  zone_id: string;
  zone_name: string;
  name: string;
  type: string;
  content: string;
  proxiable: boolean;
  proxied: boolean;
  ttl: number;
  locked: boolean;
  meta: Record<string, unknown>;
  comment?: string;
  tags?: string[];
  created_on: string;
  modified_on: string;
}

export interface CreateDnsRecordRequest {
  type: string;
  name: string;
  content: string;
  ttl?: number;
  priority?: number;
  proxied?: boolean;
  comment?: string;
  tags?: string[];
}

export interface UpdateDnsRecordRequest {
  type?: string;
  name?: string;
  content?: string;
  ttl?: number;
  priority?: number;
  proxied?: boolean;
  comment?: string;
  tags?: string[];
}

// ============================================================================
// Zone Types
// ============================================================================

export interface CloudflareZone {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  type: string;
  development_mode: number;
  name_servers: string[];
  original_name_servers: string[];
  original_registrar: string | null;
  original_dnshost: string | null;
  modified_on: string;
  created_on: string;
  activated_on: string;
  meta: {
    step: number;
    wildcard_proxied: boolean;
    custom_certificate_quota: number;
    page_rule_quota: number;
    vanity_name_servers: string[];
  };
  owner: {
    id: string;
    type: string;
  };
  account: {
    id: string;
    name: string;
  };
  tenant: {
    id: string;
    name: string;
  } | null;
  tenant_unit: {
    id: string;
  } | null;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface CloudflareListResponse<T> {
  result: T[];
  result_info?: {
    page: number;
    per_page: number;
    total_count: number;
    total_pages: number;
  };
  success: boolean;
  errors: string[];
  messages: string[];
}

export interface CloudflareSingleResponse<T> {
  result: T;
  success: boolean;
  errors: string[];
  messages: string[];
}

export interface CloudflareErrorResponse {
  success: false;
  errors: Array<{
    code: number;
    message: string;
    documentation_url?: string;
  }>;
  messages: string[];
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CLOUDFLARE_CONFIG: Required<
  Pick<
    CloudflareConfig,
    | "timeout"
    | "maxRetries"
    | "circuitBreakerThreshold"
    | "circuitBreakerResetTimeout"
    | "rateLimitRequests"
    | "rateLimitWindow"
  >
> = {
  timeout: CLOUDFLARE_DEFAULT_TIMEOUT_MS,
  maxRetries: DEFAULT_MAX_RETRY_ATTEMPTS,
  circuitBreakerThreshold: CIRCUIT_BREAKER_DEFAULT_FAILURE_THRESHOLD,
  circuitBreakerResetTimeout: CIRCUIT_BREAKER_DEFAULT_RESET_TIMEOUT_MS,
  rateLimitRequests: CLOUDFLARE_RATE_LIMIT_PER_WINDOW,
  rateLimitWindow: 5 * 60 * 1000, // 5 minutes in ms
};

// ============================================================================
// CloudflareService Class
// ============================================================================

export class CloudflareService extends BaseService {
  protected serviceName = "Cloudflare";
  private apiToken: string;
  private defaultZoneId?: string;
  private config: Required<
    Pick<
      CloudflareConfig,
      | "timeout"
      | "maxRetries"
      | "circuitBreakerThreshold"
      | "circuitBreakerResetTimeout"
    >
  >;
  private rateLimiter: RateLimiter;

  constructor(config: CloudflareConfig, circuitBreaker?: CircuitBreaker) {
    if (!config.apiToken) {
      throw new InternalError("Cloudflare API token is required");
    }

    Validator.string(config.apiToken, "apiToken");
    Validator.minLength(config.apiToken, MIN_API_KEY_LENGTH, "apiToken");

    const failureThreshold =
      config.circuitBreakerThreshold ??
      DEFAULT_CLOUDFLARE_CONFIG.circuitBreakerThreshold;
    const resetTimeout =
      config.circuitBreakerResetTimeout ??
      DEFAULT_CLOUDFLARE_CONFIG.circuitBreakerResetTimeout;

    const cb =
      circuitBreaker ??
      BaseService.createCircuitBreaker("Cloudflare", {
        failureThreshold,
        resetTimeout,
      });

    super(cb);

    this.apiToken = config.apiToken;
    this.defaultZoneId = config.zoneId;
    this.config = {
      timeout: config.timeout ?? DEFAULT_CLOUDFLARE_CONFIG.timeout,
      maxRetries: config.maxRetries ?? DEFAULT_CLOUDFLARE_CONFIG.maxRetries,
      circuitBreakerThreshold:
        config.circuitBreakerThreshold ??
        DEFAULT_CLOUDFLARE_CONFIG.circuitBreakerThreshold,
      circuitBreakerResetTimeout:
        config.circuitBreakerResetTimeout ??
        DEFAULT_CLOUDFLARE_CONFIG.circuitBreakerResetTimeout,
    };

    this.rateLimiter = new RateLimiter({
      maxRequests:
        config.rateLimitRequests ?? DEFAULT_CLOUDFLARE_CONFIG.rateLimitRequests,
      windowMs:
        config.rateLimitWindow ?? DEFAULT_CLOUDFLARE_CONFIG.rateLimitWindow,
      serviceName: "Cloudflare",
    });

    logger.info("Cloudflare service initialized", {
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      rateLimitRequests: config.rateLimitRequests,
      rateLimitWindow: config.rateLimitWindow,
      hasDefaultZoneId: !!this.defaultZoneId,
      usesProvidedCircuitBreaker: !!circuitBreaker,
    });
  }

  // ==========================================================================
  // DNS Record Operations
  // ==========================================================================

  /**
   * List DNS records for a zone
   */
  async listDnsRecords(
    zoneId?: string,
    options: CloudflareRequestOptions = {},
  ): Promise<CloudflareDnsRecord[]> {
    const targetZoneId = zoneId ?? this.defaultZoneId;
    if (!targetZoneId) {
      throw new InternalError("Zone ID is required for DNS operations");
    }

    return this.executeWithResilience(
      async () => {
        await this.rateLimiter.checkRateLimit();

        logger.debug("Cloudflare listDnsRecords request", {
          zoneId: targetZoneId,
        });

        const response = await fetch(
          `${CLOUDFLARE_API_BASE_URL}/zones/${targetZoneId}/dns_records`,
          {
            method: "GET",
            headers: this.getHeaders(),
          },
        );

        if (!response.ok) {
          await this.handleErrorResponse(response);
        }

        const data =
          (await response.json()) as CloudflareListResponse<CloudflareDnsRecord>;

        logger.debug("Cloudflare listDnsRecords response", {
          count: data.result.length,
        });

        return data.result;
      },
      options,
      "Cloudflare listDnsRecords",
    );
  }

  /**
   * Get a specific DNS record
   */
  async getDnsRecord(
    recordId: string,
    zoneId?: string,
    options: CloudflareRequestOptions = {},
  ): Promise<CloudflareDnsRecord> {
    Validator.string(recordId, "recordId");

    const targetZoneId = zoneId ?? this.defaultZoneId;
    if (!targetZoneId) {
      throw new InternalError("Zone ID is required for DNS operations");
    }

    return this.executeWithResilience(
      async () => {
        await this.rateLimiter.checkRateLimit();

        logger.debug("Cloudflare getDnsRecord request", {
          zoneId: targetZoneId,
          recordId,
        });

        const response = await fetch(
          `${CLOUDFLARE_API_BASE_URL}/zones/${targetZoneId}/dns_records/${recordId}`,
          {
            method: "GET",
            headers: this.getHeaders(),
          },
        );

        if (!response.ok) {
          await this.handleErrorResponse(response);
        }

        const data =
          (await response.json()) as CloudflareSingleResponse<CloudflareDnsRecord>;

        return data.result;
      },
      options,
      "Cloudflare getDnsRecord",
    );
  }

  /**
   * Create a new DNS record
   */
  async createDnsRecord(
    data: CreateDnsRecordRequest,
    zoneId?: string,
    options: CloudflareRequestOptions = {},
  ): Promise<CloudflareDnsRecord> {
    Validator.string(data.type, "type");
    Validator.string(data.name, "name");
    Validator.string(data.content, "content");

    const targetZoneId = zoneId ?? this.defaultZoneId;
    if (!targetZoneId) {
      throw new InternalError("Zone ID is required for DNS operations");
    }

    return this.executeWithResilience(
      async () => {
        await this.rateLimiter.checkRateLimit();

        logger.debug("Cloudflare createDnsRecord request", {
          zoneId: targetZoneId,
          type: data.type,
          name: data.name,
        });

        const response = await fetch(
          `${CLOUDFLARE_API_BASE_URL}/zones/${targetZoneId}/dns_records`,
          {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify(data),
          },
        );

        if (!response.ok) {
          await this.handleErrorResponse(response);
        }

        const result =
          (await response.json()) as CloudflareSingleResponse<CloudflareDnsRecord>;

        logger.info("Cloudflare DNS record created", {
          recordId: result.result.id,
          name: result.result.name,
          type: result.result.type,
        });

        return result.result;
      },
      options,
      "Cloudflare createDnsRecord",
    );
  }

  /**
   * Update an existing DNS record
   */
  async updateDnsRecord(
    recordId: string,
    data: UpdateDnsRecordRequest,
    zoneId?: string,
    options: CloudflareRequestOptions = {},
  ): Promise<CloudflareDnsRecord> {
    Validator.string(recordId, "recordId");

    const targetZoneId = zoneId ?? this.defaultZoneId;
    if (!targetZoneId) {
      throw new InternalError("Zone ID is required for DNS operations");
    }

    return this.executeWithResilience(
      async () => {
        await this.rateLimiter.checkRateLimit();

        logger.debug("Cloudflare updateDnsRecord request", {
          zoneId: targetZoneId,
          recordId,
        });

        const response = await fetch(
          `${CLOUDFLARE_API_BASE_URL}/zones/${targetZoneId}/dns_records/${recordId}`,
          {
            method: "PATCH",
            headers: this.getHeaders(),
            body: JSON.stringify(data),
          },
        );

        if (!response.ok) {
          await this.handleErrorResponse(response);
        }

        const result =
          (await response.json()) as CloudflareSingleResponse<CloudflareDnsRecord>;

        logger.info("Cloudflare DNS record updated", {
          recordId: result.result.id,
          name: result.result.name,
        });

        return result.result;
      },
      options,
      "Cloudflare updateDnsRecord",
    );
  }

  /**
   * Delete a DNS record
   */
  async deleteDnsRecord(
    recordId: string,
    zoneId?: string,
    options: CloudflareRequestOptions = {},
  ): Promise<void> {
    Validator.string(recordId, "recordId");

    const targetZoneId = zoneId ?? this.defaultZoneId;
    if (!targetZoneId) {
      throw new InternalError("Zone ID is required for DNS operations");
    }

    return this.executeWithResilience(
      async () => {
        await this.rateLimiter.checkRateLimit();

        logger.debug("Cloudflare deleteDnsRecord request", {
          zoneId: targetZoneId,
          recordId,
        });

        const response = await fetch(
          `${CLOUDFLARE_API_BASE_URL}/zones/${targetZoneId}/dns_records/${recordId}`,
          {
            method: "DELETE",
            headers: this.getHeaders(),
          },
        );

        if (!response.ok) {
          await this.handleErrorResponse(response);
        }

        logger.info("Cloudflare DNS record deleted", { recordId });
      },
      options,
      "Cloudflare deleteDnsRecord",
    );
  }

  // ==========================================================================
  // Zone Operations
  // ==========================================================================

  /**
   * List all zones
   */
  async listZones(
    options: CloudflareRequestOptions = {},
  ): Promise<CloudflareZone[]> {
    return this.executeWithResilience(
      async () => {
        await this.rateLimiter.checkRateLimit();

        logger.debug("Cloudflare listZones request");

        const response = await fetch(`${CLOUDFLARE_API_BASE_URL}/zones`, {
          method: "GET",
          headers: this.getHeaders(),
        });

        if (!response.ok) {
          await this.handleErrorResponse(response);
        }

        const data =
          (await response.json()) as CloudflareListResponse<CloudflareZone>;

        logger.debug("Cloudflare listZones response", {
          count: data.result.length,
        });

        return data.result;
      },
      options,
      "Cloudflare listZones",
    );
  }

  /**
   * Get a specific zone by ID
   */
  async getZone(
    zoneId: string,
    options: CloudflareRequestOptions = {},
  ): Promise<CloudflareZone> {
    Validator.string(zoneId, "zoneId");

    return this.executeWithResilience(
      async () => {
        await this.rateLimiter.checkRateLimit();

        logger.debug("Cloudflare getZone request", { zoneId });

        const response = await fetch(
          `${CLOUDFLARE_API_BASE_URL}/zones/${zoneId}`,
          {
            method: "GET",
            headers: this.getHeaders(),
          },
        );

        if (!response.ok) {
          await this.handleErrorResponse(response);
        }

        const data =
          (await response.json()) as CloudflareSingleResponse<CloudflareZone>;

        return data.result;
      },
      options,
      "Cloudflare getZone",
    );
  }

  // ==========================================================================
  // Health Check
  // ==========================================================================

  async healthCheck(): Promise<ServiceHealth> {
    return this.executeHealthCheck(async () => {
      // Use listZones as a lightweight health check
      const zones = await this.listZones({
        timeout: HEALTH_CHECK_TIMEOUT_MS,
        useCircuitBreaker: false,
        useRetry: false,
      });

      if (!Array.isArray(zones)) {
        throw new CloudflareError("Invalid response from Cloudflare API");
      }
    });
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get common headers for Cloudflare API requests
   */
  private getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiToken}`,
    };
  }

  /**
   * Handle error responses from Cloudflare API
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorMessage = "Unknown error";
    let errorDetails: Record<string, unknown> = {};

    try {
      const errorData = (await response.json()) as CloudflareErrorResponse;
      errorMessage = errorData.errors?.[0]?.message || errorMessage;
      errorDetails = {
        errors: errorData.errors,
      };
    } catch {
      errorMessage = await response.text();
    }

    logger.error("Cloudflare API error", {
      status: response.status,
      message: errorMessage,
      details: errorDetails,
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      let retryDelay: number | undefined;
      if (retryAfter) {
        const parsed = parseInt(retryAfter, 10);
        retryDelay = isNaN(parsed) ? undefined : parsed;
      }
      throw new RateLimitError(
        "Cloudflare API rate limit exceeded",
        retryDelay,
      );
    }

    if (response.status === 403) {
      throw new CloudflareError(
        `Cloudflare API authentication failed: ${errorMessage}`,
        { status: response.status, details: errorDetails },
      );
    }

    if (response.status >= 500) {
      throw new CloudflareError(
        `Cloudflare API server error: ${errorMessage}`,
        { status: response.status, details: errorDetails },
      );
    }

    throw new CloudflareError(`Cloudflare API error: ${errorMessage}`, {
      status: response.status,
      details: errorDetails,
    });
  }

  /**
   * Get resilience configuration
   */
  protected getResilienceConfig(): ServiceResilienceConfig {
    return {
      timeout: this.config.timeout || CLOUDFLARE_DEFAULT_TIMEOUT_MS,
      maxRetries: this.config.maxRetries,
      retryableErrors: RETRYABLE_HTTP_STATUS_CODES,
      retryableErrorCodes: RETRYABLE_ERROR_CODES,
    };
  }

  /**
   * Get rate limiter status
   */
  getRateLimiterStatus() {
    return {
      remainingRequests: this.rateLimiter.getRemainingRequests(),
      maxRequests: this.rateLimiter["maxRequests"],
      windowMs: this.rateLimiter["windowMs"],
    };
  }

  /**
   * Get API token prefix for configuration comparison
   * @internal
   */
  getApiTokenPrefix(): string {
    return this.apiToken.length >= 8
      ? this.apiToken.substring(0, 8)
      : this.apiToken;
  }

  /**
   * Get default zone ID
   * @internal
   */
  getDefaultZoneId(): string | undefined {
    return this.defaultZoneId;
  }
}

// ============================================================================
// Singleton Management (Deprecated - Use ServiceFactory)
// ============================================================================

import { serviceFactory } from "../utils/service-factory";

let cloudflareInstance: CloudflareService | null = null;

/**
 * Create a singleton Cloudflare client using ServiceFactory
 * @deprecated Use serviceFactory.createCloudflareClient() for new code
 * @param config - Cloudflare configuration
 * @returns CloudflareService instance
 */
export function createCloudflareClient(
  config: CloudflareConfig,
): CloudflareService {
  const service = serviceFactory.createCloudflareClient(config);
  cloudflareInstance = service;
  return service;
}

/**
 * Get the current Cloudflare client instance
 * @deprecated Use serviceFactory.getService() for new code
 * @returns CloudflareService instance or null
 */
export function getCloudflareClient(): CloudflareService | null {
  return cloudflareInstance;
}

/**
 * Reset the Cloudflare client instance
 * @deprecated Use serviceFactory.resetService() for new code
 */
export function resetCloudflareClient(): void {
  serviceFactory.resetService("cloudflare");
  cloudflareInstance = null;
}

/**
 * Type guard to check if a service is a CloudflareService
 * @param service - Service instance to check
 * @returns True if the service is a CloudflareService
 */
export function isCloudflareService(
  service: unknown,
): service is CloudflareService {
  return service instanceof CloudflareService;
}
