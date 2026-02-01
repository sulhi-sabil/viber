# Skill: Code Analysis

Analyze code for bugs, anti-patterns, and quality issues.

## Commands

- Search for TODO/FIXME: `grep -r "TODO\|FIXME" src/`
- Find unused code: `npx unimported` or `npx depcheck`
- Check test coverage: `npm test -- --coverage`
- Lint check: `npm run lint`

## Patterns to Detect

1. **Resource Leaks**
   - Unref'd timers
   - Unclosed connections
   - Memory leaks in closures

2. **Null Safety**
   - Array access without bounds check
   - Object property access without null check
   - Optional chaining opportunities

3. **Async Issues**
   - Unhandled promise rejections
   - Missing await
   - Race conditions

4. **Code Smells**
   - Magic numbers
   - Duplicated code
   - Long functions
   - Deep nesting
