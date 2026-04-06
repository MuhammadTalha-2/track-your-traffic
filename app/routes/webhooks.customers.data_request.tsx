/**
 * POST /webhooks/customers/data_request
 *
 * Mandatory GDPR webhook — Customer Data Request.
 * Triggered when a customer requests a copy of their data from the shop.
 *
 * TYT stores visits anonymised via SHA-256 hash of (IP + UserAgent + date).
 * No PII (name, email, phone) is stored. Visits are keyed by visitorHash,
 * not by Shopify customer ID, so we cannot reliably link visits to a specific
 * customer. We acknowledge the request and return 200 OK.
 *
 * Shopify docs:
 * https://shopify.dev/docs/apps/build/privacy-law-compliance#customers-data_request
 */

import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.webhook(request);

  // TYT does not store PII. All visitor data is anonymised via SHA-256 hash.
  // There is no customer-identifiable data to export in response to this request.
  return new Response(null, { status: 200 });
};
