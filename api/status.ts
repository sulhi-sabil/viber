import type { VercelRequest, VercelResponse } from "@vercel/node";
import { json } from "./_lib/response";
import { getServiceFactory, getGemini } from "./_lib/services";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const factory = getServiceFactory();
  const circuitBreakerStates = factory.getAllCircuitBreakerStates();

  const rateLimiters: Record<string, unknown> = {};

  const gemini = getGemini();
  if (gemini) {
    try {
      const status = gemini.getRateLimiterStatus();
      rateLimiters.gemini = status;
    } catch (err) {
      console.warn("Failed to get rate limiter status:", err);
      rateLimiters.gemini = null;
    }
  }

  json(res, {
    circuitBreakers: circuitBreakerStates,
    rateLimiters,
    timestamp: new Date().toISOString(),
  });
}
