import {
  SupabaseService,
  createSupabaseClient,
  getSupabaseClient,
  resetSupabaseClient,
  SupabaseConfig,
  DatabaseRow,
} from "../services/supabase";
import { SupabaseError, InternalError } from "../utils/errors";
import { CircuitBreaker } from "../utils/circuit-breaker";

const mockSupabaseClient = {
  from: jest.fn(),
  rpc: jest.fn(),
};

const mockAdminClient = {
  from: jest.fn(),
};

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn((_url: string, key: string, _options: any) => {
    if (key === "test-service-role-key") {
      return mockAdminClient;
    }
    return mockSupabaseClient;
  }),
}));

interface TestRow extends DatabaseRow {
  name: string;
  email: string;
  age: number;
}

describe("SupabaseService", () => {
  const mockConfig: SupabaseConfig = {
    url: "https://test.supabase.co",
    anonKey: "test-anon-key",
    serviceRoleKey: "test-service-role-key",
    timeout: 10000,
    maxRetries: 3,
    circuitBreakerThreshold: 5,
    circuitBreakerResetTimeout: 60000,
  };

  beforeEach(() => {
    resetSupabaseClient();
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with provided config", () => {
      const service = new SupabaseService(mockConfig);

      expect(service).toBeInstanceOf(SupabaseService);
      expect(service.adminClient).toBeDefined();
    });

    it("should initialize with default config", () => {
      const service = new SupabaseService({
        url: "https://test.supabase.co",
        anonKey: "test-key",
      });

      expect(service).toBeInstanceOf(SupabaseService);
    });

    it("should accept custom circuit breaker", () => {
      const customCircuitBreaker = new CircuitBreaker({
        failureThreshold: 10,
        resetTimeout: 120000,
      });

      const service = new SupabaseService(
        {
          url: "https://test.supabase.co",
          anonKey: "test-key",
        },
        customCircuitBreaker,
      );

      expect(service.getCircuitBreaker()).toBe(customCircuitBreaker);
    });

    it("should not create admin client if service role key not provided", () => {
      const service = new SupabaseService({
        url: "https://test.supabase.co",
        anonKey: "test-key",
      });

      expect(service.adminClient).toBeNull();
    });
  });

  describe("select", () => {
    it("should select all rows from table", async () => {
      const mockData: TestRow[] = [
        { id: "1", name: "John", email: "john@example.com", age: 30 },
        { id: "2", name: "Jane", email: "jane@example.com", age: 25 },
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: mockData,
          error: null,
        }),
      });

      const service = new SupabaseService(mockConfig);
      const result = await service.select<TestRow>("users");

      expect(result).toEqual(mockData);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("users");
    });

    it("should select with columns filter", async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const service = new SupabaseService(mockConfig);
      await service.select<TestRow>("users", {
        columns: "id,name",
      });

      expect(mockSupabaseClient.from().select).toHaveBeenCalledWith("id,name");
    });

    it("should select with filter", async () => {
      const mockData: TestRow[] = [
        { id: "1", name: "John", email: "john@example.com", age: 30 },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        filter: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: mockData,
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const service = new SupabaseService(mockConfig);
      await service.select<TestRow>("users", {
        filter: {
          column: "age",
          operator: "gte",
          value: 25,
        },
      });

      expect(mockSupabaseClient.from().filter).toHaveBeenCalledWith(
        "age",
        "gte",
        25,
      );
    });

    it("should select with order by", async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        filter: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const service = new SupabaseService(mockConfig);
      await service.select<TestRow>("users", {
        orderBy: {
          column: "name",
          ascending: true,
        },
      });

      expect(mockSupabaseClient.from().order).toHaveBeenCalledWith("name", {
        ascending: true,
      });
    });

    it("should select with limit", async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const service = new SupabaseService(mockConfig);
      await service.select<TestRow>("users", {
        limit: 10,
      });

      expect(mockSupabaseClient.from().limit).toHaveBeenCalledWith(10);
    });

    it("should select with offset", async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const service = new SupabaseService(mockConfig);
      await service.select<TestRow>("users", {
        offset: 20,
      });

      expect(mockSupabaseClient.from().range).toHaveBeenCalledWith(20, 29);
    });

    it("should handle PostgrestError", async () => {
      const mockError = {
        message: "Relation does not exist",
        code: "42P01",
        details: "Table 'users' not found",
        hint: null,
      };

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: mockError,
        }),
      });

      const service = new SupabaseService(mockConfig);
      await expect(service.select<TestRow>("users")).rejects.toThrow(
        SupabaseError,
      );
    });

    it("should return empty array when no data", async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      });

      const service = new SupabaseService(mockConfig);
      const result = await service.select<TestRow>("users");

      expect(result).toEqual([]);
    });
  });

  describe("selectById", () => {
    it("should select row by id", async () => {
      const mockData: TestRow = {
        id: "1",
        name: "John",
        email: "john@example.com",
        age: 30,
      };

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockData,
          error: null,
        }),
      });

      const service = new SupabaseService(mockConfig);
      const result = await service.selectById<TestRow>("users", "1");

      expect(result).toEqual(mockData);
      expect(mockSupabaseClient.from().eq).toHaveBeenCalledWith("id", "1");
    });

    it("should return null when row not found (PGRST116)", async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: "PGRST116", message: "Not found" },
        }),
      });

      const service = new SupabaseService(mockConfig);
      const result = await service.selectById<TestRow>("users", "999");

      expect(result).toBeNull();
    });

    it("should throw error for other errors", async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: "42P01", message: "Table not found" },
        }),
      });

      const service = new SupabaseService(mockConfig);
      await expect(service.selectById<TestRow>("users", "1")).rejects.toThrow(
        SupabaseError,
      );
    });
  });

  describe("insert", () => {
    it("should insert a single row", async () => {
      const newRow: Partial<TestRow> = {
        name: "Alice",
        email: "alice@example.com",
        age: 28,
      };

      const insertedRow: TestRow = {
        id: "3",
        name: newRow.name || "Alice",
        email: newRow.email || "alice@example.com",
        age: newRow.age || 28,
      };

      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: insertedRow,
          error: null,
        }),
      });

      const service = new SupabaseService(mockConfig);
      const result = await service.insert<TestRow>("users", newRow);

      expect(result).toEqual(insertedRow);
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(newRow);
    });

    it("should handle insert error", async () => {
      const newRow: Partial<TestRow> = {
        name: "Alice",
        email: "alice@example.com",
        age: 28,
      };

      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: {
            code: "23505",
            message: "Unique violation",
            details: "Duplicate key",
          },
        }),
      });

      const service = new SupabaseService(mockConfig);
      await expect(service.insert<TestRow>("users", newRow)).rejects.toThrow(
        SupabaseError,
      );
    });
  });

  describe("insertMany", () => {
    it("should insert multiple rows", async () => {
      const newRows: Partial<TestRow>[] = [
        { name: "Alice", email: "alice@example.com", age: 28 },
        { name: "Bob", email: "bob@example.com", age: 32 },
      ];

      const insertedRows: TestRow[] = [
        {
          id: "3",
          name: newRows[0].name || "Alice",
          email: newRows[0].email || "alice@example.com",
          age: newRows[0].age || 28,
        },
        {
          id: "4",
          name: newRows[1].name || "Bob",
          email: newRows[1].email || "bob@example.com",
          age: newRows[1].age || 32,
        },
      ];

      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: insertedRows,
          error: null,
        }),
      });

      const service = new SupabaseService(mockConfig);
      const result = await service.insertMany<TestRow>("users", newRows);

      expect(result).toEqual(insertedRows);
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(newRows);
    });

    it("should handle insert error", async () => {
      const newRows: Partial<TestRow>[] = [
        { name: "Alice", email: "alice@example.com", age: 28 },
      ];

      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: null,
          error: { code: "23505", message: "Unique violation" },
        }),
      });

      const service = new SupabaseService(mockConfig);
      await expect(
        service.insertMany<TestRow>("users", newRows),
      ).rejects.toThrow(SupabaseError);
    });
  });

  describe("update", () => {
    it("should update a row", async () => {
      const updates: Partial<TestRow> = {
        name: "John Updated",
        age: 31,
      };

      const updatedRow: TestRow = {
        id: "1",
        name: updates.name || "John",
        email: "john@example.com",
        age: updates.age || 30,
      };

      mockSupabaseClient.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: updatedRow,
          error: null,
        }),
      });

      const service = new SupabaseService(mockConfig);
      const result = await service.update<TestRow>("users", "1", updates);

      expect(result).toEqual(updatedRow);
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "John Updated",
          age: 31,
          updated_at: expect.any(String),
        }),
      );
    });

    it("should handle update error", async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: "42P01", message: "Table not found" },
        }),
      });

      const service = new SupabaseService(mockConfig);
      await expect(
        service.update<TestRow>("users", "1", { name: "Updated" }),
      ).rejects.toThrow(SupabaseError);
    });
  });

  describe("delete", () => {
    it("should delete a row (soft delete)", async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          error: null,
        }),
      });

      const service = new SupabaseService(mockConfig);
      await service.delete("users", "1");

      expect(mockSupabaseClient.from().update).toHaveBeenCalled();
      expect(mockSupabaseClient.from().eq).toHaveBeenCalledWith("id", "1");
    });

    it("should permanently delete a row (hard delete)", async () => {
      mockSupabaseClient.from.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          error: null,
        }),
      });

      const service = new SupabaseService(mockConfig);
      await service.delete("users", "1", false);

      expect(mockSupabaseClient.from().delete).toHaveBeenCalled();
      expect(mockSupabaseClient.from().eq).toHaveBeenCalledWith("id", "1");
    });

    it("should handle delete error", async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          error: { code: "42P01", message: "Table not found" },
        }),
      });

      const service = new SupabaseService(mockConfig);
      await expect(service.delete("users", "1")).rejects.toThrow(SupabaseError);
    });
  });

  describe("upsert", () => {
    it("should upsert a row", async () => {
      const row: Partial<TestRow> = {
        id: "1",
        name: "John Upserted",
        email: "john@example.com",
        age: 30,
      };

      const upsertedRow: TestRow = {
        id: row.id || "1",
        name: row.name || "John Upserted",
        email: row.email || "john@example.com",
        age: row.age || 30,
      };

      mockSupabaseClient.from.mockReturnValue({
        upsert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: upsertedRow,
          error: null,
        }),
      });

      const service = new SupabaseService(mockConfig);
      const result = await service.upsert<TestRow>("users", row);

      expect(result).toEqual(upsertedRow);
      expect(mockSupabaseClient.from().upsert).toHaveBeenCalledWith(row, {
        onConflict: "id",
      });
    });

    it("should handle upsert error", async () => {
      mockSupabaseClient.from.mockReturnValue({
        upsert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: "42P01", message: "Table not found" },
        }),
      });

      const service = new SupabaseService(mockConfig);
      await expect(
        service.upsert<TestRow>("users", {
          id: "1",
          name: "Test",
          email: "test@example.com",
          age: 30,
        }),
      ).rejects.toThrow(SupabaseError);
    });
  });

  describe("healthCheck", () => {
    it("should return healthy when service is working", async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const service = new SupabaseService(mockConfig);
      const result = await service.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it("should return healthy when table doesn't exist but no error", async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: null,
          error: { code: "PGRST116", message: "Not found" },
        }),
      });

      const service = new SupabaseService(mockConfig);
      const result = await service.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should return unhealthy when service fails", async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: null,
          error: { code: "42P01", message: "Connection failed" },
        }),
      });

      const service = new SupabaseService(mockConfig);
      const result = await service.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should measure latency", async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const service = new SupabaseService(mockConfig);
      const result = await service.healthCheck();

      expect(result.latency).toBeGreaterThanOrEqual(0);
    });
  });

  describe("circuit breaker integration", () => {
    it("should return circuit breaker state", () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const service = new SupabaseService(mockConfig);
      const state = service.getCircuitBreakerState();

      expect(state).toHaveProperty("state");
      expect(state).toHaveProperty("metrics");
      expect(state.metrics).toHaveProperty("failureCount");
      expect(state.metrics).toHaveProperty("successCount");
    });

    it("should return circuit breaker instance", () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const service = new SupabaseService(mockConfig);
      const circuitBreaker = service.getCircuitBreaker();

      expect(circuitBreaker).toBeInstanceOf(CircuitBreaker);
    });

    it("should allow manual reset of circuit breaker", () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const service = new SupabaseService(mockConfig);
      service.resetCircuitBreaker();

      const state = service.getCircuitBreakerState();
      expect(state.state).toBe("closed");
    });
  });

  describe("singleton pattern", () => {
    it("should create singleton instance", () => {
      resetSupabaseClient();

      const instance1 = createSupabaseClient({
        url: "https://test.supabase.co",
        anonKey: "test-key",
      });
      const instance2 = createSupabaseClient({
        url: "https://test.supabase.co",
        anonKey: "test-key",
      });

      expect(instance1).toBe(instance2);
    });

    it("should return existing instance", () => {
      const instance = createSupabaseClient({
        url: "https://test.supabase.co",
        anonKey: "test-key",
      });
      const retrievedInstance = getSupabaseClient();

      expect(retrievedInstance).toBe(instance);
    });

    it("should allow resetting instance", () => {
      createSupabaseClient({
        url: "https://test.supabase.co",
        anonKey: "test-key",
      });
      resetSupabaseClient();

      const instance = getSupabaseClient();

      expect(instance).toBeNull();
    });
  });

  describe("error handling", () => {
    it("should throw InternalError for unknown errors", async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: { message: "Network timeout" },
        }),
      });

      const service = new SupabaseService(mockConfig);
      await expect(service.select<TestRow>("users")).rejects.toThrow(
        InternalError,
      );
    });

    it("should throw SupabaseError with PostgrestError details", async () => {
      const mockError = {
        message: "Constraint violation",
        code: "23505",
        details: "Unique constraint violation",
        hint: "Check your input data",
      };

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: mockError,
        }),
      });

      const service = new SupabaseService(mockConfig);
      await expect(service.select<TestRow>("users")).rejects.toThrow(
        SupabaseError,
      );
    });
  });
});
