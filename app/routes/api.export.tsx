/**
 * GET /api/export — Full raw visit CSV export.
 *
 * Authenticated endpoint (admin session required).
 * Streams all visit records for the shop as a UTF-8 CSV.
 *
 * Query params:
 *   - days: number (default 0 = all time)
 *   - event_type: string (default 'all')
 */

import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function escapeCsv(val: string | null | undefined): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get("days") || "0", 10);
  const eventTypeFilter = url.searchParams.get("event_type") || "all";

  const where: Record<string, unknown> = { shop };
  if (days > 0) where.createdAt = { gte: daysAgo(days) };
  if (eventTypeFilter !== "all") where.eventType = eventTypeFilter;

  const visits = await prisma.visit.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      eventType: true,
      source: true,
      medium: true,
      campaign: true,
      channel: true,
      landingPage: true,
      referrer: true,
      clickIdType: true,
    },
  });

  const header = "id,date,event_type,source,medium,campaign,channel,landing_page,referrer,click_id_type\n";
  const rows = visits.map((v) =>
    [
      v.id,
      v.createdAt.toISOString(),
      escapeCsv(v.eventType),
      escapeCsv(v.source),
      escapeCsv(v.medium),
      escapeCsv(v.campaign),
      escapeCsv(v.channel),
      escapeCsv(v.landingPage),
      escapeCsv(v.referrer),
      escapeCsv(v.clickIdType),
    ].join(",")
  );

  const csv = header + rows.join("\n");
  const filename = `tyt-visits-${shop}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
};
