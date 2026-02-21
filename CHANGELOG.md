# Changelog

All notable changes to the viber-integration-layer project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Cloudflare Workers edge runtime compatibility with `wrangler.toml` configuration
- `src/utils/edge-runtime.ts` - Edge runtime detection and utilities
- `src/utils/formatters.ts` - Human-readable formatting utilities for health checks and metrics
- `src/types/cloudflare.ts` - Cloudflare-specific type definitions
- `.github/CODEOWNERS` - Code ownership definitions for maintainers
- `.github/dependabot.yml` - Automated dependency updates configuration
- `listServices()` method to `ServiceFactory` for service introspection
- Type guards for service instances
- API endpoint constants and sensitive data constants
- LogContext support to Logger with correlation IDs

### Changed

- Improved developer experience (DX) with better type inference
- Enhanced circuit breaker with visual indicators in state transitions
- Modularized constants for better layer purity
- Improved error handling in retry logic with timer leak prevention
- Updated health check with human-readable formatting
- Enhanced rate limiter with better configuration options

### Fixed

- Timer leak in `withTimeout` function in retry utilities
- TypeScript errors in health-check.test.ts
- Inlined constants in service-config.ts for layer purity

### Documentation

- Added historical context to roadmap.md
- Updated improvement-issues.md with current status
- Synced roadmap with actual implementation status

---

## [1.0.0] - 2024-01-07

### Added

- **Core Architecture**
  - BaseService abstract class with lifecycle management
  - ServiceFactory pattern for dependency injection
  - Comprehensive TypeScript type definitions

- **Integrations**
  - Supabase service with connection pooling
  - Gemini AI service with rate limiting
  - Cloudflare API client foundation

- **Resilience Patterns**
  - Circuit breaker with configurable thresholds
  - Retry logic with exponential backoff
  - Combined resilience wrapper
  - Rate limiter with token bucket algorithm
  - Idempotency manager for request deduplication

- **Utilities**
  - Logger with multiple log levels and formatters
  - Validator for input validation
  - Health check system
  - Metrics collection and reporting
  - Configuration management

- **Testing**
  - 96.8% test coverage
  - Integration tests for all services
  - Unit tests for utilities

- **Documentation**
  - Comprehensive README with API reference
  - Architecture blueprint
  - Contributing guidelines
  - Security policy
  - Strategic roadmap

### Security

- Input validation on all public methods
- Sensitive data redaction in logs
- Rate limiting for API protection
- Secure credential management

---

## Version History Summary

| Version    | Release Date | Key Features                              |
| ---------- | ------------ | ----------------------------------------- |
| Unreleased | -            | Edge runtime, formatters, DX improvements |
| 1.0.0      | 2024-01-07   | Foundation release with core integrations |

---

[Unreleased]: https://github.com/sulhi-sabil/viber/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/sulhi-sabil/viber/releases/tag/v1.0.0
