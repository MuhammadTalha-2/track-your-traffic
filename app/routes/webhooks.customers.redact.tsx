/**
 * POST /webhooks/customers/redact
 *
 * Mandatory GDPR webhook — Customer Data Redact (Erasure).
 * Triggered when a customer exercises their right to erasure (GDPR Art. 17 /
 * CCPA deletion request) and the shop confirms the request.
 *
 * TYT stores visits anonymised via SHA-256 hash of (IP + UserAgent + date).
 * No PII (name, email, phone, customer ID) is ever written to the database.
 * Visits cannot be linked back to a specific Shopify customer, so there is
 * nothing to redact on a per-customer basis.
 *
 * We acknowledge the request with 200 OK and log it for audit purposes.
 * If at any point TYT begins storing customer-identifiable data, this handler
 * must be updated to delete that data before returning.
 *
 * Shopify docs:
 * https://shopify.dev/docs/apps/build/privacy-law-compliance#customers-redact
 */

import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CustomersRedactPayload {
  shop_id: number;
  shop_domain: string;
  customer: {
    id: number;
    email: string;
    phone: string | null;
  };
  orders_to_redact: number[];
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`[gdpr] Received ${topic} webhook for ${shop}`);

  try {
    const body = payload as CustomersRedactPayload;

    /**
     * TYT does not store any PII. All visitor data is keyed by a SHA-256
     * hash derived from IP + User-Agent + date (a one-way function). It is
     * impossible to reverse the hash back to a specific customer identity,
     * so there are no records to delete in response to this request.
     *
     * Audit log: record that we received and processed the redact request.
     */
    console.log(
      `[gdpr] CUSTOMERS_REDACT — shop: ${body.shop_domain}, ` +
        `customer_id: ${body.customer.id}, email: ${body.customer.email}, ` +
        `orders_to_redact: [${body.orders_to_redact.join(", ")}] — ` +
        `no PII stored by TYT; nothing to delete`,
    );
  } catch (err) {
    // Non-fatal — still return 200 so Shopify does not retry indefinitely.
    console.error(`[gdpr] Error processing CUSTOMERS_REDACT:`, err);
  }

  return new Response(null, { status: 200 });
};
