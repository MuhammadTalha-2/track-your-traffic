/**
 * POST /webhooks/orders/create
 *
 * Shopify sends this webhook every time an order is placed.
 * We extract UTM attribution from the order's landing_site URL and
 * store the order + revenue so the dashboard can show "revenue by source".
 *
 * Attribution logic:
 *   1. Parse utm_source / utm_medium / utm_campaign from landing_site URL
 *   2. Fall back to referring_site domain as source if no UTM params
 *   3. Derive channel from source/medium (same rules as the tracker JS)
 */

import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// ── Channel classifier (mirrors tyt-tracker.js logic) ────────────────────────

function classifyChannel(source: string, medium: string): string {
  const s = source.toLowerCase();
  const m = medium.toLowerCase();

  if (!s && !m) return "direct";
  if (m === "email" || m === "e-mail") return "email";
  if (m === "affiliate") return "affiliate";
  if (m === "referral") return "referral";
  if (m === "display") return "display";
  if (m === "cpc" || m === "ppc" || m === "paid_search") {
    if (s === "google" || s === "bing" || s === "yahoo") return "paid_search";
    return "paid_social";
  }
  if (m === "paid_social" || m === "paid-social") return "paid_social";
  if (m === "social" || m === "social-media" || m === "social_media") return "organic_social";
  if (m === "cpm") return "display";

  const searchEngines = ["google", "bing", "yahoo", "duckduckgo", "baidu", "yandex"];
  if (searchEngines.includes(s) && (!m || m === "organic")) return "organic_search";

  const socialNets = ["facebook", "instagram", "twitter", "x", "linkedin", "tiktok", "pinterest", "snapchat", "youtube"];
  if (socialNets.includes(s)) return "organic_social";

  if (s === "google" && m === "shopping") return "google_shopping";

  return "referral";
}

// ── Parse UTM params from a URL string ───────────────────────────────────────

function parseUtmFromUrl(urlStr: string): {
  source: string; medium: string; campaign: string;
} {
  try {
    const url = new URL(urlStr.startsWith("http") ? urlStr : `https://${urlStr}`);
    return {
      source:   url.searchParams.get("utm_source")   || "",
      medium:   url.searchParams.get("utm_medium")   || "",
      campaign: url.searchParams.get("utm_campaign") || "",
    };
  } catch {
    return { source: "", medium: "", campaign: "" };
  }
}

/** Extract the domain from a referrer URL (e.g. "https://www.google.com/..." → "google"). */
function domainFromUrl(urlStr: string): string {
  try {
    const host = new URL(urlStr).hostname.replace(/^www\./, "");
    return host.split(".")[0] || "";
  } catch {
    return "";
  }
}

// ── Webhook handler ───────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  if (topic !== "ORDERS_CREATE") {
    return new Response("Unexpected topic", { status: 400 });
  }

  const order = payload as {
    id?: number | string;
    total_price?: string;
    currency?: string;
    landing_site?: string;
    referring_site?: string;
  };

  const orderId  = String(order.id ?? "");
  const revenue  = parseFloat(order.total_price ?? "0") || 0;
  const currency = (order.currency ?? "USD").toUpperCase();

  // Attribution: UTM from landing_site, fallback to referring_site domain
  let source   = "";
  let medium   = "";
  let campaign = "";

  if (order.landing_site) {
    const utm = parseUtmFromUrl(order.landing_site);
    source   = utm.source;
    medium   = utm.medium;
    campaign = utm.campaign;
  }

  // If still no source, derive from referring site
  if (!source && order.referring_site) {
    source = domainFromUrl(order.referring_site);
    if (!medium) medium = "referral";
  }

  const channel = classifyChannel(source, medium);

  // Upsert so replayed webhooks don't double-count
  await prisma.order.upsert({
    where:  { shop_orderId: { shop, orderId } },
    update: { revenue, currency, source, medium, campaign, channel },
    create: { shop, orderId, revenue, currency, source, medium, campaign, channel },
  });

  return new Response(null, { status: 200 });
};
