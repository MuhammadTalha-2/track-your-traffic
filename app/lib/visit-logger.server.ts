/**
 * visit-logger.server.ts
 *
 * Shared visit-logging logic used by both:
 *   - POST /api/log        (direct tracker endpoint — legacy / fallback)
 *   - POST /proxy/log      (Shopify App Proxy endpoint — preferred, stable URL)
 */

import prisma from "~/db.server";
import { getSettingBool, getSettingInt, getSetting } from "~/lib/settings.server";

// ── Bot detection ────────────────────────────────────────────────────────────

const BOT_PATTERNS = [
  /bot/i, /crawl/i, /spider/i, /slurp/i,
  /facebookexternalhit/i, /mediapartners/i, /google-inspectiontool/i,
  /adsbot/i, /bingpreview/i, /lighthouse/i, /pagespeed/i,
  /headlesschrome/i, /phantomjs/i, /prerender/i,
  /whatsapp/i, /telegrambot/i, /twitterbot/i, /linkedinbot/i, /discordbot/i,
  /semrush/i, /ahrefs/i, /mj12bot/i, /dotbot/i, /petalbot/i,
  /yandexbot/i, /baiduspider/i, /duckduckbot/i,
  /ia_archiver/i, /archive\.org/i,
  /uptimerobot/i, /pingdom/i, /gtmetrix/i,
];

/** Check UA against built-in patterns + optional shop-specific custom patterns. */
export function isBot(userAgent: string, customPatterns: string[] = []): boolean {
  if (!userAgent) return true;
  if (BOT_PATTERNS.some((p) => p.test(userAgent))) return true;
  for (const raw of customPatterns) {
    if (!raw) continue;
    try {
      if (new RegExp(raw, "i").test(userAgent)) return true;
    } catch {
      // ignore invalid regex
    }
  }
  return false;
}

// ── Rate limiting (in-memory sliding window) ─────────────────────────────────

interface RateBucket { count: number; resetAt: number }
const rateLimitMap = new Map<string, RateBucket>();
const RATE_WINDOW_MS = 60_000;
export const DEFAULT_RATE_LIMIT = 5;

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

// ── Device & country detection ────────────────────────────────────────────────

export function parseDeviceType(ua: string): "mobile" | "tablet" | "desktop" {
  if (!ua) return "desktop";
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
  if (/mobile|android|iphone|ipod|blackberry|opera mini|windows phone/i.test(ua)) return "mobile";
  return "desktop";
}

/**
 * Returns a 2-letter ISO country code from CDN/proxy headers.
 * Works automatically on Cloudflare (CF-IPCountry) and Vercel (X-Vercel-IP-Country).
 * Returns empty string in local dev or when no header is present.
 */
export function parseCountry(request: Request): string {
  const raw =
    request.headers.get("cf-ipcountry") ||
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("x-country-code") ||
    "";
  // CF sends "XX" for unknown — normalise to empty
  const code = raw.toUpperCase().slice(0, 2);
  return code === "XX" || code === "T1" ? "" : code;
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

function parseList(raw: string, separator = "\n"): string[] {
  return raw.split(separator).map((s) => s.trim()).filter(Boolean);
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
  event_type?: unknown; // 'pageview' | 'add_to_cart' | 'checkout' | 'purchase'
}

export interface VisitResult {
  ok: boolean;
  reason?: string;
}

const VALID_EVENT_TYPES = new Set(["pageview", "add_to_cart", "checkout", "purchase"]);

export async function recordVisit(
  payload: VisitPayload,
  request: Request,
  options: { skipShopValidation?: boolean } = {},
): Promise<VisitResult> {
  const ua = request.headers.get("user-agent") || "";

  // 1. Bot filter (built-in patterns — fast, no DB hit)
  if (isBot(ua)) return { ok: false, reason: "bot" };

  const shop = sanitize(payload.shop, 255);
  if (!shop) return { ok: false, reason: "missing_shop" };

  // 2. Shop validation
  if (!options.skipShopValidation) {
    const session = await prisma.session.findFirst({ where: { shop }, select: { id: true } });
    if (!session) return { ok: false, reason: "shop_not_found" };
  }

  // 3. Tracking enabled?
  const enabled = await getSettingBool(shop, "enabled");
  if (!enabled) return { ok: false, reason: "tracking_disabled" };

  // 4. Custom bot patterns (DB-based, shop-specific)
  const customBotRaw = await getSetting(shop, "custom_bot_patterns");
  if (customBotRaw) {
    const customPatterns = parseList(customBotRaw);
    if (isBot(ua, customPatterns)) return { ok: false, reason: "bot_custom" };
  }

  // 5. Admin exclusion
  if (payload.is_admin === true) {
    const excludeAdmins = await getSettingBool(shop, "exclude_admins");
    if (excludeAdmins) return { ok: false, reason: "excluded_admin" };
  }

  // 6. Rate limit
  const ip = getClientIp(request);
  const rateLimit = (await getSettingInt(shop, "rate_limit")) || DEFAULT_RATE_LIMIT;
  if (isRateLimited(ip, rateLimit)) return { ok: false, reason: "rate_limited" };

  // 7. Excluded IPs
  const excludedIpsRaw = await getSetting(shop, "excluded_ips");
  if (excludedIpsRaw) {
    const ipList = parseList(excludedIpsRaw, ",");
    if (ipList.includes(ip)) return { ok: false, reason: "excluded_ip" };
  }

  // 8. Referrer spam filtering
  const referrerVal = sanitize(payload.referrer, 2000).toLowerCase();
  const excludedReferrersRaw = await getSetting(shop, "excluded_referrers");
  if (excludedReferrersRaw && referrerVal) {
    const blockedRefs = parseList(excludedReferrersRaw);
    if (blockedRefs.some((r) => referrerVal.includes(r.toLowerCase()))) {
      return { ok: false, reason: "excluded_referrer" };
    }
  }

  // 9. Visitor hash (IP + UA + date — no PII stored)
  const hashInput = `${ip}|${ua}|${new Date().toISOString().slice(0, 10)}`;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(hashInput));
  const visitorHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);

  // 10. Match campaign
  // Normalize URL-encoded spaces: trackers may send "Summer+Sale" instead of "Summer Sale"
  const campaignName = sanitize(payload.campaign, 255).replace(/\+/g, " ");
  let campaignId: number | null = null;
  if (campaignName && campaignName !== "(not set)" && campaignName !== "(auto-tagged)") {
    const match = await prisma.campaign.findFirst({
      where: { shop, campaign: campaignName },
      select: { id: true },
    });
    if (match) campaignId = match.id;
  }

  // 11. Validate event type
  const rawEventType = sanitize(payload.event_type, 50) || "pageview";
  const eventType = VALID_EVENT_TYPES.has(rawEventType) ? rawEventType : "pageview";

  // 12. Device type + country
  const deviceType = parseDeviceType(ua);
  const country    = parseCountry(request);

  // 13. Insert visit
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
      eventType,
      deviceType,
      country,
    },
  });

  return { ok: true };
}
