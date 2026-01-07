-- Migration: Convert JSON fields to JSONB
-- Version: 20260107002
-- Description: Convert content_types.fields_schema and entries.data from TEXT to JSONB

-- Up migration
BEGIN;

-- Convert fields_schema to JSONB in content_types
ALTER TABLE content_types 
  ALTER COLUMN fields_schema TYPE JSONB USING fields_schema::jsonb;

-- Convert data to JSONB in entries
ALTER TABLE entries 
  ALTER COLUMN data TYPE JSONB USING data::jsonb;

-- Set default values
ALTER TABLE content_types 
  ALTER COLUMN fields_schema SET DEFAULT '{}'::jsonb;

ALTER TABLE entries 
  ALTER COLUMN data SET DEFAULT '{}'::jsonb;

-- Update NOT NULL constraints if they exist
ALTER TABLE content_types 
  ALTER COLUMN fields_schema SET NOT NULL;

ALTER TABLE entries 
  ALTER COLUMN data SET NOT NULL;

-- Ensure GIN indexes exist for JSONB queries
CREATE INDEX IF NOT EXISTS idx_content_types_fields_schema 
  ON content_types USING GIN(fields_schema);

CREATE INDEX IF NOT EXISTS idx_entries_data 
  ON entries USING GIN(data);

COMMIT;

-- Down migration
BEGIN;

-- Drop GIN indexes
DROP INDEX IF EXISTS idx_content_types_fields_schema;
DROP INDEX IF EXISTS idx_entries_data;

-- Convert JSONB back to TEXT
ALTER TABLE content_types 
  ALTER COLUMN fields_schema TYPE TEXT USING fields_schema::text;

ALTER TABLE entries 
  ALTER COLUMN data TYPE TEXT USING data::text;

-- Remove default values
ALTER TABLE content_types 
  ALTER COLUMN fields_schema DROP DEFAULT;

ALTER TABLE entries 
  ALTER COLUMN data DROP DEFAULT;

COMMIT;
