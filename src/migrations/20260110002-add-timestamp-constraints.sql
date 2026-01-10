-- Migration: Add timestamp validation constraints
-- Version: 20260110002
-- Description: Add check constraints to ensure updated_at >= created_at for data integrity

-- Up migration
BEGIN;

-- Add timestamp validation constraint to users table
ALTER TABLE users ADD CONSTRAINT chk_users_timestamps
  CHECK (updated_at >= created_at);

-- Add timestamp validation constraint to sessions table
ALTER TABLE sessions ADD CONSTRAINT chk_sessions_timestamps
  CHECK (updated_at >= created_at);

-- Add timestamp validation constraint to content_types table
ALTER TABLE content_types ADD CONSTRAINT chk_content_types_timestamps
  CHECK (updated_at >= created_at);

-- Add timestamp validation constraint to entries table
ALTER TABLE entries ADD CONSTRAINT chk_entries_timestamps
  CHECK (updated_at >= created_at);

-- Add timestamp validation constraint to assets table
ALTER TABLE assets ADD CONSTRAINT chk_assets_timestamps
  CHECK (updated_at >= created_at);

COMMIT;

-- Down migration
BEGIN;

-- Drop timestamp validation constraints
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_timestamps;
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS chk_sessions_timestamps;
ALTER TABLE content_types DROP CONSTRAINT IF EXISTS chk_content_types_timestamps;
ALTER TABLE entries DROP CONSTRAINT IF EXISTS chk_entries_timestamps;
ALTER TABLE assets DROP CONSTRAINT IF EXISTS chk_assets_timestamps;

COMMIT;
