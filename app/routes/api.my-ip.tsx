/**
 * GET /api/my-ip — Returns the requesting client's IP address.
 *
 * Used by the Settings page to auto-detect the merchant's IP so they can
 * add it to the excluded IPs list with a single click.
 * Requires Shopify admin auth.
 */

import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getClientIp } from "../lib/visit-logger.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const ip = getClientIp(request);
  return Response.json({ ip });
};
