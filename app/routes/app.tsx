import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError, useLocation, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

const NAV_LINKS = [
  { href: "/app",             label: "Dashboard" },
  { href: "/app/campaigns",   label: "Campaigns" },
  { href: "/app/utm-builder", label: "UTM Builder" },
  { href: "/app/settings",    label: "Settings" },
] as const;

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const isActive = (href: string) =>
    href === "/app"
      ? pathname === "/app" || pathname === "/app/"
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        {NAV_LINKS.map(({ href, label }) => (
          <a
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            onClick={(e) => { e.preventDefault(); navigate(href); }}
          >
            {label}
          </a>
        ))}
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
