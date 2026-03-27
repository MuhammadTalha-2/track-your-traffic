/**
 * /api/campaigns — Campaign CRUD endpoints.
 *
 * GET    /api/campaigns           — List campaigns (with visit counts)
 * POST   /api/campaigns           — Create a new campaign
 *
 * Ported from WordPress CampaignManager.php
 * Authenticated — requires Shopify admin session.
 *
 * Query params (GET):
 *   - status: "active" | "paused" | "completed" (optional, all if omitted)
 *   - orderby: "created_at" | "name" | "status" | "start_date"
 *   - order: "ASC" | "DESC"
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { listCampaigns } from "../lib/queries.server";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── GET: List campaigns ─────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || undefined;
  const orderby = url.searchParams.get("orderby") || "created_at";
  const order = (url.searchParams.get("order") || "DESC").toUpperCase() as "ASC" | "DESC";

  const campaigns = await listCampaigns(shop, { status, orderby, order });

  return Response.json({ campaigns });
};

// ── POST: Create campaign ───────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();

  // Validate required fields
  const name = (body.name || "").trim();
  if (!name) {
    return Response.json({ error: "Campaign name is required" }, { status: 400 });
  }

  const source = (body.source || "").trim();
  const medium = (body.medium || "").trim();
  const campaignParam = (body.campaign || "").trim();

  if (!source) {
    return Response.json({ error: "Source is required" }, { status: 400 });
  }

  // Generate slug from name
  let slug = slugify(body.slug || name);

  // Ensure unique slug for this shop
  const existing = await prisma.campaign.findUnique({
    where: { shop_slug: { shop, slug } },
  });
  if (existing) {
    slug = `${slug}-${Date.now()}`;
  }

  const campaign = await prisma.campaign.create({
    data: {
      shop,
      name,
      slug,
      source,
      medium,
      campaign: campaignParam || name,
      term: (body.term || "").trim(),
      content: (body.content || "").trim(),
      status: body.status || "active",
      goalVisits: parseInt(body.goalVisits, 10) || 0,
      tags: (body.tags || "").trim(),
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      notes: (body.notes || "").trim(),
    },
  });

  return Response.json({ campaign }, { status: 201 });
};
