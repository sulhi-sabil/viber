import { createClient, SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { CircuitBreaker } from '../utils/circuit-breaker';
import { SupabaseError, InternalError } from '../utils/errors';
import { logger } from '../utils/logger';
import { Validator } from '../utils/validator';
import { ResilienceConfig } from '../types/service-config';
import { BaseService, ServiceHealth, ServiceResilienceConfig } from './base-service';
import {
  RETRYABLE_HTTP_STATUS_CODES,
  RETRYABLE_ERROR_CODES,
  DEFAULT_PAGINATION_LIMIT,
  DEFAULT_OPERATION_TIMEOUT_MS,
  DEFAULT_MAX_RETRY_ATTEMPTS,
  CIRCUIT_BREAKER_DEFAULT_FAILURE_THRESHOLD,
  CIRCUIT_BREAKER_DEFAULT_RESET_TIMEOUT_MS,
  HEALTH_CHECK_QUERY_LIMIT,
  API_KEY_PREFIX_LENGTH,
} from '../config/constants';

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
    'timeout' | 'maxRetries' | 'circuitBreakerThreshold' | 'circuitBreakerResetTimeout'
  >
> = {
  timeout: DEFAULT_OPERATION_TIMEOUT_MS,
  maxRetries: DEFAULT_MAX_RETRY_ATTEMPTS,
  circuitBreakerThreshold: CIRCUIT_BREAKER_DEFAULT_FAILURE_THRESHOLD,
  circuitBreakerResetTimeout: CIRCUIT_BREAKER_DEFAULT_RESET_TIMEOUT_MS,
};

export class SupabaseService extends BaseService {
  protected serviceName = 'Supabase';
  public client: SupabaseClient;
  public adminClient: SupabaseClient | null = null;
  private config: SupabaseConfig;

  constructor(config: SupabaseConfig, circuitBreaker?: CircuitBreaker) {
    Validator.url(config.url, 'Supabase URL');
    Validator.string(config.anonKey, 'anonKey');

    if (config.serviceRoleKey) {
      Validator.string(config.serviceRoleKey, 'serviceRoleKey');
    }

    const failureThreshold =
      config.circuitBreakerThreshold ?? DEFAULT_SUPABASE_CONFIG.circuitBreakerThreshold;
    const resetTimeout =
      config.circuitBreakerResetTimeout ?? DEFAULT_SUPABASE_CONFIG.circuitBreakerResetTimeout;

    const cb =
      circuitBreaker ??
      BaseService.createCircuitBreaker('Supabase', {
        failureThreshold,
        resetTimeout,
      });

    super(cb);

    this.config = { ...DEFAULT_SUPABASE_CONFIG, ...config };

    this.client = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'x-client-info': 'viber-integration-layer',
        },
      },
    });

    if (config.serviceRoleKey) {
      this.adminClient = createClient(config.url, config.serviceRoleKey, {
        db: {
          schema: 'public',
        },
        global: {
          headers: {
            'x-client-info': 'viber-integration-layer-admin',
          },
        },
      });
    }

    logger.info('Supabase service initialized', {
      url: config.url.replace(/\/$/, ''),
      hasAdminClient: !!config.serviceRoleKey,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      usesProvidedCircuitBreaker: !!circuitBreaker,
    });
  }

  private handleSupabaseError(error: PostgrestError | Error | unknown): never {
    if (this.isPostgrestError(error)) {
      logger.error('Supabase error', {
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

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Unexpected Supabase error', { error: errorMessage });

    throw new InternalError(`Supabase operation failed: ${errorMessage}`, {
      originalError: errorMessage,
    });
  }

  private isPostgrestError(error: unknown): error is PostgrestError {
    return typeof error === 'object' && error !== null && 'message' in error && 'code' in error;
  }

  protected getResilienceConfig(): ServiceResilienceConfig {
    return {
      timeout: this.config.timeout || DEFAULT_OPERATION_TIMEOUT_MS,
      maxRetries: this.config.maxRetries || DEFAULT_MAX_RETRY_ATTEMPTS,
      retryableErrors: RETRYABLE_HTTP_STATUS_CODES,
      retryableErrorCodes: ['PGRST116', 'PGRST301', ...RETRYABLE_ERROR_CODES],
    };
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
    queryOptions: QueryOptions = {}
  ): Promise<T[]> {
    const { columns = '*', filter, orderBy, limit, offset, includeDeleted = false } = options;

    Validator.string(table, 'table');

    return this.executeWithResilience(
      async () => {
        let query = this.client.from(table).select(columns);

        if (filter) {
          query = query.filter(filter.column, filter.operator, filter.value);
        }

        if (!includeDeleted) {
          query = query.eq('deleted_at', null);
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
          query = query.range(offset, offset + (limit || DEFAULT_PAGINATION_LIMIT) - 1);
        }

        const { data, error } = await query;

        if (error) {
          this.handleSupabaseError(error);
        }

        return (data as unknown as T[]) || [];
      },
      queryOptions,
      `select from ${table}`
    );
  }

  async selectById<T extends DatabaseRow>(
    table: string,
    id: string,
    columns: string = '*',
    includeDeleted: boolean = false,
    queryOptions: QueryOptions = {}
  ): Promise<T | null> {
    Validator.string(table, 'table');
    Validator.string(id, 'id');

    return this.executeWithResilience(
      async () => {
        let query = this.client.from(table).select(columns).eq('id', id);

        if (!includeDeleted) {
          query = query.eq('deleted_at', null);
        }

        const { data, error } = await query.single();

        if (error) {
          if (error.code === 'PGRST116') {
            return null;
          }
          this.handleSupabaseError(error);
        }

        return data as unknown as T;
      },
      queryOptions,
      `selectById ${table}:${id}`
    );
  }

  async insert<T extends DatabaseRow>(
    table: string,
    row: Partial<T>,
    queryOptions: QueryOptions = {}
  ): Promise<T> {
    Validator.string(table, 'table');
    Validator.required(row, 'row');

    return this.executeWithResilience(
      async () => {
        const { data, error } = await this.client.from(table).insert(row).select().single();

        if (error) {
          this.handleSupabaseError(error);
        }

        return data as unknown as T;
      },
      queryOptions,
      `Supabase insert into ${table}`
    );
  }

  async insertMany<T extends DatabaseRow>(
    table: string,
    rows: Partial<T>[],
    queryOptions: QueryOptions = {}
  ): Promise<T[]> {
    return this.executeWithResilience(
      async () => {
        const { data, error } = await this.client.from(table).insert(rows).select();

        if (error) {
          this.handleSupabaseError(error);
        }

        return (data as unknown as T[]) || [];
      },
      queryOptions,
      `Supabase insertMany into ${table}`
    );
  }

  async update<T extends DatabaseRow>(
    table: string,
    id: string,
    updates: Partial<T>,
    queryOptions: QueryOptions = {}
  ): Promise<T> {
    Validator.string(table, 'table');
    Validator.string(id, 'id');
    Validator.required(updates, 'updates');

    return this.executeWithResilience(
      async () => {
        const { data, error } = await this.client
          .from(table)
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          this.handleSupabaseError(error);
        }

        return data as unknown as T;
      },
      queryOptions,
      `Supabase update ${table}:${id.slice(0, 8)}...`
    );
  }

  async delete(
    table: string,
    id: string,
    softDelete: boolean = true,
    queryOptions: QueryOptions = {}
  ): Promise<void> {
    return this.executeWithResilience(
      async () => {
        if (softDelete) {
          const { error } = await this.client
            .from(table)
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

          if (error) {
            this.handleSupabaseError(error);
          }
        } else {
          const { error } = await this.client.from(table).delete().eq('id', id);

          if (error) {
            this.handleSupabaseError(error);
          }
        }

        return;
      },
      queryOptions,
      `Supabase delete ${table}:${id.slice(0, 8)}...`
    );
  }

  async upsert<T extends DatabaseRow>(
    table: string,
    row: Partial<T>,
    queryOptions: QueryOptions = {}
  ): Promise<T> {
    return this.executeWithResilience(
      async () => {
        const { data, error } = await this.client
          .from(table)
          .upsert(row, { onConflict: 'id' })
          .select()
          .single();

        if (error) {
          this.handleSupabaseError(error);
        }

        return data as unknown as T;
      },
      queryOptions,
      `Supabase upsert ${table}`
    );
  }

  async restore(table: string, id: string, queryOptions: QueryOptions = {}): Promise<void> {
    return this.executeWithResilience(
      async () => {
        const { error } = await this.client.from(table).update({ deleted_at: null }).eq('id', id);

        if (error) {
          this.handleSupabaseError(error);
        }

        return;
      },
      queryOptions,
      `Supabase restore ${table}:${id.slice(0, 8)}...`
    );
  }

  async raw<T = unknown>(
    query: string,
    params: unknown[] = [],
    queryOptions: QueryOptions = {}
  ): Promise<T[]> {
    return this.executeWithResilience(async () => {
      const { data, error } = await this.client.rpc('exec_sql', {
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
      const { error } = await this.client
        .from('users')
        .select('id')
        .limit(HEALTH_CHECK_QUERY_LIMIT);

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
    });
  }

  /**
   * Get URL for configuration comparison
   * @internal
   */
  getUrl(): string {
    return this.config.url;
  }

  /**
   * Get anon key prefix for configuration comparison
   * @internal
   */
  getAnonKeyPrefix(): string {
    const { anonKey } = this.config;
    return anonKey.length >= API_KEY_PREFIX_LENGTH
      ? anonKey.substring(0, API_KEY_PREFIX_LENGTH)
      : anonKey;
  }

  /**
   * Check if a record exists in the specified table
   */
  async exists(
    table: string,
    filter: { column: string; operator: string; value: unknown },
    queryOptions: QueryOptions = {}
  ): Promise<boolean> {
    Validator.string(table, 'table');

    return this.executeWithResilience(
      async () => {
        const { count, error } = await this.client
          .from(table)
          .select('id', { count: 'exact', head: true })
          .filter(filter.column, filter.operator, filter.value);

        if (error) {
          this.handleSupabaseError(error);
        }

        return (count ?? 0) > 0;
      },
      queryOptions,
      `exists check on ${table}:${filter.column}`
    );
  }

  /**
   * Count records in the specified table with optional filtering
   */
  async count(
    table: string,
    options: {
      filter?: { column: string; operator: string; value: unknown };
      includeDeleted?: boolean;
    } = {},
    queryOptions: QueryOptions = {}
  ): Promise<number> {
    const { filter, includeDeleted = false } = options;
    Validator.string(table, 'table');

    return this.executeWithResilience(
      async () => {
        let query = this.client.from(table).select('id', { count: 'exact', head: true });

        if (filter) {
          query = query.filter(filter.column, filter.operator, filter.value);
        }

        if (!includeDeleted) {
          query = query.eq('deleted_at', null);
        }

        const { count, error } = await query;

        if (error) {
          this.handleSupabaseError(error);
        }

        return count ?? 0;
      },
      queryOptions,
      `count on ${table}`
    );
  }
}

// Import ServiceFactory for singleton management (consolidated pattern)
import { serviceFactory } from '../utils/service-factory';

let supabaseInstance: SupabaseService | null = null;

/**
 * Create a singleton Supabase client using ServiceFactory
 * @deprecated Use serviceFactory.createSupabaseClient() for new code
 * @param config - Supabase configuration
 * @returns SupabaseService instance
 */
export function createSupabaseClient(config: SupabaseConfig): SupabaseService {
  // Use ServiceFactory for proper singleton management with health checks and metrics
  const service = serviceFactory.createSupabaseClient(config);
  supabaseInstance = service;
  return service;
}

/**
 * Get the current Supabase client instance
 * @deprecated Use serviceFactory.getService() for new code
 * @returns SupabaseService instance or null
 */
export function getSupabaseClient(): SupabaseService | null {
  return supabaseInstance;
}

/**
 * Reset the Supabase client instance
 * @deprecated Use serviceFactory.resetService() for new code
 */
export function resetSupabaseClient(): void {
  serviceFactory.resetService('supabase');
  supabaseInstance = null;
}

/**
 * Type guard to check if a service is a SupabaseService
 * @param service - Service instance to check
 * @returns True if the service is a SupabaseService
 */
export function isSupabaseService(service: unknown): service is SupabaseService {
  return service instanceof SupabaseService;
}
