import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return null;
};

export default function CampaignsPage() {
  return (
    <s-page heading="Campaigns">
      <s-section heading="Campaign Manager">
        <s-paragraph>
          Campaign management interface coming soon. Create, edit, and track
          UTM campaigns here.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}
