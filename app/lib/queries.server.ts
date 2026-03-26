/**
 * Database query helpers — ported from WordPress RestApi.php & CampaignManager.php.
 *
 * Uses Prisma where possible, falls back to $queryRaw for GROUP BY aggregations
 * that Prisma's query builder cannot express.
 *
 * Every query is shop-scoped for multi-tenant isolation.
 */

import prisma from "~/db.server";
import { Prisma } from "@prisma/client";

// ── Types ───────────────────────────────────────────────────────────────────

export interface Totals {
  totalVisits: number;
  uniqueVisitors: number;
}

export interface ChannelRow {
  channel: string;
  visits: number;
  uniques: number;
}

export interface SourceRow {
  source: string;
  medium: string;
  visits: number;
  uniques: number;
}

export interface DailyRow {
  date: string; // YYYY-MM-DD
  visits: number;
  uniques: number;
}

export interface PageRow {
  landingPage: string;
  visits: number;
  uniques: number;
}

export interface CampaignRow {
  campaign: string;
  visits: number;
}

export interface CampaignPageRow {
  landingPage: string;
  visits: number;
}

export interface DashboardStats {
  period: number;
  totalVisits: number;
  uniqueVisitors: number;
  today: number;
  yesterday: number;
  byChannel: ChannelRow[];
  topSources: SourceRow[];
  daily: DailyRow[];
  topPages: PageRow[];
  topCampaigns: CampaignRow[];
}

export interface CampaignWithCounts {
  id: number;
  shop: string;
  name: string;
  slug: string;
  source: string;
  medium: string;
  campaign: string;
  term: string;
  content: string;
  status: string;
  goalVisits: number;
  tags: string;
  startDate: Date | null;
  endDate: Date | null;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
  totalVisits: number;
  uniqueVisitors: number;
}

export interface CampaignStats {
  visits: number;
  uniques: number;
  daily: DailyRow[];
  topPages: CampaignPageRow[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Build a Date object for N days ago at midnight UTC. */
function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

/** Start of today UTC. */
function todayStart(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Start of yesterday UTC. */
function yesterdayStart(): Date {
  const d = todayStart();
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD STATS  (ported from RestApi.php → get_stats)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Total visits + unique visitors in the period.
 *
 * WordPress SQL:
 *   SELECT COUNT(*) AS total_visits, COUNT(DISTINCT visitor_hash) AS unique_visitors
 *   FROM tyt_visits WHERE created_at >= $since
 */
export async function getTotals(shop: string, days: number): Promise<Totals> {
  const since = daysAgo(days);
  const rows = await prisma.$queryRaw<
    { total_visits: bigint; unique_visitors: bigint }[]
  >`
    SELECT COUNT(*)                        AS total_visits,
           COUNT(DISTINCT "visitor_hash")  AS unique_visitors
    FROM   "tyt_visits"
    WHERE  "shop" = ${shop}
      AND  "created_at" >= ${since}
  `;
  return {
    totalVisits: Number(rows[0]?.total_visits ?? 0),
    uniqueVisitors: Number(rows[0]?.unique_visitors ?? 0),
  };
}

/**
 * Visits grouped by channel.
 *
 * WordPress SQL:
 *   SELECT channel, COUNT(*) AS visits, COUNT(DISTINCT visitor_hash) AS uniques
 *   FROM tyt_visits WHERE created_at >= $since GROUP BY channel ORDER BY visits DESC
 */
export async function getByChannel(
  shop: string,
  days: number,
): Promise<ChannelRow[]> {
  const since = daysAgo(days);
  const rows = await prisma.$queryRaw<
    { channel: string; visits: bigint; uniques: bigint }[]
  >`
    SELECT "channel",
           COUNT(*)                        AS visits,
           COUNT(DISTINCT "visitor_hash")  AS uniques
    FROM   "tyt_visits"
    WHERE  "shop" = ${shop}
      AND  "created_at" >= ${since}
    GROUP BY "channel"
    ORDER BY visits DESC
  `;
  return rows.map((r) => ({
    channel: r.channel,
    visits: Number(r.visits),
    uniques: Number(r.uniques),
  }));
}

/**
 * Top traffic sources (source + medium pairs).
 *
 * WordPress SQL:
 *   SELECT source, medium, COUNT(*) AS visits, COUNT(DISTINCT visitor_hash) AS uniques
 *   FROM tyt_visits WHERE created_at >= $since GROUP BY source, medium ORDER BY visits DESC LIMIT 15
 */
export async function getTopSources(
  shop: string,
  days: number,
  limit = 15,
): Promise<SourceRow[]> {
  const since = daysAgo(days);
  const rows = await prisma.$queryRaw<
    { source: string; medium: string; visits: bigint; uniques: bigint }[]
  >`
    SELECT "source", "medium",
           COUNT(*)                        AS visits,
           COUNT(DISTINCT "visitor_hash")  AS uniques
    FROM   "tyt_visits"
    WHERE  "shop" = ${shop}
      AND  "created_at" >= ${since}
    GROUP BY "source", "medium"
    ORDER BY visits DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    source: r.source,
    medium: r.medium,
    visits: Number(r.visits),
    uniques: Number(r.uniques),
  }));
}

/**
 * Daily visit trend.
 *
 * WordPress SQL:
 *   SELECT DATE(created_at) AS date, COUNT(*) AS visits, COUNT(DISTINCT visitor_hash) AS uniques
 *   FROM tyt_visits WHERE created_at >= $since GROUP BY DATE(created_at) ORDER BY date ASC
 */
export async function getDaily(
  shop: string,
  days: number,
): Promise<DailyRow[]> {
  const since = daysAgo(days);
  const rows = await prisma.$queryRaw<
    { date: Date; visits: bigint; uniques: bigint }[]
  >`
    SELECT DATE("created_at")              AS date,
           COUNT(*)                        AS visits,
           COUNT(DISTINCT "visitor_hash")  AS uniques
    FROM   "tyt_visits"
    WHERE  "shop" = ${shop}
      AND  "created_at" >= ${since}
    GROUP BY DATE("created_at")
    ORDER BY date ASC
  `;
  return rows.map((r) => ({
    date:
      r.date instanceof Date
        ? r.date.toISOString().slice(0, 10)
        : String(r.date),
    visits: Number(r.visits),
    uniques: Number(r.uniques),
  }));
}

/**
 * Top landing pages.
 *
 * WordPress SQL:
 *   SELECT landing_page, COUNT(*) AS visits, COUNT(DISTINCT visitor_hash) AS uniques
 *   FROM tyt_visits WHERE created_at >= $since GROUP BY landing_page ORDER BY visits DESC LIMIT 15
 */
export async function getTopPages(
  shop: string,
  days: number,
  limit = 15,
): Promise<PageRow[]> {
  const since = daysAgo(days);
  const rows = await prisma.$queryRaw<
    { landing_page: string; visits: bigint; uniques: bigint }[]
  >`
    SELECT "landing_page",
           COUNT(*)                        AS visits,
           COUNT(DISTINCT "visitor_hash")  AS uniques
    FROM   "tyt_visits"
    WHERE  "shop" = ${shop}
      AND  "created_at" >= ${since}
    GROUP BY "landing_page"
    ORDER BY visits DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    landingPage: r.landing_page,
    visits: Number(r.visits),
    uniques: Number(r.uniques),
  }));
}

/**
 * Top campaigns (excludes empty / auto-tagged).
 *
 * WordPress SQL:
 *   SELECT campaign, COUNT(*) AS visits FROM tyt_visits
 *   WHERE created_at >= $since AND campaign != '' AND campaign != '(not set)' AND campaign != '(auto-tagged)'
 *   GROUP BY campaign ORDER BY visits DESC LIMIT 10
 */
export async function getTopCampaigns(
  shop: string,
  days: number,
  limit = 10,
): Promise<CampaignRow[]> {
  const since = daysAgo(days);
  const rows = await prisma.$queryRaw<
    { campaign: string; visits: bigint }[]
  >`
    SELECT "campaign",
           COUNT(*) AS visits
    FROM   "tyt_visits"
    WHERE  "shop" = ${shop}
      AND  "created_at" >= ${since}
      AND  "campaign" != ''
      AND  "campaign" != '(not set)'
      AND  "campaign" != '(auto-tagged)'
    GROUP BY "campaign"
    ORDER BY visits DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    campaign: r.campaign,
    visits: Number(r.visits),
  }));
}

/**
 * Visit count for today.
 *
 * WordPress SQL:
 *   SELECT COUNT(*) FROM tyt_visits WHERE DATE(created_at) = CURDATE()
 */
export async function getTodayCount(shop: string): Promise<number> {
  return prisma.visit.count({
    where: {
      shop,
      createdAt: { gte: todayStart() },
    },
  });
}

/**
 * Visit count for yesterday.
 *
 * WordPress SQL:
 *   SELECT COUNT(*) FROM tyt_visits WHERE DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
 */
export async function getYesterdayCount(shop: string): Promise<number> {
  return prisma.visit.count({
    where: {
      shop,
      createdAt: {
        gte: yesterdayStart(),
        lt: todayStart(),
      },
    },
  });
}

/**
 * Full dashboard stats bundle — calls all aggregation queries in parallel.
 * This is the single function that the GET /api/stats route will call.
 */
export async function getDashboardStats(
  shop: string,
  days: number,
): Promise<DashboardStats> {
  const clampedDays = Math.min(Math.max(days, 1), 365);

  const [totals, byChannel, topSources, daily, topPages, topCampaigns, today, yesterday] =
    await Promise.all([
      getTotals(shop, clampedDays),
      getByChannel(shop, clampedDays),
      getTopSources(shop, clampedDays),
      getDaily(shop, clampedDays),
      getTopPages(shop, clampedDays),
      getTopCampaigns(shop, clampedDays),
      getTodayCount(shop),
      getYesterdayCount(shop),
    ]);

  return {
    period: clampedDays,
    totalVisits: totals.totalVisits,
    uniqueVisitors: totals.uniqueVisitors,
    today,
    yesterday,
    byChannel,
    topSources,
    daily,
    topPages,
    topCampaigns,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CAMPAIGN QUERIES  (ported from CampaignManager.php)
// ═══════════════════════════════════════════════════════════════════════════

/** Allowed sort columns for campaign list. */
const ALLOWED_CAMPAIGN_ORDERBY = [
  "created_at",
  "name",
  "status",
  "start_date",
] as const;
type CampaignOrderBy = (typeof ALLOWED_CAMPAIGN_ORDERBY)[number];

/**
 * List campaigns with visit counts (LEFT JOIN aggregation).
 *
 * WordPress SQL:
 *   SELECT c.*, COALESCE(v.visit_count, 0) AS total_visits, COALESCE(v.unique_count, 0) AS unique_visitors
 *   FROM tyt_campaigns c
 *   LEFT JOIN (SELECT campaign, COUNT(*) AS visit_count, COUNT(DISTINCT visitor_hash) AS unique_count
 *              FROM tyt_visits GROUP BY campaign) v ON v.campaign = c.campaign
 *   WHERE c.status = $status ORDER BY c.$orderby $order
 */
export async function listCampaigns(
  shop: string,
  options: {
    status?: string;
    orderby?: string;
    order?: "ASC" | "DESC";
  } = {},
): Promise<CampaignWithCounts[]> {
  const order = options.order === "ASC" ? "ASC" : "DESC";
  const orderby = ALLOWED_CAMPAIGN_ORDERBY.includes(
    options.orderby as CampaignOrderBy,
  )
    ? (options.orderby as CampaignOrderBy)
    : "created_at";

  // Build the raw query with conditional WHERE clause
  const statusFilter = options.status
    ? Prisma.sql`AND c."status" = ${options.status}`
    : Prisma.empty;

  const orderClause = Prisma.raw(`c."${orderby}" ${order}`);

  const rows = await prisma.$queryRaw<
    Array<{
      id: number;
      shop: string;
      name: string;
      slug: string;
      source: string;
      medium: string;
      campaign: string;
      term: string;
      content: string;
      status: string;
      goal_visits: number;
      tags: string;
      start_date: Date | null;
      end_date: Date | null;
      notes: string;
      created_at: Date;
      updated_at: Date;
      total_visits: bigint;
      unique_visitors: bigint;
    }>
  >`
    SELECT c.*,
           COALESCE(v.visit_count, 0)   AS total_visits,
           COALESCE(v.unique_count, 0)  AS unique_visitors
    FROM   "tyt_campaigns" c
    LEFT JOIN (
      SELECT "campaign",
             COUNT(*)                        AS visit_count,
             COUNT(DISTINCT "visitor_hash")  AS unique_count
      FROM   "tyt_visits"
      WHERE  "shop" = ${shop}
      GROUP BY "campaign"
    ) v ON v."campaign" = c."campaign"
    WHERE c."shop" = ${shop}
      ${statusFilter}
    ORDER BY ${orderClause}
  `;

  return rows.map((r) => ({
    id: r.id,
    shop: r.shop,
    name: r.name,
    slug: r.slug,
    source: r.source,
    medium: r.medium,
    campaign: r.campaign,
    term: r.term,
    content: r.content,
    status: r.status,
    goalVisits: r.goal_visits,
    tags: r.tags,
    startDate: r.start_date,
    endDate: r.end_date,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    totalVisits: Number(r.total_visits),
    uniqueVisitors: Number(r.unique_visitors),
  }));
}

/**
 * Get per-campaign stats (totals, daily trend, top pages).
 *
 * WordPress SQL (campaign_stats):
 *   SELECT COUNT(*) AS visits, COUNT(DISTINCT visitor_hash) AS uniques FROM tyt_visits WHERE campaign = $slug
 *   SELECT DATE(created_at) AS date, COUNT(*) AS visits ... GROUP BY DATE(created_at) LIMIT 90
 *   SELECT landing_page, COUNT(*) AS visits ... GROUP BY landing_page LIMIT 10
 */
export async function getCampaignStats(
  shop: string,
  campaignSlug: string,
): Promise<CampaignStats> {
  const [totals, daily, topPages] = await Promise.all([
    // Totals
    prisma.$queryRaw<{ visits: bigint; uniques: bigint }[]>`
      SELECT COUNT(*)                        AS visits,
             COUNT(DISTINCT "visitor_hash")  AS uniques
      FROM   "tyt_visits"
      WHERE  "shop" = ${shop}
        AND  "campaign" = ${campaignSlug}
    `,
    // Daily breakdown
    prisma.$queryRaw<{ date: Date; visits: bigint; uniques: bigint }[]>`
      SELECT DATE("created_at")              AS date,
             COUNT(*)                        AS visits,
             COUNT(DISTINCT "visitor_hash")  AS uniques
      FROM   "tyt_visits"
      WHERE  "shop" = ${shop}
        AND  "campaign" = ${campaignSlug}
      GROUP BY DATE("created_at")
      ORDER BY date ASC
      LIMIT 90
    `,
    // Top landing pages
    prisma.$queryRaw<{ landing_page: string; visits: bigint }[]>`
      SELECT "landing_page",
             COUNT(*) AS visits
      FROM   "tyt_visits"
      WHERE  "shop" = ${shop}
        AND  "campaign" = ${campaignSlug}
      GROUP BY "landing_page"
      ORDER BY visits DESC
      LIMIT 10
    `,
  ]);

  return {
    visits: Number(totals[0]?.visits ?? 0),
    uniques: Number(totals[0]?.uniques ?? 0),
    daily: daily.map((r) => ({
      date:
        r.date instanceof Date
          ? r.date.toISOString().slice(0, 10)
          : String(r.date),
      visits: Number(r.visits),
      uniques: Number(r.uniques),
    })),
    topPages: topPages.map((r) => ({
      landingPage: r.landing_page,
      visits: Number(r.visits),
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DATA RETENTION CLEANUP  (used by cron job)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Delete visits older than `retentionDays` for a shop.
 * Returns the number of deleted rows.
 * If retentionDays is 0 or negative, does nothing (keep forever).
 */
export async function cleanupOldVisits(
  shop: string,
  retentionDays: number,
): Promise<number> {
  if (retentionDays <= 0) return 0;

  const cutoff = daysAgo(retentionDays);
  const result = await prisma.visit.deleteMany({
    where: {
      shop,
      createdAt: { lt: cutoff },
    },
  });
  return result.count;
}
