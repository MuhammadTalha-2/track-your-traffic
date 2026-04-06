import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session } = await authenticate.webhook(request);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    try {
      // Delete all shop data in parallel — visits, campaigns, settings, orders, then sessions
      await Promise.all([
        db.visit.deleteMany({ where: { shop } }),
        db.campaign.deleteMany({ where: { shop } }),
        db.setting.deleteMany({ where: { shop } }),
        db.order.deleteMany({ where: { shop } }),
        db.session.deleteMany({ where: { shop } }),
      ]);
    } catch {
      // Non-fatal — return 200 so Shopify does not retry indefinitely.
      // If data was already cleaned up, deleteMany returns count 0 (not an error).
    }
  }

  return new Response();
};
