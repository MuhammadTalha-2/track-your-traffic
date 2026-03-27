/**
 * GET /api/campaigns/:id/stats — Per-campaign analytics.
 *
 * Returns visit totals, daily trend, and top landing pages for a campaign.
 * Authenticated — requires Shopify admin session.
 */

import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getCampaignStats } from "../lib/queries.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const id = parseInt(params.id || "", 10);

  if (Number.isNaN(id)) {
    return Response.json({ error: "Invalid campaign ID" }, { status: 400 });
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id, shop },
    select: { campaign: true, name: true, goalVisits: true },
  });

  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  const stats = await getCampaignStats(shop, campaign.campaign);

  return Response.json({
    name: campaign.name,
    goalVisits: campaign.goalVisits,
    ...stats,
  });
};
