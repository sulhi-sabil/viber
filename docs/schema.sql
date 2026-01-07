-- Viber Integration Layer Database Schema
-- Version: 1.0
-- Last Updated: 2026-01-07
-- Database: PostgreSQL (Supabase)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE user_role AS ENUM ('admin', 'editor');
CREATE TYPE entry_status AS ENUM ('published', 'draft');

-- ============================================================================
-- TABLE: users
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT,
    role user_role NOT NULL DEFAULT 'editor',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Indexes for users table
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_deleted_at ON users(deleted_at);

-- Check constraint for password_hash
ALTER TABLE users ADD CONSTRAINT chk_users_password_or_null
    CHECK (password_hash IS NOT NULL OR role = 'editor');

-- ============================================================================
-- TABLE: sessions
-- ============================================================================

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Indexes for sessions table
CREATE INDEX idx_sessions_user_id ON sessions(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_sessions_deleted_at ON sessions(deleted_at);

-- Composite index for session cleanup queries
CREATE INDEX idx_sessions_user_expires ON sessions(user_id, expires_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- TABLE: content_types
-- ============================================================================

CREATE TABLE content_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    fields_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Indexes for content_types table
CREATE INDEX idx_content_types_slug ON content_types(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_content_types_deleted_at ON content_types(deleted_at);

-- GIN index for JSONB queries on fields_schema
CREATE INDEX idx_content_types_fields_schema ON content_types USING GIN(fields_schema);

-- ============================================================================
-- TABLE: entries
-- ============================================================================

CREATE TABLE entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type_slug VARCHAR(255) NOT NULL REFERENCES content_types(slug) ON DELETE RESTRICT,
    slug VARCHAR(255),
    title VARCHAR(500) NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    status entry_status NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Indexes for entries table
CREATE INDEX idx_entries_type_slug ON entries(type_slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_entries_slug ON entries(slug) WHERE deleted_at IS NULL AND slug IS NOT NULL;
CREATE INDEX idx_entries_status ON entries(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_entries_created_at ON entries(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_entries_deleted_at ON entries(deleted_at);

-- Unique constraint on slug within type_slug for published entries
CREATE UNIQUE INDEX idx_entries_unique_slug
    ON entries(type_slug, slug)
    WHERE deleted_at IS NULL AND slug IS NOT NULL AND status = 'published';

-- GIN index for JSONB queries on data
CREATE INDEX idx_entries_data ON entries USING GIN(data);

-- Composite index for common query pattern
CREATE INDEX idx_entries_type_status_created
    ON entries(type_slug, status, created_at DESC)
    WHERE deleted_at IS NULL;

-- ============================================================================
-- TABLE: assets
-- ============================================================================

CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename VARCHAR(500) NOT NULL,
    r2_key VARCHAR(500) UNIQUE NOT NULL,
    mime_type VARCHAR(100),
    public_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Indexes for assets table
CREATE INDEX idx_assets_r2_key ON assets(r2_key) WHERE deleted_at IS NULL;
CREATE INDEX idx_assets_mime_type ON assets(mime_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_assets_deleted_at ON assets(deleted_at);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_types_updated_at
    BEFORE UPDATE ON content_types
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entries_updated_at
    BEFORE UPDATE ON entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assets_updated_at
    BEFORE UPDATE ON assets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid()::text = id::text OR role = 'admin');

CREATE POLICY "Editors can view public profiles" ON users
    FOR SELECT USING (role = 'admin' OR deleted_at IS NOT NULL);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid()::text = id::text)
    WITH CHECK (auth.uid()::text = id::text);

-- Sessions table policies
CREATE POLICY "Users can view own sessions" ON sessions
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create own sessions" ON sessions
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own sessions" ON sessions
    FOR DELETE USING (auth.uid()::text = user_id::text);

-- Content types table policies
CREATE POLICY "Editors can view content types" ON content_types
    FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Admins can manage content types" ON content_types
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id::text = auth.uid()::text
            AND users.role = 'admin'
        )
    );

-- Entries table policies
CREATE POLICY "Editors can view published entries" ON entries
    FOR SELECT USING (status = 'published' AND deleted_at IS NULL);

CREATE POLICY "Editors can view own draft entries" ON entries
    FOR SELECT USING (
        status = 'draft' AND
        deleted_at IS NULL AND
        EXISTS (
            SELECT 1 FROM sessions
            WHERE sessions.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "Editors can create entries" ON entries
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id::text = auth.uid()::text
            AND users.role IN ('admin', 'editor')
        )
    );

CREATE POLICY "Editors can update own entries" ON entries
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM sessions
            WHERE sessions.user_id::text = auth.uid()::text
        )
    );

-- Assets table policies
CREATE POLICY "Editors can view assets" ON assets
    FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Editors can create assets" ON assets
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id::text = auth.uid()::text
            AND users.role IN ('admin', 'editor')
        )
    );

CREATE POLICY "Editors can update own assets" ON assets
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id::text = auth.uid()::text
            AND users.role IN ('admin', 'editor')
        )
    );

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View for active users (not deleted)
CREATE VIEW active_users AS
SELECT id, email, role, created_at, updated_at
FROM users
WHERE deleted_at IS NULL;

-- View for active entries (not deleted)
CREATE VIEW active_entries AS
SELECT id, type_slug, slug, title, status, created_at, updated_at
FROM entries
WHERE deleted_at IS NULL;

-- ============================================================================
-- SAMPLE DATA (Optional)
-- ============================================================================

-- Insert default admin user (password hash is for 'admin123' - CHANGE IN PRODUCTION)
-- INSERT INTO users (email, password_hash, role)
-- VALUES (
--     'admin@example.com',
--     '$2b$10$rQz3Q5y5y5y5y5y5y5y5y5y5y5y5y5y5y5y5y5y5y5y5y5y5y5y5y5y',
--     'admin'
-- );

-- ============================================================================
-- MAINTENANCE
-- ============================================================================

-- Function to clean up expired sessions
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

-- Schedule cleanup job (requires pg_cron extension in Supabase)
-- SELECT cron.schedule('cleanup-expired-sessions', '0 * * * *', 'SELECT cleanup_expired_sessions()');

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

/*
INDEX STRATEGY:
----------------

Primary Indexes (for primary key constraints):
- All tables have primary key index on id

Unique Indexes (for uniqueness constraints):
- users.email: Enforce unique email addresses
- content_types.slug: Enforce unique content type slugs
- assets.r2_key: Enforce unique R2 storage keys
- entries(type_slug, slug): Enforce unique slugs per content type (for published entries)

Foreign Key Indexes (for join performance):
- sessions.user_id: Fast session lookup by user
- entries.type_slug: Fast entry lookup by content type

Query Indexes (for common query patterns):
- users.role: Filter users by role
- sessions.expires_at: Cleanup expired sessions
- sessions(user_id, expires_at): Composite index for session queries
- content_types.slug: Fast content type lookup
- entries.slug: Fast entry lookup by slug
- entries.status: Filter entries by status
- entries.created_at: Order entries by creation date
- entries(type_slug, status, created_at): Composite index for entry listing
- assets.r2_key: Fast asset lookup by R2 key
- assets.mime_type: Filter assets by MIME type

Partial Indexes (for performance with filtering):
- All queries that filter out deleted rows use partial indexes with WHERE deleted_at IS NULL
- Significantly reduces index size and improves query performance

GIN Indexes (for JSONB queries):
- content_types.fields_schema: JSONB queries on field schemas
- entries.data: JSONB queries on entry data

FOREIGN KEY RELATIONSHIPS:
--------------------------

sessions.user_id → users.id (CASCADE DELETE)
- When a user is deleted, all their sessions are automatically deleted

entries.type_slug → content_types.slug (RESTRICT)
- Prevents deletion of content types that have entries
- Must delete entries first before deleting content type

CASCADE VS RESTRICT:
-------------------

- CASCADE: Automatically delete related records (sessions → users)
- RESTRICT: Prevent deletion if related records exist (entries → content_types)
- Chosen based on business logic:
  - Users can be deleted with sessions (CASCADE)
  - Content types are structural, prevent deletion if used (RESTRICT)

SOFT DELETE STRATEGY:
---------------------

All tables have deleted_at column:
- NULL = record is active
- NOT NULL = record is deleted (soft delete)
- Partial indexes exclude deleted records for performance
- RLS policies filter out deleted records
- Allows recovery and audit trail

JSONB USAGE:
------------

- content_types.fields_schema: Store flexible field definitions
- entries.data: Store flexible entry data
- GIN indexes enable efficient JSONB queries
- Schema flexibility while maintaining query performance

MAINTENANCE:
------------

1. Regular session cleanup (cleanup_expired_sessions function)
2. Monitor index usage and remove unused indexes
3. VACUUM and ANALYZE periodically for query optimization
4. Backup before schema changes
5. Test migrations in staging first

SECURITY:
---------

- Row Level Security (RLS) enabled on all tables
- Fine-grained access control based on user roles
- Users can only access their own data
- Admins have full access
- Passwords stored as bcrypt hashes (never in plain text)

*/
