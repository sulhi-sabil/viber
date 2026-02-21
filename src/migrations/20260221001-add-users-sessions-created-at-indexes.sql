-- Migration: Add created_at indexes for users and sessions tables
-- Version: 20260221001
-- Description: Add missing created_at indexes to users and sessions tables for consistency
--              with other tables and improved time-based query performance

-- Up migration
BEGIN;

-- Add created_at index to users for time-based queries
-- Useful for: user activity reports, user listing sorted by registration date
CREATE INDEX IF NOT EXISTS idx_users_created_at
  ON users(created_at DESC)
  WHERE deleted_at IS NULL;

-- Add created_at index to sessions for time-based queries
-- Useful for: session activity reports, recent login tracking
CREATE INDEX IF NOT EXISTS idx_sessions_created_at
  ON sessions(created_at DESC)
  WHERE deleted_at IS NULL;

COMMIT;

-- Down migration
BEGIN;

-- Drop created_at indexes
DROP INDEX IF EXISTS idx_users_created_at;
DROP INDEX IF EXISTS idx_sessions_created_at;

COMMIT;
