import type { VercelRequest, VercelResponse } from "@vercel/node";
import { json, serviceUnavailable } from "./_lib/response";
import { getSupabase, getGemini, getConfiguredServices } from "./_lib/services";

export const runtime = "nodejs";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const configured = getConfiguredServices();
  const healthResults: Record<string, unknown> = {};
  const timestamp = new Date().toISOString();

  // Run health checks in parallel using Promise.allSettled for improved latency
  const [supabaseResult, geminiResult] = await Promise.allSettled([
    (async () => {
      const supabase = getSupabase();
      if (supabase) {
        return { name: "supabase", result: await supabase.healthCheck() };
      }
      return {
        name: "supabase",
        result: {
          status: "not_configured",
          message: "SUPABASE_URL and SUPABASE_ANON_KEY required",
        },
      };
    })(),
    (async () => {
      const gemini = getGemini();
      if (gemini) {
        return { name: "gemini", result: await gemini.healthCheck() };
      }
      return {
        name: "gemini",
        result: {
          status: "not_configured",
          message: "GEMINI_API_KEY required",
        },
      };
    })(),
  ]);

  // Process Supabase result
  if (supabaseResult.status === "fulfilled") {
    healthResults.supabase = supabaseResult.value.result;
  } else {
    healthResults.supabase = {
      status: "unhealthy",
      error: supabaseResult.reason instanceof Error ? supabaseResult.reason.message : "Unknown error",
    };
  }

  // Process Gemini result
  if (geminiResult.status === "fulfilled") {
    healthResults.gemini = geminiResult.value.result;
  } else {
    healthResults.gemini = {
      status: "unhealthy",
      error: geminiResult.reason instanceof Error ? geminiResult.reason.message : "Unknown error",
    };
  }

  // Only check configured services for health status determination
  // Unconfigured services should not cause "degraded" status
  const configuredHealthResults = Object.entries(healthResults)
    .filter(([key]) => configured[key as keyof typeof configured])
    .map(([, value]) => value);

  const allHealthy = configuredHealthResults.every(
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
