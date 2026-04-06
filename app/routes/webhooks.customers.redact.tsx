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
 * Shopify docs:
 * https://shopify.dev/docs/apps/build/privacy-law-compliance#customers-redact
 */

import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.webhook(request);

  // TYT does not store any PII. All visitor data is keyed by a SHA-256 hash
  // derived from IP + User-Agent + date — a one-way function that cannot be
  // reversed to a specific customer identity. Nothing to delete.
  return new Response(null, { status: 200 });
};
