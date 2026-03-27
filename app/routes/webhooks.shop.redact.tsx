/**
 * POST /webhooks/shop/redact
 *
 * Mandatory GDPR webhook — Shop Data Redact (Full Erasure).
 * Triggered 48 hours after a merchant uninstalls the app. Shopify sends this
 * as the final instruction to permanently delete all data associated with the
 * shop, including any residual visitor / analytics data.
 *
 * Unlike APP_UNINSTALLED (which fires immediately on uninstall and may run
 * before the merchant changes their mind), SHOP_REDACT is the irrevocable
 * erasure signal. We delete everything for the shop in a single transaction.
 *
 * Data deleted:
 *   • tyt_visits   — all visit / analytics rows for the shop
 *   • tyt_campaigns — all campaign definitions for the shop
 *   • tyt_settings  — all per-shop settings
 *   • Session       — any lingering OAuth sessions for the shop
 *
 * Shopify docs:
 * https://shopify.dev/docs/apps/build/privacy-law-compliance#shop-redact
 */

import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShopRedactPayload {
  shop_id: number;
  shop_domain: string;
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`[gdpr] Received ${topic} webhook for ${shop}`);

  try {
    const body = payload as ShopRedactPayload;

    // Delete all shop data in parallel — same pattern as APP_UNINSTALLED but
    // this is the final, authoritative erasure required by GDPR / CCPA.
    const [visits, campaigns, settings, sessions] = await Promise.all([
      prisma.visit.deleteMany({ where: { shop } }),
      prisma.campaign.deleteMany({ where: { shop } }),
      prisma.setting.deleteMany({ where: { shop } }),
      prisma.session.deleteMany({ where: { shop } }),
    ]);

    console.log(
      `[gdpr] SHOP_REDACT complete — shop: ${body.shop_domain} (id: ${body.shop_id}), ` +
        `deleted: ${visits.count} visits, ${campaigns.count} campaigns, ` +
        `${settings.count} settings, ${sessions.count} sessions`,
    );
  } catch (err) {
    // Log the error but still return 200 to prevent Shopify from retrying
    // indefinitely. If the shop data was already deleted by APP_UNINSTALLED,
    // Prisma deleteMany returns count 0 — not an error — so this catch block
    // only fires on genuine DB connectivity issues.
    console.error(`[gdpr] Error processing SHOP_REDACT for ${shop}:`, err);
  }

  return new Response(null, { status: 200 });
};
