import type { VercelRequest, VercelResponse } from "@vercel/node";
import { json, serviceUnavailable } from "./_lib/response";
import { getSupabase, getGemini, getConfiguredServices } from "./_lib/services";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const configured = getConfiguredServices();
  const healthResults: Record<string, unknown> = {};
  const timestamp = new Date().toISOString();

  const supabase = getSupabase();
  if (supabase) {
    try {
      const health = await supabase.healthCheck();
      healthResults.supabase = health;
    } catch (err) {
      healthResults.supabase = {
        status: "unhealthy",
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  } else {
    healthResults.supabase = {
      status: "not_configured",
      message: "SUPABASE_URL and SUPABASE_ANON_KEY required",
    };
  }

  const gemini = getGemini();
  if (gemini) {
    try {
      const health = await gemini.healthCheck();
      healthResults.gemini = health;
    } catch (err) {
      healthResults.gemini = {
        status: "unhealthy",
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  } else {
    healthResults.gemini = {
      status: "not_configured",
      message: "GEMINI_API_KEY required",
    };
  }

  const allHealthy = Object.values(healthResults).every(
    (r) => (r as { status?: string }).status === "healthy",
  );
  const anyConfigured = configured.supabase || configured.gemini;

  const status = !anyConfigured
    ? "not_configured"
    : allHealthy
      ? "healthy"
      : "degraded";

  json(res, {
    status,
    services: healthResults,
    configured,
    timestamp,
  });
}
