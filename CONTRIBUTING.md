# Contributing to Viber Integration Layer

First off, thank you for considering contributing to Viber Integration Layer! It's people like you that make this project a great tool for the community.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Community](#community)

## Code of Conduct

This project and everyone participating in it is governed by our commitment to professionalism and respect. By participating, you are expected to uphold a respectful and constructive environment.

### Our Standards

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher
- Git

### Quick Setup

1. Fork the repository on GitHub
2. Clone your fork locally:

   ```bash
   git clone https://github.com/YOUR_USERNAME/viber.git
   cd viber
   ```

3. Install dependencies:

   ```bash
   npm ci
   ```

4. Create a branch for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Setup

### Installation

```bash
# Install dependencies
npm ci

# Run tests to ensure everything works
npm test

# Run linter
npm run lint
```

### Project Structure

```
src/
├── services/          # External API clients (Supabase, Gemini)
├── utils/            # Reusable utilities (Circuit Breaker, Retry, Logger)
├── types/            # TypeScript type definitions
├── config/           # Configuration constants
├── migrations/       # Database migration scripts
└── index.ts          # Public API exports
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Building

```bash
# Build TypeScript
npm run build

# The output will be in the dist/ directory
```

## Coding Standards

We use ESLint and TypeScript to maintain code quality.

### TypeScript Guidelines

- Use strict TypeScript settings
- Avoid `any` type when possible
- Define explicit return types for public functions
- Use interfaces for object shapes
- Leverage union types for better type safety

### Code Style

- 2 spaces for indentation
- Single quotes for strings
- Semicolons are required
- Maximum line length: 100 characters
- Use trailing commas in multi-line objects/arrays

### Linting

```bash
# Check for linting errors
npm run lint

# Fix auto-fixable linting errors
npm run lint -- --fix
```

### Testing Requirements

- All new features must include tests
- Maintain or improve code coverage
- Tests should be deterministic and not depend on external state
- Use descriptive test names that explain the behavior being tested

## Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semi-colons, etc)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

### Examples

```
feat(circuit-breaker): add half-open state timeout

fix(supabase): handle connection timeout error

docs(readme): update installation instructions

refactor(utils): extract common retry logic

test(gemini): add streaming response tests
```

## Pull Request Process

1. **Before Submitting**
   - Ensure all tests pass: `npm test`
   - Ensure linting passes: `npm run lint`
   - Update documentation if needed
   - Add tests for new features

2. **Creating the PR**
   - Use a clear, descriptive title following commit message format
   - Fill out the PR template completely
   - Link any related issues
   - Add appropriate labels

3. **PR Review**
   - At least one review is required before merging
   - Address review comments promptly
   - Keep the PR focused on a single concern

4. **After Merge**
   - Delete your branch after merging
   - Update related documentation if needed

### PR Checklist

- [ ] Tests pass locally
- [ ] Linting passes
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Commit messages follow conventions
- [ ] PR description is clear and complete

## Issue Reporting

### Bug Reports

When reporting bugs, please include:

- **Description**: Clear description of the bug
- **Steps to Reproduce**: Step-by-step instructions
- **Expected Behavior**: What you expected to happen
- **Actual Behavior**: What actually happened
- **Environment**: Node.js version, OS, package version
- **Code Sample**: Minimal reproducible example
- **Logs**: Relevant error messages or logs

### Feature Requests

When requesting features, please include:

- **Description**: Clear description of the feature
- **Use Case**: Why is this feature needed?
- **Proposed Solution**: How should it work?
- **Alternatives**: Any alternative solutions considered
- **Additional Context**: Screenshots, examples, etc.

### Security Issues

**DO NOT** report security issues in public issues. Please see [SECURITY.md](./SECURITY.md) for responsible disclosure guidelines.

## Development Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Test additions/updates

### Keeping Your Fork Updated

```bash
# Add upstream remote (once)
git remote add upstream https://github.com/sulhi-sabil/viber.git

# Fetch upstream changes
git fetch upstream

# Update your main branch
git checkout main
git merge upstream/main

# Update your feature branch
git checkout your-feature-branch
git rebase main
```

## Release Process

Releases are managed by maintainers:

1. Version bump in package.json
2. Update CHANGELOG.md
3. Create git tag
4. Publish to npm (if applicable)
5. Create GitHub release

## Questions?

Feel free to:

- Open an issue for questions
- Start a discussion
- Reach out to maintainers

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing! 🎉
