/**
 * /api/campaigns/:id — Single campaign operations.
 *
 * GET    /api/campaigns/:id  — Get campaign by ID
 * PUT    /api/campaigns/:id  — Update campaign
 * DELETE /api/campaigns/:id  — Delete campaign
 *
 * Authenticated — requires Shopify admin session.
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// ── GET: Single campaign ────────────────────────────────────────────────────

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const id = parseInt(params.id || "", 10);

  if (Number.isNaN(id)) {
    return Response.json({ error: "Invalid campaign ID" }, { status: 400 });
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id, shop },
  });

  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  return Response.json({ campaign });
};

// ── PUT/DELETE: Update or delete campaign ────────────────────────────────────

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const id = parseInt(params.id || "", 10);

  if (Number.isNaN(id)) {
    return Response.json({ error: "Invalid campaign ID" }, { status: 400 });
  }

  // Verify ownership
  const existing = await prisma.campaign.findFirst({
    where: { id, shop },
  });
  if (!existing) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  // ── DELETE ─────────────────────────────────────────────────────────────
  if (request.method === "DELETE") {
    // Unlink visits first (set campaignId to null)
    await prisma.visit.updateMany({
      where: { campaignId: id },
      data: { campaignId: null },
    });

    await prisma.campaign.delete({ where: { id } });

    return Response.json({ ok: true });
  }

  // ── PUT: Update ────────────────────────────────────────────────────────
  if (request.method === "PUT") {
    const body = await request.json();

    const data: Record<string, unknown> = {};

    if (body.name !== undefined) data.name = body.name.trim();
    if (body.source !== undefined) data.source = body.source.trim();
    if (body.medium !== undefined) data.medium = body.medium.trim();
    if (body.campaign !== undefined) data.campaign = body.campaign.trim();
    if (body.term !== undefined) data.term = body.term.trim();
    if (body.content !== undefined) data.content = body.content.trim();
    if (body.status !== undefined) data.status = body.status;
    if (body.goalVisits !== undefined) data.goalVisits = parseInt(body.goalVisits, 10) || 0;
    if (body.tags !== undefined) data.tags = body.tags.trim();
    if (body.notes !== undefined) data.notes = body.notes.trim();

    if (body.startDate !== undefined) {
      data.startDate = body.startDate ? new Date(body.startDate) : null;
    }
    if (body.endDate !== undefined) {
      data.endDate = body.endDate ? new Date(body.endDate) : null;
    }

    // Slug change — ensure uniqueness
    if (body.slug !== undefined) {
      const newSlug = body.slug.trim();
      if (newSlug !== existing.slug) {
        const conflict = await prisma.campaign.findUnique({
          where: { shop_slug: { shop, slug: newSlug } },
        });
        if (conflict) {
          return Response.json(
            { error: "A campaign with this slug already exists" },
            { status: 409 },
          );
        }
        data.slug = newSlug;
      }
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data,
    });

    return Response.json({ campaign });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
};
