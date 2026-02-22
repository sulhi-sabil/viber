import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getServiceFactory } from "./_lib/services";


export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }


  const metricsToken = process.env.METRICS_BEARER_TOKEN;
  if (metricsToken) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const providedToken = authHeader.substring(7);
    // Use timing-safe comparison to prevent timing attacks
    if (!timingSafeEqual(providedToken, metricsToken)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  try {
    const factory = getServiceFactory();
    const metrics = factory.exportMetrics();

    // Prometheus scraper expects text/plain
    res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.status(200).send(metrics);
  } catch (error) {
    // Return error as Prometheus comment (lines starting with # are ignored)
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res
      .status(500)
      .send(`# ERROR: Failed to export metrics: ${errorMessage}\n`);
  }
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
