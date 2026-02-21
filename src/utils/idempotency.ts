import { ValidationError } from "./errors";
import { logger } from "./logger";
import { IDEMPOTENCY_DEFAULT_TTL_MS } from "../config/constants";

/**
 * Cached UUID regex for idempotency key validation.
 * Compiled once at module load to avoid repeated regex compilation.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface IdempotencyResult<T> {
  data: T;
  cached: boolean;
  idempotencyKey: string;
  timestamp: number;
}

export interface StoredResponse<T> {
  data: T;
  timestamp: number;
}

export interface IdempotencyStore {
  get<T>(key: string): Promise<StoredResponse<T> | null>;
  set<T>(key: string, value: StoredResponse<T>, ttl: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface IdempotencyManagerOptions {
  ttlMs?: number;
  store?: IdempotencyStore;
}

const DEFAULT_TTL_MS = IDEMPOTENCY_DEFAULT_TTL_MS;

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private cache: Map<string, StoredResponse<unknown> & { expiresAt: number }>;

  constructor() {
    this.cache = new Map();
  }

  async get<T>(key: string): Promise<StoredResponse<T> | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { expiresAt, ...response } = entry;
    return response as StoredResponse<T>;
  }

  async set<T>(
    key: string,
    value: StoredResponse<T>,
    ttl: number,
  ): Promise<void> {
    this.cache.set(key, {
      ...value,
      expiresAt: Date.now() + ttl,
    });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

export class IdempotencyManager {
  private ttlMs: number;
  private store: IdempotencyStore;
  private inFlightOperations: Map<string, Promise<unknown>>;

  constructor(options: IdempotencyManagerOptions = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.store = options.store ?? new InMemoryIdempotencyStore();
    this.inFlightOperations = new Map();
  }

  async execute<T>(
    idempotencyKey: string,
    operation: () => Promise<T>,
  ): Promise<IdempotencyResult<T>> {
    this.validateIdempotencyKey(idempotencyKey);

    const cached = await this.store.get<T>(idempotencyKey);

    if (cached) {
      logger.info(
        `Returning cached response for idempotency key: ${idempotencyKey}`,
      );
      return {
        data: cached.data,
        cached: true,
        idempotencyKey,
        timestamp: cached.timestamp,
      };
    }

    const inFlight = this.inFlightOperations.get(idempotencyKey);
    if (inFlight) {
      logger.info(
        `Waiting for in-flight operation for idempotency key: ${idempotencyKey}`,
      );
      const result = (await inFlight) as T;
      const timestamp = Date.now();
      return {
        data: result,
        cached: true,
        idempotencyKey,
        timestamp,
      };
    }

    const operationPromise = operation();
    this.inFlightOperations.set(idempotencyKey, operationPromise);

    try {
      const result = await operationPromise;
      const timestamp = Date.now();

      await this.store.set(
        idempotencyKey,
        { data: result, timestamp },
        this.ttlMs,
      );

      logger.info(`Stored response for idempotency key: ${idempotencyKey}`);

      return {
        data: result,
        cached: false,
        idempotencyKey,
        timestamp,
      };
    } finally {
      this.inFlightOperations.delete(idempotencyKey);
    }
  }

  async invalidate(idempotencyKey: string): Promise<void> {
    this.validateIdempotencyKey(idempotencyKey);
    await this.store.delete(idempotencyKey);
    logger.info(`Invalidated idempotency key: ${idempotencyKey}`);
  }

  async clear(): Promise<void> {
    await this.store.clear();
    logger.info("Cleared all idempotency keys");
  }

  private validateIdempotencyKey(idempotencyKey: string): void {
    if (!UUID_REGEX.test(idempotencyKey)) {
      throw new ValidationError(
        `Invalid idempotency key: must be a valid UUID, got: ${idempotencyKey}`,
      );
    }
  }
}

export function createIdempotencyManager(
  options?: IdempotencyManagerOptions,
): IdempotencyManager {
  return new IdempotencyManager(options);
}
