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

## Common Test Patterns

### Mocking External Dependencies

```typescript
// Mock Supabase client
jest.mock("../lib/supabase", () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockResolvedValue({ data: [], error: null }),
  },
}));

// Mock Gemini API
jest.mock("../lib/gemini", () => ({
  generateContent: jest.fn().mockResolvedValue("response"),
}));
```

### Testing Async Code

```typescript
// Promise resolution
it("should handle async operations", async () => {
  const result = await service.getData();
  expect(result).toBeDefined();
});

// Promise rejection
it("should handle errors", async () => {
  await expect(service.failingCall()).rejects.toThrow(Error);
});
```

### Testing Rate Limiters & Circuit Breakers

```typescript
it("should open circuit after threshold", () => {
  const breaker = new CircuitBreaker({ threshold: 3 });
  for (let i = 0; i < 3; i++) breaker.recordFailure();
  expect(breaker.isOpen).toBe(true);
});
```

## Troubleshooting

| Issue            | Solution                                        |
| ---------------- | ----------------------------------------------- |
| Tests timeout    | Increase timeout: `jest.setTimeout(10000)`      |
| Mock not working | Check import path matches mock path exactly     |
| Flaky tests      | Ensure cleanup in `afterEach()`                 |
| Coverage drops   | Run `npm test -- --coverage` to identify gaps   |
| Memory leaks     | Check for unclosed connections/handles in tests |
