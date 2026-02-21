import {
  IdempotencyManager,
  createIdempotencyManager,
  InMemoryIdempotencyStore,
  IdempotencyStore,
} from './idempotency';

describe('InMemoryIdempotencyStore', () => {
  let store: InMemoryIdempotencyStore;

  beforeEach(() => {
    store = new InMemoryIdempotencyStore();
  });

  describe('get and set', () => {
    it('should store and retrieve values', async () => {
      const value = { data: 'test' };
      await store.set('key-1', { data: value, timestamp: 123 }, 1000);

      const result = await store.get('key-1');
      expect(result).toEqual({ data: value, timestamp: 123 });
    });

    it('should return null for non-existent keys', async () => {
      const result = await store.get('non-existent');
      expect(result).toBeNull();
    });

    it('should handle different data types', async () => {
      const stringValue = { data: 'text', timestamp: 1 };
      const numberValue = { data: 42, timestamp: 2 };
      const objectValue = { data: { nested: true }, timestamp: 3 };
      const arrayValue = { data: [1, 2, 3], timestamp: 4 };

      await store.set('string-key', stringValue, 1000);
      await store.set('number-key', numberValue, 1000);
      await store.set('object-key', objectValue, 1000);
      await store.set('array-key', arrayValue, 1000);

      expect(await store.get('string-key')).toEqual(stringValue);
      expect(await store.get('number-key')).toEqual(numberValue);
      expect(await store.get('object-key')).toEqual(objectValue);
      expect(await store.get('array-key')).toEqual(arrayValue);
    });
  });

  describe('expiration', () => {
    it('should expire entries after TTL', async () => {
      const value = { data: 'test', timestamp: 123 };
      await store.set('key-1', value, 100);

      const result1 = await store.get('key-1');
      expect(result1).toEqual(value);

      await new Promise((resolve) => setTimeout(resolve, 150));

      const result2 = await store.get('key-1');
      expect(result2).toBeNull();
    });

    it('should clean up expired entries on get', async () => {
      const value = { data: 'test', timestamp: 123 };
      await store.set('key-1', value, 50);
      await store.set('key-2', { data: 'test2', timestamp: 124 }, 5000);

      await new Promise((resolve) => setTimeout(resolve, 100));

      await store.get('key-1');
      expect(store.size).toBe(1);
    });
  });

  describe('delete', () => {
    it('should delete existing keys', async () => {
      await store.set('key-1', { data: 'test', timestamp: 123 }, 1000);
      expect(await store.get('key-1')).not.toBeNull();

      await store.delete('key-1');
      expect(await store.get('key-1')).toBeNull();
    });

    it('should handle deleting non-existent keys', async () => {
      await expect(store.delete('non-existent')).resolves.not.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all entries', async () => {
      await store.set('key-1', { data: 'test1', timestamp: 1 }, 1000);
      await store.set('key-2', { data: 'test2', timestamp: 2 }, 1000);
      await store.set('key-3', { data: 'test3', timestamp: 3 }, 1000);

      expect(store.size).toBe(3);

      await store.clear();

      expect(store.size).toBe(0);
      expect(await store.get('key-1')).toBeNull();
      expect(await store.get('key-2')).toBeNull();
      expect(await store.get('key-3')).toBeNull();
    });
  });
});

describe('IdempotencyManager', () => {
  let manager: IdempotencyManager;

  beforeEach(() => {
    manager = createIdempotencyManager();
  });

  afterEach(async () => {
    await manager.clear();
  });

  describe('execute', () => {
    it('should execute operation and store result', async () => {
      const operation = jest.fn().mockResolvedValue({ result: 'success' });
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';

      const result = await manager.execute(idempotencyKey, operation);

      expect(operation).toHaveBeenCalledTimes(1);
      expect(result.data).toEqual({ result: 'success' });
      expect(result.cached).toBe(false);
      expect(result.idempotencyKey).toBe(idempotencyKey);
      expect(typeof result.timestamp).toBe('number');
    });

    it('should return cached result on duplicate request', async () => {
      const operation = jest.fn().mockResolvedValue({ result: 'success' });
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';

      const result1 = await manager.execute(idempotencyKey, operation);
      const result2 = await manager.execute(idempotencyKey, operation);

      expect(operation).toHaveBeenCalledTimes(1);
      expect(result1.data).toEqual(result2.data);
      expect(result1.cached).toBe(false);
      expect(result2.cached).toBe(true);
      expect(result2.timestamp).toBe(result1.timestamp);
    });

    it('should throw ValidationError for invalid UUID', async () => {
      const operation = jest.fn().mockResolvedValue({ result: 'success' });
      const invalidKey = 'not-a-uuid';

      await expect(manager.execute(invalidKey, operation)).rejects.toThrow(
        'Invalid idempotency key: must be a valid UUID'
      );
      expect(operation).not.toHaveBeenCalled();
    });

    it('should reject invalid UUID formats', async () => {
      const operation = jest.fn().mockResolvedValue({ result: 'success' });
      const invalidKeys = [
        '',
        '123',
        '550e8400-e29b-41d4-a716',
        'g50e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440000-extra',
      ];

      for (const key of invalidKeys) {
        await expect(manager.execute(key, operation)).rejects.toThrow('Invalid idempotency key');
      }
      expect(operation).not.toHaveBeenCalled();
    });

    it('should accept valid UUID v4', async () => {
      const operation = jest.fn().mockResolvedValue({ result: 'success' });
      const validKeys = [
        '550e8400-e29b-41d4-a716-446655440000',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      ];

      for (const key of validKeys) {
        const result = await manager.execute(key, operation);
        expect(result).toBeDefined();
      }
      expect(operation).toHaveBeenCalledTimes(validKeys.length);
    });

    it('should handle errors in operation', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';

      await expect(manager.execute(idempotencyKey, operation)).rejects.toThrow('Operation failed');

      operation.mockResolvedValueOnce({ result: 'success' });
      const result = await manager.execute(idempotencyKey, operation);

      expect(result.cached).toBe(false);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should handle concurrent requests (without locking)', async () => {
      let counter = 0;
      const operation = jest.fn().mockImplementation(async () => {
        counter++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { result: counter };
      });
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';

      const results = await Promise.all([
        manager.execute(idempotencyKey, operation),
        manager.execute(idempotencyKey, operation),
        manager.execute(idempotencyKey, operation),
      ]);

      expect(operation).toHaveBeenCalled();
      expect(results.length).toBe(3);
      expect(results.every((r) => r.idempotencyKey === idempotencyKey)).toBe(true);
    });
  });

  describe('invalidate', () => {
    it('should invalidate cached response', async () => {
      const operation = jest.fn().mockResolvedValue({ result: 'success' });
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';

      const result1 = await manager.execute(idempotencyKey, operation);
      expect(result1.cached).toBe(false);

      await manager.invalidate(idempotencyKey);

      const result2 = await manager.execute(idempotencyKey, operation);
      expect(result2.cached).toBe(false);

      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should throw ValidationError for invalid UUID on invalidate', async () => {
      await expect(manager.invalidate('not-a-uuid')).rejects.toThrow(
        'Invalid idempotency key: must be a valid UUID'
      );
    });

    it('should handle invalidating non-existent keys', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      await expect(manager.invalidate(idempotencyKey)).resolves.not.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all cached responses', async () => {
      const operation = jest.fn().mockResolvedValue({ result: 'success' });

      await manager.execute('550e8400-e29b-41d4-a716-446655440001', operation);
      await manager.execute('550e8400-e29b-41d4-a716-446655440002', operation);
      await manager.execute('550e8400-e29b-41d4-a716-446655440003', operation);

      await manager.clear();

      const result = await manager.execute('550e8400-e29b-41d4-a716-446655440001', operation);
      expect(result.cached).toBe(false);
      expect(operation).toHaveBeenCalledTimes(4);
    });
  });

  describe('custom TTL', () => {
    it('should use custom TTL from options', async () => {
      const customManager = createIdempotencyManager({ ttlMs: 100 });
      const operation = jest.fn().mockResolvedValue({ result: 'success' });
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';

      const result1 = await customManager.execute(idempotencyKey, operation);
      expect(result1.cached).toBe(false);

      await new Promise((resolve) => setTimeout(resolve, 150));

      const result2 = await customManager.execute(idempotencyKey, operation);
      expect(result2.cached).toBe(false);
      expect(operation).toHaveBeenCalledTimes(2);

      await customManager.clear();
    });
  });

  describe('custom store', () => {
    it('should use custom store implementation', async () => {
      const customStore: IdempotencyStore = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
        clear: jest.fn().mockResolvedValue(undefined),
      };

      const customManager = createIdempotencyManager({ store: customStore });
      const operation = jest.fn().mockResolvedValue({ result: 'success' });
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';

      await customManager.execute(idempotencyKey, operation);

      expect(customStore.get).toHaveBeenCalledWith(idempotencyKey);
      expect(customStore.set).toHaveBeenCalledWith(
        idempotencyKey,
        expect.objectContaining({
          data: { result: 'success' },
        }),
        expect.any(Number)
      );
    });
  });
});

describe('createIdempotencyManager', () => {
  it('should create IdempotencyManager with default options', () => {
    const manager = createIdempotencyManager();
    expect(manager).toBeInstanceOf(IdempotencyManager);
  });

  it('should create IdempotencyManager with custom options', () => {
    const customStore = new InMemoryIdempotencyStore();
    const manager = createIdempotencyManager({
      ttlMs: 60000,
      store: customStore,
    });
    expect(manager).toBeInstanceOf(IdempotencyManager);
  });

  it('should create independent manager instances', async () => {
    const manager1 = createIdempotencyManager();
    const manager2 = createIdempotencyManager();
    const operation = jest.fn().mockResolvedValue({ result: 'success' });
    const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';

    const result1 = await manager1.execute(idempotencyKey, operation);
    const result2 = await manager2.execute(idempotencyKey, operation);

    expect(result1.cached).toBe(false);
    expect(result2.cached).toBe(false);

    await manager1.clear();
    await manager2.clear();
  });
});
