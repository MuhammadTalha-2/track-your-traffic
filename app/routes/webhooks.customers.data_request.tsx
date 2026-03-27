/**
 * POST /webhooks/customers/data_request
 *
 * Mandatory GDPR webhook — Customer Data Request.
 * Triggered when a customer requests a copy of their data from the shop.
 *
 * TYT stores visits anonymised via SHA-256 hash of (IP + UserAgent + date).
 * No PII (name, email, phone) is stored. Visits are keyed by visitorHash,
 * not by Shopify customer ID, so we cannot reliably link visits to a specific
 * customer. We log the request and return 200 OK.
 *
 * Shopify docs:
 * https://shopify.dev/docs/apps/build/privacy-law-compliance#customers-data_request
 */

import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`[gdpr] Received ${topic} webhook for ${shop}`);

  try {
    const body = payload as {
      shop_id: number;
      shop_domain: string;
      customer: { id: number; email: string; phone: string | null };
      orders_requested: number[];
    };

    // TYT does not store PII. Visits are stored as anonymised hashes.
    // We log the request for audit purposes.
    const visitCount = await prisma.visit.count({ where: { shop } });

    console.log(
      `[gdpr] CUSTOMERS_DATA_REQUEST — shop: ${body.shop_domain}, ` +
        `customer_id: ${body.customer.id}, email: ${body.customer.email}, ` +
        `total_visits_stored_for_shop: ${visitCount} (anonymised, no PII)`,
    );
  } catch (err) {
    // Non-fatal — still return 200 so Shopify doesn't retry
    console.error(`[gdpr] Error processing CUSTOMERS_DATA_REQUEST:`, err);
  }

  return new Response(null, { status: 200 });
};
