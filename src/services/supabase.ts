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

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
  timeout?: number;
  maxRetries?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerResetTimeout?: number;
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

const DEFAULT_CONFIG: Required<
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

export class SupabaseService {
  public client: SupabaseClient;
  public adminClient: SupabaseClient | null = null;
  private circuitBreaker: CircuitBreaker;
  private config: SupabaseConfig;

  constructor(config: SupabaseConfig, circuitBreaker?: CircuitBreaker) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    Validator.url(config.url, "Supabase URL");
    Validator.string(config.anonKey, "anonKey");

    if (config.serviceRoleKey) {
      Validator.string(config.serviceRoleKey, "serviceRoleKey");
    }

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

    this.circuitBreaker =
      circuitBreaker ??
      new CircuitBreaker({
        failureThreshold: this.config.circuitBreakerThreshold,
        resetTimeout: this.config.circuitBreakerResetTimeout,
        onStateChange: (state, reason) => {
          logger.warn(
            `Supabase circuit breaker state changed to ${state}: ${reason}`,
          );
        },
      });

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
    } = {},
    queryOptions: QueryOptions = {},
  ): Promise<T[]> {
    const { columns = "*", filter, orderBy, limit, offset } = options;

    Validator.string(table, "table");

    return this.executeWithResilience(async () => {
      let query = this.client.from(table).select(columns);

      if (filter) {
        query = query.filter(filter.column, filter.operator, filter.value);
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
    queryOptions: QueryOptions = {},
  ): Promise<T | null> {
    Validator.string(table, "table");
    Validator.string(id, "id");

    return this.executeWithResilience(async () => {
      const { data, error } = await this.client
        .from(table)
        .select(columns)
        .eq("id", id)
        .single();

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

  async healthCheck(): Promise<{
    healthy: boolean;
    latency: number;
    error?: string;
  }> {
    const start = Date.now();

    try {
      await this.executeWithResilience(
        async () => {
          const { error } = await this.client
            .from("users")
            .select("id")
            .limit(1);
          if (error && error.code !== "PGRST116") {
            throw error;
          }
        },
        { timeout: 5000, useCircuitBreaker: false, useRetry: false },
      );

      const latency = Date.now() - start;

      logger.info("Supabase health check passed", { latency });

      return {
        healthy: true,
        latency,
      };
    } catch (error) {
      const latency = Date.now() - start;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error("Supabase health check failed", {
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
    logger.warn("Manually resetting Supabase circuit breaker");
    this.circuitBreaker.reset();
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
