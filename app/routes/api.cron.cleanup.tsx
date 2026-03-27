/**
 * GET /api/cron/cleanup — Data retention cleanup endpoint.
 *
 * Called by a scheduled cron job (Vercel cron or external).
 * Iterates all shops with active sessions and deletes visits
 * older than their configured retention_days setting.
 *
 * Protected by a shared secret (CRON_SECRET env var).
 * If no CRON_SECRET is set, the endpoint is disabled.
 */

import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { getSettingInt } from "../lib/settings.server";
import { cleanupOldVisits } from "../lib/queries.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get("authorization");
  const providedSecret =
    authHeader?.replace("Bearer ", "") ||
    new URL(request.url).searchParams.get("secret");

  if (providedSecret !== cronSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all distinct shops with active sessions
  const shops = await prisma.session.findMany({
    distinct: ["shop"],
    select: { shop: true },
  });

  const results: Array<{ shop: string; retentionDays: number; deleted: number }> = [];

  for (const { shop } of shops) {
    const retentionDays = await getSettingInt(shop, "retention_days");

    if (retentionDays <= 0) {
      results.push({ shop, retentionDays: 0, deleted: 0 });
      continue;
    }

    const deleted = await cleanupOldVisits(shop, retentionDays);
    results.push({ shop, retentionDays, deleted });
  }

  const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);

  console.log(
    `[cron/cleanup] Processed ${shops.length} shops, deleted ${totalDeleted} visits`,
  );

  return Response.json({
    ok: true,
    shopsProcessed: shops.length,
    totalDeleted,
    details: results,
  });
};
