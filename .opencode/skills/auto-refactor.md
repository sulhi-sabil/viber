# Skill: Auto-Refactoring

Self-modify code to improve quality, performance, and maintainability.

## Commands

- Identify refactor opportunities: Find code smells and improvement areas
- Apply refactorings: Implement safe code transformations
- Verify changes: Ensure refactored code maintains functionality
- Document changes: Record what was changed and why

## Safe Refactoring Rules

1. **Always Verify First**
   - Run tests before refactoring
   - Ensure test coverage exists
   - Verify tests pass after refactoring

2. **Incremental Changes**
   - One refactoring at a time
   - Small, focused changes
   - Commit after each successful refactoring

3. **Preserve Behavior**
   - No functional changes
   - Only structural improvements
   - Maintain API compatibility

## Common Refactorings

- Extract function/method
- Rename for clarity
- Remove duplication
- Simplify conditionals
- Improve error handling
- Optimize imports
