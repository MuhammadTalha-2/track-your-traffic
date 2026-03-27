/**
 * POST /api/log — Direct visit-logging endpoint (legacy / fallback).
 *
 * Called by the storefront tracker when the App Proxy is unavailable.
 * The preferred endpoint is POST /proxy/log (Shopify App Proxy) because it
 * uses a stable storefront URL that survives tunnel URL changes.
 *
 * Security:
 *   1. Bot filtering
 *   2. Rate limiting (per-IP sliding window)
 *   3. Shop validation (must have an active session)
 *   4. Input sanitisation
 *   5. Server-side admin exclusion (DB setting, not theme setting)
 */

import type { ActionFunctionArgs } from "react-router";
import {
  recordVisit,
  isBot,
  sanitize,
} from "~/lib/visit-logger.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// ── Action ───────────────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Bot filter — reject before parsing body
  const ua = request.headers.get("user-agent") || "";
  if (isBot(ua)) return json({ ok: false, reason: "bot" });

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, reason: "invalid_json" }, 400);
  }

  const shop = sanitize(body.shop, 255);
  if (!shop) return json({ ok: false, reason: "missing_shop" }, 400);

  // Delegate to shared logger (with shop DB validation)
  const result = await recordVisit(body, request, { skipShopValidation: false });

  if (!result.ok) {
    const status = result.reason === "rate_limited" ? 429 : 200;
    return json(result, status);
  }

  return json({ ok: true });
};

// Handle CORS preflight
export const loader = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }
  return new Response("Method not allowed", { status: 405 });
};
