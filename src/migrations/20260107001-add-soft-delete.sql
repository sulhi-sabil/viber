-- Migration: Add soft delete support
-- Version: 20260107001
-- Description: Add deleted_at timestamp to all tables for soft delete support

-- Up migration
BEGIN;

-- Add deleted_at column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add deleted_at column to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add deleted_at column to content_types table
ALTER TABLE content_types ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add deleted_at column to entries table
ALTER TABLE entries ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add deleted_at column to assets table
ALTER TABLE assets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create partial indexes for non-deleted records
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_sessions_deleted_at ON sessions(deleted_at);
CREATE INDEX IF NOT EXISTS idx_content_types_deleted_at ON content_types(deleted_at);
CREATE INDEX IF NOT EXISTS idx_entries_deleted_at ON entries(deleted_at);
CREATE INDEX IF NOT EXISTS idx_assets_deleted_at ON assets(deleted_at);

COMMIT;

-- Down migration
BEGIN;

-- Drop partial indexes
DROP INDEX IF EXISTS idx_users_deleted_at;
DROP INDEX IF EXISTS idx_sessions_deleted_at;
DROP INDEX IF EXISTS idx_content_types_deleted_at;
DROP INDEX IF EXISTS idx_entries_deleted_at;
DROP INDEX IF EXISTS idx_assets_deleted_at;

-- Remove deleted_at columns
ALTER TABLE users DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE sessions DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE content_types DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE entries DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE assets DROP COLUMN IF EXISTS deleted_at;

COMMIT;
