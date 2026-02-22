# Vercel Deployment Guide

## Prerequisites

- Vercel CLI: `npm i -g vercel`
- Node.js 18+

## Environment Variables

Set these in Vercel dashboard (Project → Settings → Environment Variables):

| Variable                    | Required | Description               |
| --------------------------- | -------- | ------------------------- |
| `SUPABASE_URL`              | Optional | Supabase project URL      |
| `SUPABASE_ANON_KEY`         | Optional | Supabase anonymous key    |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Supabase service role key |
| `GEMINI_API_KEY`            | Optional | Google Gemini API key     |

## Deploy Steps

1. **Install Vercel CLI**

   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**

   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel --prod
   ```

## API Endpoints

| Endpoint           | Method | Description                                                              |
| ------------------ | ------ | ------------------------------------------------------------------------ |
| `/api/health`      | GET    | Full health check with service status (200 if healthy, 503 if unhealthy) |
| `/api/status`      | GET    | Detailed status of all services                                          |
| `/api/ai/generate` | POST   | AI text generation using Gemini                                          |

## Accessing Endpoints

```bash
# Health check
curl https://your-app.vercel.app/api/health

# Status
curl https://your-app.vercel.app/api/status

# AI generation
curl -X POST https://your-app.vercel.app/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello, world!"}'
```

## Function Configuration

Defined in `vercel.json`:

- **Memory**: 1024 MB
- **Max Duration**: 30 seconds
- **Runtime**: Node.js (default)
- **Fluid Compute**: Enabled

### Security Headers

All routes include:

- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
- Referrer-Policy: strict-origin-when-cross-origin

API routes additionally include:

- Cache-Control: no-store, no-cache, must-revalidate

## Monitoring

- **Health**: Configure Vercel Health Checks to ping `/api/health`
- **Status**: Use `/api/status` for detailed service status
- **Logs**: View in Vercel dashboard under Deployments → Logs

## Architecture

This project is a TypeScript library (`viber-integration-layer`) with serverless API endpoints:

- **Library Core**: `src/` → compiled to `dist/`
  - Resilience patterns (circuit breaker, retry, rate limiting)
  - Service integrations (Supabase, Gemini)
  - Health check and metrics systems

- **Serverless Functions**: `api/` → deployed by Vercel
  - `health.ts` - Full health check
  - `status.ts` - Detailed service status
  - `ai/generate.ts` - AI text generation
  - `_lib/` - Shared utilities

## Security Notes

1. **API Keys**: Mark sensitive values (API keys) as "Sensitive" in Vercel dashboard.
2. **CORS**: If needed, configure in `vercel.json` under `headers`.
3. **Rate Limiting**: Built-in rate limiting available via the library's resilience patterns.
