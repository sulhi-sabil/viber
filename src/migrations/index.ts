import { MigrationRunner, type SupabaseClient } from "./runner";
import { Migration } from "./types";
import { logger } from "../utils/logger";
export const migrations: Migration[] = [
  {
    name: "Add soft delete support",
    version: "20260107001",
    up: async () => {
      logger.info(
        "📊 Migration 20260107001: 'Add soft delete support' - Please run the following SQL file manually:",
        { file: "20260107001-add-soft-delete.sql", action: "up", location: "Supabase SQL Editor" }
      );
    },
    down: async () => {
      logger.info(
        "🔄 Rollback 20260107001: 'Add soft delete support' - Please run the DOWN migration in the following SQL file:",
        { file: "20260107001-add-soft-delete.sql", action: "down" }
      );
    },
  },
  {
    name: "Convert JSON fields to JSONB",
    version: "20260107002",
    up: async () => {
      logger.info(
        "📊 Migration 20260107002: 'Convert JSON fields to JSONB' - Please run the following SQL file manually:",
        { file: "20260107002-convert-jsonb.sql", action: "up", location: "Supabase SQL Editor" }
      );
    },
    down: async () => {
      logger.info(
        "🔄 Rollback 20260107002: 'Convert JSON fields to JSONB' - Please run the DOWN migration in the following SQL file:",
        { file: "20260107002-convert-jsonb.sql", action: "down" }
      );
    },
  },
  {
    name: "Fix sessions.expires_at type inconsistency",
    version: "20260110001",
    up: async () => {
      logger.info(
        "📊 Migration 20260110001: 'Fix sessions.expires_at type inconsistency' - Please run the following SQL file manually:",
        { file: "20260110001-fix-sessions-timestamp.sql", action: "up", location: "Supabase SQL Editor" }
      );
    },
    down: async () => {
      logger.info(
        "🔄 Rollback 20260110001: 'Fix sessions.expires_at type inconsistency' - Please run the DOWN migration in the following SQL file:",
        { file: "20260110001-fix-sessions-timestamp.sql", action: "down" }
      );
    },
  },
  {
    name: "Add timestamp validation constraints",
    version: "20260110002",
    up: async () => {
      logger.info(
        "📊 Migration 20260110002: 'Add timestamp validation constraints' - Please run the following SQL file manually:",
        { file: "20260110002-add-timestamp-constraints.sql", action: "up", location: "Supabase SQL Editor" }
      );
    },
    down: async () => {
      logger.info(
        "🔄 Rollback 20260110002: 'Add timestamp validation constraints' - Please run the DOWN migration in the following SQL file:",
        { file: "20260110002-add-timestamp-constraints.sql", action: "down" }
      );
    },
  },
  {
    name: "Add asset-entry foreign key relationship",
    version: "20260110003",
    up: async () => {
      logger.info(
        "📊 Migration 20260110003: 'Add asset-entry foreign key relationship' - Please run the following SQL file manually:",
        { file: "20260110003-add-asset-entry-relationship.sql", action: "up", location: "Supabase SQL Editor" }
      );
    },
    down: async () => {
      logger.info(
        "🔄 Rollback 20260110003: 'Add asset-entry foreign key relationship' - Please run the DOWN migration in the following SQL file:",
        { file: "20260110003-add-asset-entry-relationship.sql", action: "down" }
      );
    },
  },
  {
    name: "Add missing created_at indexes",
    version: "20260110004",
    up: async () => {
      logger.info(
        "📊 Migration 20260110004: 'Add missing created_at indexes' - Please run the following SQL file manually:",
        { file: "20260110004-add-created-at-indexes.sql", action: "up", location: "Supabase SQL Editor" }
      );
    },
    down: async () => {
      logger.info(
        "🔄 Rollback 20260110004: 'Add missing created_at indexes' - Please run the DOWN migration in the following SQL file:",
        { file: "20260110004-add-created-at-indexes.sql", action: "down" }
      );
    },
  },
  {
    name: "Add created_at indexes for users and sessions",
    version: "20260221001",
    up: async () => {
      logger.info(
        "📊 Migration 20260221001: 'Add created_at indexes for users and sessions' - Please run the following SQL file manually:",
        { file: "20260221001-add-users-sessions-created-at-indexes.sql", action: "up", location: "Supabase SQL Editor" }
      );
    },
    down: async () => {
      logger.info(
        "🔄 Rollback 20260221001: 'Add created_at indexes for users and sessions' - Please run the DOWN migration in the following SQL file:",
        { file: "20260221001-add-users-sessions-created-at-indexes.sql", action: "down" }
      );
    },
  },
  {
    name: "Add updated_at indexes for frequently updated tables",
    version: "20260221002",
    up: async () => {
      logger.info(
        "📊 Migration 20260221002: 'Add updated_at indexes for frequently updated tables' - Please run the following SQL file manually:",
        { file: "20260221002-add-updated-at-indexes.sql", action: "up", location: "Supabase SQL Editor" }
      );
    },
    down: async () => {
      logger.info(
        "🔄 Rollback 20260221002: 'Add updated_at indexes for frequently updated tables' - Please run the DOWN migration in the following SQL file:",
        { file: "20260221002-add-updated-at-indexes.sql", action: "down" }
      );
    },
  },
  {
    name: "Add updated_at indexes for users and sessions",
    version: "20260221003",
    up: async () => {
      logger.info(
        "📊 Migration 20260221003: 'Add updated_at indexes for users and sessions' - Please run the following SQL file manually:",
        { file: "20260221003-add-users-sessions-updated-at-indexes.sql", action: "up", location: "Supabase SQL Editor" }
      );
    },
    down: async () => {
      logger.info(
        "🔄 Rollback 20260221003: 'Add updated_at indexes for users and sessions' - Please run the DOWN migration in the following SQL file:",
        { file: "20260221003-add-users-sessions-updated-at-indexes.sql", action: "down" }
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
