/**
 * POST /proxy/log — Shopify App Proxy visit-logging endpoint.
 *
 * Shopify proxies requests from:
 *   https://{store}.myshopify.com/apps/tyt/log
 * to:
 *   https://{app-url}/proxy/log?shop=...&hmac=...&timestamp=...
 *
 * Benefits over the direct /api/log endpoint:
 *   • Stable storefront URL — never changes, even when the dev tunnel rotates
 *   • No CORS issues — browser sees it as a same-origin request
 *   • Shopify verifies the shop via HMAC — no session-DB lookup needed
 *
 * Shopify CLI automatically updates the proxy backend URL when
 * `automatically_update_urls_on_dev = true` is set in the TOML.
 */

import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { recordVisit, isBot } from "~/lib/visit-logger.server";

// ── Action ───────────────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Bot filter before touching any auth/DB
  const ua = request.headers.get("user-agent") || "";
  if (isBot(ua)) {
    return new Response(JSON.stringify({ ok: false, reason: "bot" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Verify the request came from Shopify's App Proxy (HMAC check)
  // This throws / redirects if the signature is invalid.
  const { session } = await authenticate.public.appProxy(request);

  // `session.shop` is the verified shop domain — more trustworthy than
  // whatever the browser sent in the POST body.
  const shop = session?.shop;
  if (!shop) {
    return new Response(JSON.stringify({ ok: false, reason: "missing_shop" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parse POST body
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // Non-JSON body — treat as empty payload with defaults
  }

  // Override shop with the Shopify-verified value
  body.shop = shop;

  // Delegate to shared logger (shop already verified via HMAC)
  const result = await recordVisit(body as unknown as import("../lib/visit-logger.server").VisitPayload, request, { skipShopValidation: true });

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

// ── Loader (GET fallback) ─────────────────────────────────────────────────────
// Shopify may hit the proxy with GET when verifying connectivity.

export const loader = async ({ request }: ActionFunctionArgs) => {
  // Verify proxy request
  await authenticate.public.appProxy(request);
  return new Response(JSON.stringify({ ok: true, service: "tyt-log-proxy" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
