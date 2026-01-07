import { MigrationRunner, type SupabaseClient } from "./runner";
import { Migration } from "./types";
export const migrations: Migration[] = [
  {
    name: "Add soft delete support",
    version: "20260107001",
    up: async () => {
      console.log(
        "  Migration 20260107001: Execute 20260107001-add-soft-delete.sql manually in Supabase SQL Editor",
      );
    },
    down: async () => {
      console.log(
        "  Rollback 20260107001: Execute down migration in 20260107001-add-soft-delete.sql manually",
      );
    },
  },
  {
    name: "Convert JSON fields to JSONB",
    version: "20260107002",
    up: async () => {
      console.log(
        "  Migration 20260107002: Execute 20260107002-convert-jsonb.sql manually in Supabase SQL Editor",
      );
    },
    down: async () => {
      console.log(
        "  Rollback 20260107002: Execute down migration in 20260107002-convert-jsonb.sql manually",
      );
    },
  },
];

export function createMigrationRunner(supabase: unknown): MigrationRunner {
  const runner = new MigrationRunner(supabase as SupabaseClient);

  migrations.forEach((migration) => {
    runner.registerMigration(migration);
  });

  return runner;
}
