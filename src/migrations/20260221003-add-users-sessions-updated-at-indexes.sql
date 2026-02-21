-- Migration: Add updated_at indexes for users and sessions tables
-- Version: 20260221003
-- Description: Completes updated_at index coverage across all tables.
--              Users and sessions were missing from migration 20260221002.

-- ============================================================================
-- UP MIGRATION
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_updated_at 
ON users (updated_at DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_updated_at 
ON sessions (updated_at DESC) 
WHERE deleted_at IS NULL;

-- ============================================================================
-- DOWN MIGRATION (Rollback)
-- ============================================================================

-- Note: DROP INDEX CONCURRENTLY cannot run in a transaction
DROP INDEX CONCURRENTLY IF EXISTS idx_users_updated_at;
DROP INDEX CONCURRENTLY IF EXISTS idx_sessions_updated_at;
