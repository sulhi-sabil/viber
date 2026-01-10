-- Migration: Add missing created_at indexes for time-based queries
-- Version: 20260110004
-- Description: Add created_at indexes to tables that need time-based ordering

-- Up migration
BEGIN;

-- Add created_at index to content_types for time-based queries
CREATE INDEX IF NOT EXISTS idx_content_types_created_at
  ON content_types(created_at DESC)
  WHERE deleted_at IS NULL;

-- Add created_at index to assets for time-based queries
CREATE INDEX IF NOT EXISTS idx_assets_created_at
  ON assets(created_at DESC)
  WHERE deleted_at IS NULL;

COMMIT;

-- Down migration
BEGIN;

-- Drop created_at indexes
DROP INDEX IF EXISTS idx_content_types_created_at;
DROP INDEX IF EXISTS idx_assets_created_at;

COMMIT;
