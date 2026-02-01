# Skill: Git Commit Message

Source: vasilyu1983-ai-agents-public-git-commit-message (via SkillHub)

Generate high-quality, conventional commit messages.

## Commands

- Analyze changes: Review git diff to understand changes
- Generate message: Create clear, conventional commit message
- Follow conventions: Use Conventional Commits format

## Commit Message Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

## Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc)
- **refactor**: Code refactoring
- **test**: Test changes
- **chore**: Build/config/tooling changes

## Best Practices

- Use imperative mood ("Add" not "Added")
- Keep subject line under 50 characters
- Use body for detailed explanations
- Reference issues in footer
- Be specific about what changed

## Examples

```
feat(auth): add OAuth2 login support

Implement Google and GitHub OAuth2 providers.
Adds login buttons to navbar and handles callback.

Closes #123
```

```
fix(api): resolve race condition in user cache

Prevent concurrent updates from corrupting cache state.
Add mutex around cache write operations.

Fixes #456
```
