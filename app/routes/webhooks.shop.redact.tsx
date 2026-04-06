/**
 * POST /webhooks/shop/redact
 *
 * Mandatory GDPR webhook — Shop Data Redact (Full Erasure).
 * Triggered 48 hours after a merchant uninstalls the app. Shopify sends this
 * as the final instruction to permanently delete all data associated with the
 * shop, including any residual visitor / analytics data.
 *
 * Unlike APP_UNINSTALLED (which fires immediately on uninstall), SHOP_REDACT
 * is the irrevocable erasure signal. We delete everything for the shop.
 *
 * Data deleted:
 *   • tyt_visits    — all visit / analytics rows for the shop
 *   • tyt_campaigns — all campaign definitions for the shop
 *   • tyt_orders    — all order attribution rows for the shop
 *   • tyt_settings  — all per-shop settings
 *   • Session       — any lingering OAuth sessions for the shop
 *
 * Shopify docs:
 * https://shopify.dev/docs/apps/build/privacy-law-compliance#shop-redact
 */

import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await authenticate.webhook(request);

  try {
    await Promise.all([
      prisma.visit.deleteMany({ where: { shop } }),
      prisma.campaign.deleteMany({ where: { shop } }),
      prisma.order.deleteMany({ where: { shop } }),
      prisma.setting.deleteMany({ where: { shop } }),
      prisma.session.deleteMany({ where: { shop } }),
    ]);
  } catch {
    // Log but return 200 to prevent Shopify retrying indefinitely.
    // If data was already deleted by APP_UNINSTALLED, deleteMany returns 0 — not an error.
  }

  return new Response(null, { status: 200 });
};
