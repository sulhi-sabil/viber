import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  json,
  badRequest,
  serviceUnavailable,
  internalError,
  rateLimited,
  getRequestId,
} from "../_lib/response";
import { getGemini } from "../_lib/services";
import { RateLimitError } from "../../src/utils/errors";
import { GEMINI_DEFAULT_MODEL } from "../../src/index";

export const runtime = "nodejs";

interface GenerateRequest {
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  model?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId = getRequestId(req);

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const gemini = getGemini();
  if (!gemini) {
    serviceUnavailable(
      res,
      "GEMINI_API_KEY not configured",
      undefined,
      requestId,
    );
    return;
  }

  const contentType = req.headers["content-type"];
  if (!contentType?.includes("application/json")) {
    badRequest(
      res,
      "Content-Type must be application/json",
      undefined,
      requestId,
    );
    return;
  }

  const body = req.body as GenerateRequest | undefined;

  if (!body) {
    badRequest(res, "Request body is required", undefined, requestId);
    return;
  }

  if (!body.prompt || typeof body.prompt !== "string") {
    badRequest(
      res,
      "prompt is required and must be a string",
      undefined,
      requestId,
    );
    return;
  }

  if (body.prompt.length > 32000) {
    badRequest(
      res,
      "prompt must be less than 32000 characters",
      undefined,
      requestId,
    );
    return;
  }

  const { prompt, temperature, maxOutputTokens } = body;

  try {
    const options: { temperature?: number; maxOutputTokens?: number } = {};
    if (temperature !== undefined) {
      options.temperature = Math.max(0, Math.min(2, temperature));
    }
    if (maxOutputTokens !== undefined) {
      options.maxOutputTokens = Math.max(1, Math.min(8192, maxOutputTokens));
    }

    const text = await gemini.generateText(
      prompt,
      Object.keys(options).length > 0 ? options : undefined,
    );

    json(
      res,
      {
        prompt,
        text,
        model: process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL,
      },
      200,
      requestId,
    );
  } catch (err) {
    if (err instanceof RateLimitError) {
      const retryAfter = err.details?.retryAfter as number | undefined;
      rateLimited(res, err.message, { retryAfter }, requestId);
      return;
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    internalError(
      res,
      `Failed to generate text: ${message}`,
      {
        prompt: prompt.substring(0, 100),
      },
      requestId,
    );
  }
}
