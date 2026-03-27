/**
 * GET /api/stats — Dashboard aggregation stats.
 *
 * Authenticated endpoint — requires a valid Shopify admin session.
 * Returns all dashboard stats for the authenticated shop.
 *
 * Query params:
 *   - days: number (1–365, default 30) — the lookback period
 */

import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getDashboardStats } from "../lib/queries.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const daysParam = parseInt(url.searchParams.get("days") || "30", 10);
  const days = Number.isNaN(daysParam) ? 30 : Math.min(Math.max(daysParam, 1), 365);

  const stats = await getDashboardStats(shop, days);

  return Response.json(stats);
};
