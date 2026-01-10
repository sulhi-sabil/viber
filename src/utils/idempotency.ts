import { ValidationError } from "./errors";
import { logger } from "./logger";

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

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

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

  constructor(options: IdempotencyManagerOptions = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.store = options.store ?? new InMemoryIdempotencyStore();
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

    const result = await operation();
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
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(idempotencyKey)) {
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
