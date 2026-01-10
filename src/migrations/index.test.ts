import { MigrationRunner } from "./runner";
import { createMigrationRunner, migrations } from "./index";
import { Migration } from "./types";

const mockSupabaseClient = {
  client: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
  rpc: jest.fn(),
};

const mockQueryBuilder = {
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  eq: jest.fn(),
  filter: jest.fn(),
  order: jest.fn(),
  limit: jest.fn(),
  range: jest.fn(),
  single: jest.fn(),
};

const mockQueryResult = {
  data: undefined,
  error: undefined,
};

describe("migration registry", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockQueryBuilder.select.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.insert.mockReturnValue(mockQueryResult);
    mockQueryBuilder.update.mockReturnValue(mockQueryResult);
    mockQueryBuilder.delete.mockReturnValue(mockQueryResult);
    mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.filter.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.order.mockReturnValue(mockQueryResult);
    mockQueryBuilder.limit.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.range.mockResolvedValue(mockQueryResult);
    mockQueryBuilder.single.mockResolvedValue(mockQueryResult);

    mockSupabaseClient.client.from.mockResolvedValue(
      mockQueryResult as unknown,
    );
    mockSupabaseClient.client.rpc.mockResolvedValue({ error: undefined });
    mockSupabaseClient.rpc.mockResolvedValue({ error: undefined });
  });

  describe("migrations array", () => {
    it("should export migrations array", () => {
      expect(migrations).toBeDefined();
      expect(Array.isArray(migrations)).toBe(true);
    });

    it("should have at least one migration", () => {
      expect(migrations.length).toBeGreaterThan(0);
    });

    it("should have all required migration fields", () => {
      migrations.forEach((migration: Migration) => {
        expect(migration.name).toBeDefined();
        expect(typeof migration.name).toBe("string");
        expect(migration.version).toBeDefined();
        expect(typeof migration.version).toBe("string");
        expect(migration.up).toBeDefined();
        expect(typeof migration.up).toBe("function");
        expect(migration.down).toBeDefined();
        expect(typeof migration.down).toBe("function");
      });
    });

    it("should have unique versions", () => {
      const versions = migrations.map((m) => m.version);
      const uniqueVersions = new Set(versions);
      expect(versions.length).toBe(uniqueVersions.size);
    });

    it("should have meaningful migration names", () => {
      migrations.forEach((migration: Migration) => {
        expect(migration.name.length).toBeGreaterThan(0);
        expect(migration.name.trim()).toBe(migration.name);
      });
    });

    it("should have up functions that return promises", () => {
      migrations.forEach((migration: Migration) => {
        expect(migration.up()).toBeInstanceOf(Promise);
      });
    });

    it("should have down functions that return promises", () => {
      migrations.forEach((migration: Migration) => {
        expect(migration.down()).toBeInstanceOf(Promise);
      });
    });

    it("should have migration for soft delete support", () => {
      const softDeleteMigration = migrations.find(
        (m) => m.version === "20260107001",
      );

      expect(softDeleteMigration).toBeDefined();
      expect(softDeleteMigration?.name).toBe("Add soft delete support");
    });

    it("should have migration for JSONB conversion", () => {
      const jsonbMigration = migrations.find(
        (m) => m.version === "20260107002",
      );

      expect(jsonbMigration).toBeDefined();
      expect(jsonbMigration?.name).toBe("Convert JSON fields to JSONB");
    });
  });

  describe("createMigrationRunner", () => {
    it("should create MigrationRunner instance", () => {
      const runner = createMigrationRunner(mockSupabaseClient);
      expect(runner).toBeInstanceOf(MigrationRunner);
    });

    it("should create new runner each time", () => {
      const runner1 = createMigrationRunner(mockSupabaseClient);
      const runner2 = createMigrationRunner(mockSupabaseClient);
      expect(runner1).not.toBe(runner2);
    });

    it("should pass supabase client to runner", () => {
      const runner = createMigrationRunner(mockSupabaseClient);
      expect(runner).toBeDefined();
    });

    it("should handle empty supabase client", () => {
      expect(() => {
        createMigrationRunner({} as unknown);
      }).not.toThrow();
    });
  });
});
