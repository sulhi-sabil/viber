import { Migration, MigrationRecord } from "./types";

export interface SupabaseClient {
  from(table: string): QueryBuilder;
  client: {
    from(table: string): QueryBuilder;
    rpc(name: string): Promise<{ error?: { code?: string } }>;
  };
  rpc(name: string): Promise<{ error?: { code?: string } }>;
}

interface QueryBuilder {
  select(columns: string): QueryBuilder;
  insert(data: unknown): QueryBuilder;
  update(data: unknown): QueryBuilder;
  delete(): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  filter(column: string, operator: string, value: unknown): QueryBuilder;
  order(column: string, options?: unknown): QueryBuilder;
  limit(count: number): QueryBuilder;
  range(
    from: number,
    to: number,
  ): Promise<{ data?: unknown[]; error?: { code?: string; message?: string } }>;
  single(): Promise<{
    data?: unknown;
    error?: { code?: string; message?: string };
  }>;
}

export class MigrationRunner {
  private migrations: Migration[] = [];
  private migrationsTable = "_migrations";

  constructor(private supabase: SupabaseClient) {}

  registerMigration(migration: Migration): void {
    this.migrations.push(migration);
    this.migrations.sort((a, b) => a.version.localeCompare(b.version));
  }

  async run(): Promise<void> {
    await this.ensureMigrationsTable();

    const executedMigrations = await this.getExecutedMigrations();
    const executedVersions = new Set(executedMigrations.map((m) => m.version));

    const pendingMigrations = this.migrations.filter(
      (m) => !executedVersions.has(m.version),
    );

    if (pendingMigrations.length === 0) {
      console.log("No pending migrations to run");
      return;
    }

    console.log(`Running ${pendingMigrations.length} pending migration(s)...`);

    for (const migration of pendingMigrations) {
      await this.runMigration(migration);
    }

    console.log("All migrations completed successfully");
  }

  async rollback(version?: string): Promise<void> {
    await this.ensureMigrationsTable();

    const executedMigrations = await this.getExecutedMigrations();

    if (version) {
      const migration = this.migrations.find((m) => m.version === version);

      if (!migration) {
        throw new Error(`Migration version ${version} not found`);
      }

      if (!executedMigrations.find((m) => m.version === version)) {
        throw new Error(`Migration version ${version} has not been executed`);
      }

      await this.rollbackMigration(migration);
    } else {
      const migrationsToRollback = executedMigrations.sort((a, b) =>
        b.version.localeCompare(a.version),
      );

      for (const record of migrationsToRollback) {
        const migration = this.migrations.find(
          (m) => m.version === record.version,
        );

        if (migration) {
          await this.rollbackMigration(migration);
        }
      }
    }

    console.log("Rollback completed");
  }

  private async ensureMigrationsTable(): Promise<void> {
    try {
      await this.supabase.client.rpc("create_migrations_table");
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code !== "PGRST202") {
        console.warn("Failed to create migrations table:", err.message);
      }
    }
  }

  private async getExecutedMigrations(): Promise<MigrationRecord[]> {
    const result = await this.supabase.client
      .from(this.migrationsTable)
      .select("*")
      .order("version");

    const { data, error } = result as {
      data?: unknown[];
      error?: { code?: string; message?: string };
    };

    if (error && error.code !== "PGRST116") {
      throw new Error(`Failed to get migrations: ${error.message}`);
    }

    return (data as unknown as MigrationRecord[]) || [];
  }

  private async runMigration(migration: Migration): Promise<void> {
    console.log(`Running migration: ${migration.name} (${migration.version})`);

    try {
      await migration.up();
      await this.recordMigration(migration);

      console.log(`✓ Migration ${migration.version} completed`);
    } catch (error) {
      console.error(`✗ Migration ${migration.version} failed:`, error);
      throw error;
    }
  }

  private async rollbackMigration(migration: Migration): Promise<void> {
    console.log(
      `Rolling back migration: ${migration.name} (${migration.version})`,
    );

    try {
      await migration.down();
      await this.removeMigrationRecord(migration.version);

      console.log(`✓ Rollback ${migration.version} completed`);
    } catch (error) {
      console.error(`✗ Rollback ${migration.version} failed:`, error);
      throw error;
    }
  }

  private async recordMigration(migration: Migration): Promise<void> {
    const result = await this.supabase.client
      .from(this.migrationsTable)
      .insert({
        version: migration.version,
        name: migration.name,
        executed_at: new Date().toISOString(),
      });

    const { error } = result as { error?: { message?: string } };

    if (error) {
      throw new Error(`Failed to record migration: ${error.message}`);
    }
  }

  private async removeMigrationRecord(version: string): Promise<void> {
    const result = (await this.supabase.client
      .from(this.migrationsTable)
      .delete()
      .eq("version", version)) as unknown;

    const { error } = result as { error?: { message?: string } };

    if (error) {
      throw new Error(`Failed to remove migration record: ${error.message}`);
    }
  }
}
