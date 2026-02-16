import { MigrationRunner, type SupabaseClient } from "./runner";
import { Migration } from "./types";
import { logger } from "../utils/logger";
export const migrations: Migration[] = [
  {
    name: "Add soft delete support",
    version: "20260107001",
    up: async () => {
      logger.info(
        "Migration 20260107001: Execute 20260107001-add-soft-delete.sql manually in Supabase SQL Editor",
      );
    },
    down: async () => {
      logger.info(
        "Rollback 20260107001: Execute down migration in 20260107001-add-soft-delete.sql manually",
      );
    },
  },
  {
    name: "Convert JSON fields to JSONB",
    version: "20260107002",
    up: async () => {
      logger.info(
        "Migration 20260107002: Execute 20260107002-convert-jsonb.sql manually in Supabase SQL Editor",
      );
    },
    down: async () => {
      logger.info(
        "Rollback 20260107002: Execute down migration in 20260107002-convert-jsonb.sql manually",
      );
    },
  },
  {
    name: "Fix sessions.expires_at type inconsistency",
    version: "20260110001",
    up: async () => {
      logger.info(
        "Migration 20260110001: Execute 20260110001-fix-sessions-timestamp.sql manually in Supabase SQL Editor",
      );
    },
    down: async () => {
      logger.info(
        "Rollback 20260110001: Execute down migration in 20260110001-fix-sessions-timestamp.sql manually",
      );
    },
  },
  {
    name: "Add timestamp validation constraints",
    version: "20260110002",
    up: async () => {
      logger.info(
        "Migration 20260110002: Execute 20260110002-add-timestamp-constraints.sql manually in Supabase SQL Editor",
      );
    },
    down: async () => {
      logger.info(
        "Rollback 20260110002: Execute down migration in 20260110002-add-timestamp-constraints.sql manually",
      );
    },
  },
  {
    name: "Add asset-entry foreign key relationship",
    version: "20260110003",
    up: async () => {
      logger.info(
        "Migration 20260110003: Execute 20260110003-add-asset-entry-relationship.sql manually in Supabase SQL Editor",
      );
    },
    down: async () => {
      logger.info(
        "Rollback 20260110003: Execute down migration in 20260110003-add-asset-entry-relationship.sql manually",
      );
    },
  },
  {
    name: "Add missing created_at indexes",
    version: "20260110004",
    up: async () => {
      logger.info(
        "Migration 20260110004: Execute 20260110004-add-created-at-indexes.sql manually in Supabase SQL Editor",
      );
    },
    down: async () => {
      logger.info(
        "Rollback 20260110004: Execute down migration in 20260110004-add-created-at-indexes.sql manually",
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
