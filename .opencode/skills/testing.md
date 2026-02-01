# Skill: Testing & Verification

Verify code changes work correctly.

## Commands

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/utils/retry.test.ts

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

## Verification Checklist

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] No new warnings
- [ ] No memory leaks in tests
- [ ] Code coverage maintained

## Test Quality Standards

1. Tests should be deterministic
2. Tests should clean up after themselves
3. No `console.log` in tests (use proper assertions)
4. Clear test descriptions
5. Arrange-Act-Assert pattern
