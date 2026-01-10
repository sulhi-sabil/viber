import {
  createClient,
  SupabaseClient,
  PostgrestError,
} from "@supabase/supabase-js";
import { CircuitBreaker } from "../utils/circuit-breaker";
import { executeWithResilience } from "../utils/resilience";
import { SupabaseError, InternalError } from "../utils/errors";
import { logger } from "../utils/logger";
import { Validator } from "../utils/validator";
import { ResilienceConfig } from "../types/service-config";
import { BaseService, ServiceHealth } from "./base-service";

export interface SupabaseConfig extends ResilienceConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

export interface DatabaseRow {
  id: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface QueryOptions {
  timeout?: number;
  useCircuitBreaker?: boolean;
  useRetry?: boolean;
}

const DEFAULT_SUPABASE_CONFIG: Required<
  Pick<
    SupabaseConfig,
    | "timeout"
    | "maxRetries"
    | "circuitBreakerThreshold"
    | "circuitBreakerResetTimeout"
  >
> = {
  timeout: 10000,
  maxRetries: 3,
  circuitBreakerThreshold: 5,
  circuitBreakerResetTimeout: 60000,
};

export class SupabaseService extends BaseService {
  protected serviceName = "Supabase";
  public client: SupabaseClient;
  public adminClient: SupabaseClient | null = null;
  protected circuitBreaker: CircuitBreaker;
  private config: SupabaseConfig;

  constructor(config: SupabaseConfig, circuitBreaker?: CircuitBreaker) {
    Validator.url(config.url, "Supabase URL");
    Validator.string(config.anonKey, "anonKey");

    if (config.serviceRoleKey) {
      Validator.string(config.serviceRoleKey, "serviceRoleKey");
    }

    const failureThreshold =
      config.circuitBreakerThreshold ??
      DEFAULT_SUPABASE_CONFIG.circuitBreakerThreshold;
    const resetTimeout =
      config.circuitBreakerResetTimeout ??
      DEFAULT_SUPABASE_CONFIG.circuitBreakerResetTimeout;

    const cb =
      circuitBreaker ??
      new CircuitBreaker({
        failureThreshold,
        resetTimeout,
        onStateChange: (state, reason) => {
          logger.warn(
            `Supabase circuit breaker state changed to ${state}: ${reason}`,
          );
        },
      });

    super(cb);
    this.circuitBreaker = cb;

    this.config = { ...DEFAULT_SUPABASE_CONFIG, ...config };

    this.client = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      db: {
        schema: "public",
      },
      global: {
        headers: {
          "x-client-info": "viber-integration-layer",
        },
      },
    });

    if (config.serviceRoleKey) {
      this.adminClient = createClient(config.url, config.serviceRoleKey, {
        db: {
          schema: "public",
        },
        global: {
          headers: {
            "x-client-info": "viber-integration-layer-admin",
          },
        },
      });
    }

    logger.info("Supabase service initialized", {
      url: config.url.replace(/\/$/, ""),
      hasAdminClient: !!config.serviceRoleKey,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      usesProvidedCircuitBreaker: !!circuitBreaker,
    });
  }

  private handleSupabaseError(error: PostgrestError | Error | unknown): never {
    if (this.isPostgrestError(error)) {
      logger.error("Supabase error", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });

      throw new SupabaseError(error.message, {
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
    }

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error("Unexpected Supabase error", { error: errorMessage });

    throw new InternalError(`Supabase operation failed: ${errorMessage}`, {
      originalError: errorMessage,
    });
  }

  private isPostgrestError(error: unknown): error is PostgrestError {
    return (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      "code" in error
    );
  }

  private async executeWithResilience<T>(
    operation: () => Promise<T>,
    options: QueryOptions = {},
  ): Promise<T> {
    return executeWithResilience<T>({
      operation,
      options,
      defaultTimeout: this.config.timeout || 10000,
      circuitBreaker: this.circuitBreaker,
      maxRetries: this.config.maxRetries,
      retryableErrors: [408, 429, 500, 502, 503, 504],
      retryableErrorCodes: ["PGRST116", "PGRST301"],
      onRetry: (attempt: number, error: Error) => {
        logger.warn(`Supabase operation retry attempt ${attempt}`, {
          error: error.message,
        });
      },
      timeoutOperationName: "Supabase operation",
    });
  }

  async select<T extends DatabaseRow>(
    table: string,
    options: {
      columns?: string;
      filter?: { column: string; operator: string; value: unknown };
      orderBy?: { column: string; ascending?: boolean };
      limit?: number;
      offset?: number;
      includeDeleted?: boolean;
    } = {},
    queryOptions: QueryOptions = {},
  ): Promise<T[]> {
    const {
      columns = "*",
      filter,
      orderBy,
      limit,
      offset,
      includeDeleted = false,
    } = options;

    Validator.string(table, "table");

    return this.executeWithResilience(async () => {
      let query = this.client.from(table).select(columns);

      if (filter) {
        query = query.filter(filter.column, filter.operator, filter.value);
      }

      if (!includeDeleted) {
        query = query.eq("deleted_at", null);
      }

      if (orderBy) {
        query = query.order(orderBy.column, {
          ascending: orderBy.ascending ?? true,
        });
      }

      if (limit) {
        query = query.limit(limit);
      }

      if (offset) {
        query = query.range(offset, offset + (limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) {
        this.handleSupabaseError(error);
      }

      return (data as unknown as T[]) || [];
    }, queryOptions);
  }

  async selectById<T extends DatabaseRow>(
    table: string,
    id: string,
    columns: string = "*",
    includeDeleted: boolean = false,
    queryOptions: QueryOptions = {},
  ): Promise<T | null> {
    Validator.string(table, "table");
    Validator.string(id, "id");

    return this.executeWithResilience(async () => {
      let query = this.client.from(table).select(columns).eq("id", id);

      if (!includeDeleted) {
        query = query.eq("deleted_at", null);
      }

      const { data, error } = await query.single();

      if (error) {
        if (error.code === "PGRST116") {
          return null;
        }
        this.handleSupabaseError(error);
      }

      return data as unknown as T;
    }, queryOptions);
  }

  async insert<T extends DatabaseRow>(
    table: string,
    row: Partial<T>,
    queryOptions: QueryOptions = {},
  ): Promise<T> {
    Validator.string(table, "table");
    Validator.required(row, "row");

    return this.executeWithResilience(async () => {
      const { data, error } = await this.client
        .from(table)
        .insert(row)
        .select()
        .single();

      if (error) {
        this.handleSupabaseError(error);
      }

      return data as unknown as T;
    }, queryOptions);
  }

  async insertMany<T extends DatabaseRow>(
    table: string,
    rows: Partial<T>[],
    queryOptions: QueryOptions = {},
  ): Promise<T[]> {
    return this.executeWithResilience(async () => {
      const { data, error } = await this.client
        .from(table)
        .insert(rows)
        .select();

      if (error) {
        this.handleSupabaseError(error);
      }

      return (data as unknown as T[]) || [];
    }, queryOptions);
  }

  async update<T extends DatabaseRow>(
    table: string,
    id: string,
    updates: Partial<T>,
    queryOptions: QueryOptions = {},
  ): Promise<T> {
    Validator.string(table, "table");
    Validator.string(id, "id");
    Validator.required(updates, "updates");

    return this.executeWithResilience(async () => {
      const { data, error } = await this.client
        .from(table)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        this.handleSupabaseError(error);
      }

      return data as unknown as T;
    }, queryOptions);
  }

  async delete(
    table: string,
    id: string,
    softDelete: boolean = true,
    queryOptions: QueryOptions = {},
  ): Promise<void> {
    return this.executeWithResilience(async () => {
      if (softDelete) {
        const { error } = await this.client
          .from(table)
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", id);

        if (error) {
          this.handleSupabaseError(error);
        }
      } else {
        const { error } = await this.client.from(table).delete().eq("id", id);

        if (error) {
          this.handleSupabaseError(error);
        }
      }

      return;
    }, queryOptions);
  }

  async upsert<T extends DatabaseRow>(
    table: string,
    row: Partial<T>,
    queryOptions: QueryOptions = {},
  ): Promise<T> {
    return this.executeWithResilience(async () => {
      const { data, error } = await this.client
        .from(table)
        .upsert(row, { onConflict: "id" })
        .select()
        .single();

      if (error) {
        this.handleSupabaseError(error);
      }

      return data as unknown as T;
    }, queryOptions);
  }

  async restore(
    table: string,
    id: string,
    queryOptions: QueryOptions = {},
  ): Promise<void> {
    return this.executeWithResilience(async () => {
      const { error } = await this.client
        .from(table)
        .update({ deleted_at: null })
        .eq("id", id);

      if (error) {
        this.handleSupabaseError(error);
      }

      return;
    }, queryOptions);
  }

  async permanentDelete(
    table: string,
    id: string,
    queryOptions: QueryOptions = {},
  ): Promise<void> {
    return this.executeWithResilience(async () => {
      const { error } = await this.client.from(table).delete().eq("id", id);

      if (error) {
        this.handleSupabaseError(error);
      }

      return;
    }, queryOptions);
  }

  async raw<T = unknown>(
    query: string,
    params: unknown[] = [],
    queryOptions: QueryOptions = {},
  ): Promise<T[]> {
    return this.executeWithResilience(async () => {
      const { data, error } = await this.client.rpc("exec_sql", {
        query,
        params,
      });

      if (error) {
        this.handleSupabaseError(error);
      }

      return (data as unknown as T[]) || [];
    }, queryOptions);
  }

  async healthCheck(): Promise<ServiceHealth> {
    return this.executeHealthCheck(async () => {
      const { error } = await this.client.from("users").select("id").limit(1);

      if (error && error.code !== "PGRST116") {
        throw error;
      }
    });
  }
}

let supabaseInstance: SupabaseService | null = null;

export function createSupabaseClient(config: SupabaseConfig): SupabaseService {
  if (!supabaseInstance) {
    supabaseInstance = new SupabaseService(config);
  }

  return supabaseInstance;
}

export function getSupabaseClient(): SupabaseService | null {
  return supabaseInstance;
}

export function resetSupabaseClient(): void {
  supabaseInstance = null;
}
