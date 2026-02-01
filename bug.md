# Bugs Found

## Phase 1 - BugLover Discovery

### Active Bugs

[ ] bug: npm deprecated warnings - inflight@1.0.6 has memory leak, glob@7.2.3 no longer supported
[ ] bug: docs/task.md statistics inconsistent - shows 0 blocked tasks but CI01 is marked as blocked

### Fixed Bugs

[x] bug: Jest worker processes fail to exit gracefully due to unref'd timers in retry.ts (line 146) and rate-limiter.ts (line 142) - Fixed by adding .unref() to all setTimeout calls
[x] bug: rate-limiter.ts line 58 - accessing this.requests[0] without bounds checking could cause undefined access - Fixed by adding bounds check before accessing array
[x] bug: idempotency.ts line 49 - ESLint disable comment for unused-vars is misleading (expiresAt IS used in destructuring) - Fixed by removing unnecessary comment

## Bug Details

### BUG-001: Resource Leak in Timers

**Severity**: Medium
**Location**: src/utils/retry.ts:146, src/utils/rate-limiter.ts:142
**Issue**: setTimeout calls don't use .unref(), preventing Jest from exiting cleanly
**Impact**: Test suite shows "worker process has failed to exit gracefully" warning
**Fix**: Add .unref() to setTimeout calls or track and clear timers

### BUG-002: Deprecated Dependencies

**Severity**: Low
**Location**: package.json dependencies
**Issue**: inflight@1.0.6 has known memory leak, glob@7.2.3 is deprecated
**Impact**: Technical debt, potential security/maintenance issues
**Fix**: Update dependencies or find alternatives

### BUG-003: Documentation Inconsistency

**Severity**: Low
**Location**: docs/task.md line ~835
**Issue**: Task statistics show "Blocked: 0" but CI01 workflow fix is marked as blocked
**Impact**: Confusing project status tracking
**Fix**: Update statistics to reflect actual blocked count (1)

### BUG-004: RateLimiter Array Access

**Severity**: Low
**Location**: src/utils/rate-limiter.ts:58
**Issue**: Accessing this.requests[0] without checking if array is empty first
**Impact**: Could result in undefined behavior if array is unexpectedly empty
**Fix**: Add bounds check before accessing array elements

### BUG-005: Misleading ESLint Comment

**Severity**: Low  
**Location**: src/utils/idempotency.ts:49
**Issue**: Comment says "eslint-disable-next-line @typescript-eslint/no-unused-vars" but expiresAt IS used in destructuring
**Impact**: Code quality/maintainability
**Fix**: Remove unnecessary eslint disable comment

## Error Log

[ ] error: Worker process failed to exit gracefully - active timers detected in test suite
