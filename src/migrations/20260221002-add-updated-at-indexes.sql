-- Migration: Add updated_at indexes for frequently updated tables
-- Version: 20260221002
-- Description: Adds indexes on updated_at columns to optimize "recently modified" queries
--              for content_types, entries, and assets tables.

-- ============================================================================
-- UP MIGRATION
-- ============================================================================

-- Add updated_at index for content_types
-- Purpose: Optimize queries that list content types sorted by modification date
CREATE INDEX IF NOT EXISTS idx_content_types_updated_at
  ON content_types(updated_at DESC)
  WHERE deleted_at IS NULL;

-- Add updated_at index for entries
-- Purpose: Optimize "recently modified" entry queries, a common pattern in CMS
CREATE INDEX IF NOT EXISTS idx_entries_updated_at
  ON entries(updated_at DESC)
  WHERE deleted_at IS NULL;

-- Add updated_at index for assets
-- Purpose: Optimize queries that list assets sorted by modification date
CREATE INDEX IF NOT EXISTS idx_assets_updated_at
  ON assets(updated_at DESC)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- DOWN MIGRATION (Rollback)
-- ============================================================================

/*
-- Remove updated_at indexes
DROP INDEX IF EXISTS idx_content_types_updated_at;
DROP INDEX IF EXISTS idx_entries_updated_at;
DROP INDEX IF EXISTS idx_assets_updated_at;
*/
