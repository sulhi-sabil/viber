-- Migration: Fix sessions.expires_at type inconsistency
-- Version: 20260110001
-- Description: Convert sessions.expires_at from BIGINT to TIMESTAMPTZ for consistency

-- Up migration
BEGIN;

-- Add new TIMESTAMPTZ column
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at_new TIMESTAMPTZ;

-- Convert existing BIGINT timestamps (milliseconds) to TIMESTAMPTZ
UPDATE sessions
SET expires_at_new = TO_TIMESTAMP(expires_at / 1000.0)
WHERE expires_at_new IS NULL;

-- Drop indexes on old column
DROP INDEX IF EXISTS idx_sessions_expires_at;
DROP INDEX IF EXISTS idx_sessions_user_expires;

-- Drop old column
ALTER TABLE sessions DROP COLUMN IF EXISTS expires_at;

-- Rename new column to original name
ALTER TABLE sessions RENAME COLUMN expires_at_new TO expires_at;

-- Recreate indexes with proper TIMESTAMPTZ type
CREATE INDEX idx_sessions_expires_at
  ON sessions(expires_at)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_sessions_user_expires
  ON sessions(user_id, expires_at)
  WHERE deleted_at IS NULL;

-- Update cleanup function to use TIMESTAMPTZ comparison
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM sessions
    WHERE expires_at < NOW()
    RETURNING id INTO deleted_count;

    RETURN COALESCE(deleted_count, 0);
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- Down migration
BEGIN;

-- Add new BIGINT column
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at_new BIGINT;

-- Convert existing TIMESTAMPTZ to BIGINT (milliseconds)
UPDATE sessions
SET expires_at_new = EXTRACT(EPOCH FROM expires_at) * 1000
WHERE expires_at_new IS NULL;

-- Drop indexes on TIMESTAMPTZ column
DROP INDEX IF EXISTS idx_sessions_expires_at;
DROP INDEX IF EXISTS idx_sessions_user_expires;

-- Drop TIMESTAMPTZ column
ALTER TABLE sessions DROP COLUMN IF EXISTS expires_at;

-- Rename new column to original name
ALTER TABLE sessions RENAME COLUMN expires_at_new TO expires_at;

-- Recreate indexes with BIGINT type
CREATE INDEX idx_sessions_expires_at
  ON sessions(expires_at)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_sessions_user_expires
  ON sessions(user_id, expires_at)
  WHERE deleted_at IS NULL;

-- Restore cleanup function to use BIGINT comparison
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM sessions
    WHERE expires_at < EXTRACT(EPOCH FROM NOW()) * 1000
    RETURNING id INTO deleted_count;

    RETURN COALESCE(deleted_count, 0);
END;
$$ LANGUAGE plpgsql;

COMMIT;
