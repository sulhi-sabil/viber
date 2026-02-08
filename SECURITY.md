# Security Policy

## Supported Versions

We release security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please report security issues via:

1. **GitHub Security Advisories**: [Report a vulnerability](https://github.com/sulhi-sabil/viber/security/advisories/new)
2. **Email**: Contact the maintainers directly (if you have their contact information)

### What to Include

When reporting a vulnerability, please include:

- **Description**: Clear description of the vulnerability
- **Impact**: What could an attacker do with this vulnerability?
- **Steps to Reproduce**: Detailed steps to reproduce the issue
- **Affected Versions**: Which versions are affected?
- **Suggested Fix**: If you have suggestions for fixing the issue
- **Your Contact**: How can we reach you for follow-up questions?

### Response Timeline

We aim to respond to security reports within:

- **24 hours**: Acknowledgment of receipt
- **72 hours**: Initial assessment and next steps
- **7 days**: Status update on fix progress
- **30 days**: Resolution or mitigation plan

### What to Expect

1. **Acknowledgment**: We'll confirm receipt of your report
2. **Assessment**: We'll evaluate the severity and impact
3. **Fix Development**: We'll work on a fix or mitigation
4. **Disclosure**: We'll coordinate disclosure with you
5. **Credit**: We'll credit you for the discovery (if desired)

## Security Best Practices for Users

### API Keys and Secrets

- Never commit API keys or secrets to version control
- Use environment variables for sensitive configuration
- Rotate API keys regularly
- Use the principle of least privilege for API keys

```typescript
// ❌ Bad - Hardcoded credentials
const supabase = createSupabaseClient({
  url: "https://your-project.supabase.co",
  anonKey: "your-actual-key-here", // Never do this!
});

// ✅ Good - Environment variables
const supabase = createSupabaseClient({
  url: process.env.SUPABASE_URL!,
  anonKey: process.env.SUPABASE_ANON_KEY!,
});
```

### Input Validation

Always validate and sanitize user input:

```typescript
import { Validator } from "viber-integration-layer";

// Validate email
Validator.email(userInput, "email");

// Sanitize input
const cleanInput = Validator.sanitize(userInput, {
  trim: true,
  escapeHtml: true,
});
```

### Circuit Breaker Configuration

Use appropriate circuit breaker settings to prevent abuse:

```typescript
const factory = ServiceFactory.getInstance({
  supabase: {
    failureThreshold: 5,
    resetTimeout: 60000,
  },
  gemini: {
    failureThreshold: 3,
    resetTimeout: 30000,
  },
});
```

### Rate Limiting

Respect API rate limits to avoid service disruption:

```typescript
const limiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60000,
  serviceName: "MyAPI",
});

await limiter.checkRateLimit();
```

### Logging Sensitive Data

The built-in logger automatically redacts sensitive data:

```typescript
import { logger } from "viber-integration-layer";

// Passwords, API keys, tokens are automatically redacted
logger.info("User action", {
  userId: "123",
  password: "secret", // Will be [REDACTED]
  apiKey: "sk-123", // Will be [REDACTED]
});
```

### Dependencies

Keep dependencies up to date:

```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Update dependencies
npm update
```

## Security Features

### Built-in Protections

This library includes several security features:

1. **Automatic Secret Redaction**: The logger automatically redacts sensitive fields
2. **Input Validation**: Comprehensive validation utilities
3. **Circuit Breakers**: Protection against cascading failures
4. **Rate Limiting**: Prevents API abuse
5. **Timeout Handling**: Prevents hanging requests
6. **Idempotency**: Prevents duplicate operations

### Security-Related Configuration

```typescript
// Maximum retry attempts to prevent infinite loops
const maxRetries = 3;

// Request timeout to prevent hanging
const timeout = 10000;

// Circuit breaker to prevent cascade failures
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000,
});
```

## Known Security Considerations

### Current Limitations

- The library does not encrypt data at rest (handled by services)
- TLS/SSL is assumed to be handled at the transport layer
- No built-in authentication (use service-specific auth)

### Future Improvements

We're continuously working to improve security:

- [ ] Add request signing capabilities
- [ ] Implement request ID tracing
- [ ] Add audit logging
- [ ] Enhanced secret management

## Vulnerability Disclosure Policy

We follow responsible disclosure:

1. **Private Reporting**: Vulnerabilities are reported privately
2. **Assessment**: We assess severity using CVSS v3.1
3. **Fix Development**: We develop and test a fix
4. **Coordinated Disclosure**: We coordinate public disclosure with the reporter
5. **Post-Disclosure**: We publish a security advisory

## Credits

We thank the following security researchers who have responsibly disclosed vulnerabilities:

_No vulnerabilities have been reported yet. Be the first!_

## Contact

For security-related questions:

- GitHub Security Advisories: [Security tab](https://github.com/sulhi-sabil/viber/security)

---

Last Updated: 2026-02-08
