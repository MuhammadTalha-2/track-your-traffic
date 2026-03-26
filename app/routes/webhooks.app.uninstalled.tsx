import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    // Delete all shop data in parallel — visits, campaigns, settings, then sessions
    await Promise.all([
      db.visit.deleteMany({ where: { shop } }),
      db.campaign.deleteMany({ where: { shop } }),
      db.setting.deleteMany({ where: { shop } }),
      db.session.deleteMany({ where: { shop } }),
    ]);

    console.log(`Deleted all data for ${shop} after uninstall`);
  }

  return new Response();
};
