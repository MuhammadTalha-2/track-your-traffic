/**
 * visit-logger.server.ts
 *
 * Shared visit-logging logic used by both:
 *   - POST /api/log        (direct tracker endpoint — legacy / fallback)
 *   - POST /proxy/log      (Shopify App Proxy endpoint — preferred, stable URL)
 *
 * The App Proxy approach keeps the logEndpoint stable across dev restarts:
 *   storefront URL: https://store.myshopify.com/apps/tyt/log
 *   proxied to:     https://<tunnel>.trycloudflare.com/proxy/log
 * Shopify automatically updates the proxy backend URL when the tunnel changes.
 */

import prisma from "~/db.server";
import { getSettingBool, getSettingInt } from "~/lib/settings.server";

// ── Bot detection ────────────────────────────────────────────────────────────

const BOT_PATTERNS = [
  /bot/i,
  /crawl/i,
  /spider/i,
  /slurp/i,
  /facebookexternalhit/i,
  /mediapartners/i,
  /google-inspectiontool/i,
  /adsbot/i,
  /bingpreview/i,
  /lighthouse/i,
  /pagespeed/i,
  /headlesschrome/i,
  /phantomjs/i,
  /prerender/i,
  /whatsapp/i,
  /telegrambot/i,
  /twitterbot/i,
  /linkedinbot/i,
  /discordbot/i,
  /semrush/i,
  /ahrefs/i,
  /mj12bot/i,
  /dotbot/i,
  /petalbot/i,
  /yandexbot/i,
  /baiduspider/i,
  /duckduckbot/i,
  /ia_archiver/i,
  /archive\.org/i,
  /uptimerobot/i,
  /pingdom/i,
  /gtmetrix/i,
];

export function isBot(userAgent: string): boolean {
  if (!userAgent) return true;
  return BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

// ── Rate limiting (in-memory sliding window) ─────────────────────────────────

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateBucket>();
const RATE_WINDOW_MS = 60_000; // 1 minute
export const DEFAULT_RATE_LIMIT = 5;

// Periodically clean up stale entries to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateLimitMap) {
    if (now > bucket.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60_000);

export function isRateLimited(ip: string, maxRequests: number): boolean {
  const now = Date.now();
  const bucket = rateLimitMap.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  bucket.count++;
  return bucket.count > maxRequests;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function sanitize(value: unknown, maxLength = 500): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

// ── Core visit logger ────────────────────────────────────────────────────────

export interface VisitPayload {
  shop: string;
  source?: unknown;
  medium?: unknown;
  campaign?: unknown;
  channel?: unknown;
  landing_page?: unknown;
  referrer?: unknown;
  click_id_type?: unknown;
  is_admin?: unknown;
}

export interface VisitResult {
  ok: boolean;
  reason?: string;
}

/**
 * Validate, filter, and record a single visit.
 *
 * @param payload  Parsed POST body from the tracker
 * @param request  Original HTTP request (for IP / UA extraction)
 * @param options  skipShopValidation — true for App Proxy requests where
 *                 Shopify has already verified the shop via HMAC
 */
export async function recordVisit(
  payload: VisitPayload,
  request: Request,
  options: { skipShopValidation?: boolean } = {},
): Promise<VisitResult> {
  const ua = request.headers.get("user-agent") || "";

  // 1. Bot filter
  if (isBot(ua)) return { ok: false, reason: "bot" };

  const shop = sanitize(payload.shop, 255);
  if (!shop) return { ok: false, reason: "missing_shop" };

  // 2. Shop validation (skip for App Proxy — Shopify HMAC already verified)
  if (!options.skipShopValidation) {
    const session = await prisma.session.findFirst({
      where: { shop },
      select: { id: true },
    });
    if (!session) return { ok: false, reason: "shop_not_found" };
  }

  // 3. Tracking enabled?
  const enabled = await getSettingBool(shop, "enabled");
  if (!enabled) return { ok: false, reason: "tracking_disabled" };

  // 4. Admin exclusion (server-side, reads DB — no theme re-publish needed)
  if (payload.is_admin === true) {
    const excludeAdmins = await getSettingBool(shop, "exclude_admins");
    if (excludeAdmins) return { ok: false, reason: "excluded_admin" };
  }

  // 5. Rate limit
  const ip = getClientIp(request);
  const rateLimit =
    (await getSettingInt(shop, "rate_limit")) || DEFAULT_RATE_LIMIT;
  if (isRateLimited(ip, rateLimit)) return { ok: false, reason: "rate_limited" };

  // 6. Excluded IPs
  const excludedIpsRow = await prisma.setting.findUnique({
    where: { shop_key: { shop, key: "excluded_ips" } },
  });
  if (excludedIpsRow?.value) {
    const ipList = excludedIpsRow.value.split(",").map((s) => s.trim());
    if (ipList.includes(ip)) return { ok: false, reason: "excluded_ip" };
  }

  // 7. Build anonymised visitor hash (IP + UA + date — no PII stored)
  const hashInput = `${ip}|${ua}|${new Date().toISOString().slice(0, 10)}`;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(hashInput),
  );
  const visitorHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);

  // 8. Match campaign
  const campaignName = sanitize(payload.campaign, 255);
  let campaignId: number | null = null;
  if (
    campaignName &&
    campaignName !== "(not set)" &&
    campaignName !== "(auto-tagged)"
  ) {
    const match = await prisma.campaign.findFirst({
      where: { shop, campaign: campaignName },
      select: { id: true },
    });
    if (match) campaignId = match.id;
  }

  // 9. Insert visit
  await prisma.visit.create({
    data: {
      shop,
      source: sanitize(payload.source, 255),
      medium: sanitize(payload.medium, 255),
      campaign: campaignName,
      channel: sanitize(payload.channel, 100),
      landingPage: sanitize(payload.landing_page, 2000),
      referrer: sanitize(payload.referrer, 2000),
      clickIdType: sanitize(payload.click_id_type, 50),
      visitorHash,
      campaignId,
    },
  });

  return { ok: true };
}
