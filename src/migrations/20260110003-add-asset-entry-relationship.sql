-- Migration: Add asset-entry foreign key relationship
-- Version: 20260110003
-- Description: Add foreign key to link assets with entries for better data integrity

-- Up migration
BEGIN;

-- Add entry_id column to assets table
ALTER TABLE assets ADD COLUMN IF NOT EXISTS entry_id UUID REFERENCES entries(id) ON DELETE SET NULL;

-- Create index for entry_id lookup
CREATE INDEX idx_assets_entry_id ON assets(entry_id) WHERE deleted_at IS NULL;

COMMIT;

-- Down migration
BEGIN;

-- Drop index
DROP INDEX IF EXISTS idx_assets_entry_id;

-- Drop entry_id column
ALTER TABLE assets DROP COLUMN IF EXISTS entry_id;

COMMIT;
