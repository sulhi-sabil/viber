# Database Migrations

This directory contains database migrations for the Viber Integration Layer.

## Migration System

The migration system provides:

- **Versioned migrations**: Each migration has a unique version number
- **Up/Down scripts**: Every migration can be rolled back
- **Safe execution**: Migrations are designed to be reversible
- **SQL-based**: Migrations are written as SQL for clarity and portability

## File Structure

```
migrations/
├── types.ts              # TypeScript type definitions
├── runner.ts             # Migration runner implementation
├── index.ts             # Migration registry
├── 20260107001-*.sql   # Migration files
└── 20260107002-*.sql   # Migration files
```

## Naming Convention

Migration files follow the pattern: `YYYYMMDDVV-name.sql`

- `YYYYMMDD`: Date (year, month, day)
- `VV`: Version number (01, 02, 03, etc.)
- `name`: Descriptive name in kebab-case

Example: `20260107001-add-soft-delete.sql`

## Running Migrations

### Option 1: Manual (Recommended for Supabase)

1. Open Supabase SQL Editor
2. Copy the `-- Up migration` section from the SQL file
3. Execute in Supabase
4. Verify changes

To rollback:

1. Copy the `-- Down migration` section
2. Execute in Supabase SQL Editor
3. Verify changes

### Option 2: Programmatic (Future Enhancement)

```typescript
import { createMigrationRunner } from "../migrations";
import { createSupabaseClient } from "../services/supabase";

const supabase = createSupabaseClient({
  url: process.env.SUPABASE_URL,
  anonKey: process.env.SUPABASE_ANON_KEY,
});

const runner = createMigrationRunner(supabase);

// Run pending migrations
await runner.run();

// Rollback specific version
await runner.rollback("20260107001");

// Rollback all migrations
await runner.rollback();
```

## Existing Migrations

### 20260107001 - Add Soft Delete Support

**Description**: Adds `deleted_at` timestamp to all tables for soft delete functionality

**Changes**:

- Adds `deleted_at TIMESTAMPTZ` column to: users, sessions, content_types, entries, assets
- Creates partial indexes on `deleted_at` for query optimization
- Enables soft delete while maintaining performance

**Rollback**: Removes columns and indexes

### 20260107002 - Convert JSON Fields to JSONB

**Description**: Converts TEXT fields storing JSON to proper JSONB type

**Changes**:

- Converts `content_types.fields_schema` from TEXT to JSONB
- Converts `entries.data` from TEXT to JSONB
- Adds GIN indexes for efficient JSONB queries
- Sets default values to empty JSON object

**Rollback**: Converts back to TEXT and removes indexes

## Creating New Migrations

1. Create new SQL file with appropriate version number
2. Write `-- Up migration` section with changes
3. Write `-- Down migration` section to rollback changes
4. Add migration to `index.ts` registry
5. Test up and down scripts in development database
6. Document migration in this README

## Best Practices

### Migration Safety

- ✅ Always write down scripts
- ✅ Use transactions (`BEGIN`/`COMMIT`)
- ✅ Check for existence before creating (`IF NOT EXISTS`)
- ✅ Use `DROP IF EXISTS` in down scripts
- ✅ Test in development first
- ✅ Keep migrations small and focused
- ✅ One migration per feature/fix

### Performance

- ✅ Use partial indexes for common query patterns
- ✅ Create GIN indexes for JSONB fields
- ✅ Add indexes after data modifications
- ✅ Consider `CONCURRENTLY` for large tables
- ⚠️ Never drop indexes in production without measuring impact

### Data Integrity

- ✅ Add foreign key constraints with appropriate actions
- ✅ Use `ON DELETE CASCADE` for dependent data
- ✅ Use `ON DELETE RESTRICT` for structural tables
- ✅ Add check constraints for enum-like fields
- ✅ Use `ALTER COLUMN ... SET NOT NULL` carefully

## Monitoring

After running migrations, monitor:

1. **Query performance**: Check if new indexes are being used
2. **Storage usage**: JSONB columns use more space than TEXT
3. **Slow queries**: Look for newly introduced performance issues
4. **Application errors**: Ensure code handles new schema

## Troubleshooting

### Migration Fails Mid-Execution

If a migration fails:

1. Check error message for specific issue
2. Manually execute remaining statements
3. Document partial changes
4. Create follow-up migration to fix

### Rollback Fails

If rollback fails:

1. Restore from backup
2. Investigate why rollback failed
3. Create new rollback migration
4. Test thoroughly in development

### Conflicting Migrations

If multiple developers create migrations with same version:

1. Renote one migration with higher version
2. Document the change in commit message
3. Coordinate team on migration execution order
