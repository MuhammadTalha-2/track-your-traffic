/**
 * GET /api/urls — Fetch store URLs from Shopify Admin GraphQL.
 *
 * Used by the UTM Bulk Tagger to let merchants select which store URLs to tag.
 * Authenticated endpoint — requires Shopify admin session.
 *
 * Query params:
 *   - type: "products" | "collections" | "pages" | "key_pages" | "all" (default "all")
 *   - limit: number (1–50, default 25)
 *   - cursor: string (pagination cursor)
 */

import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

const PRODUCTS_QUERY = `#graphql
  query GetProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      edges {
        node { id title handle onlineStoreUrl }
        cursor
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const COLLECTIONS_QUERY = `#graphql
  query GetCollections($first: Int!, $after: String) {
    collections(first: $first, after: $after) {
      edges {
        node { id title handle }
        cursor
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const PAGES_QUERY = `#graphql
  query GetPages($first: Int!, $after: String) {
    pages(first: $first, after: $after) {
      edges {
        node { id title handle }
        cursor
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export interface UrlItem {
  id: string;
  title: string;
  handle: string;
  url: string;
  type: "product" | "collection" | "page" | "key_page";
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "all";
  const limitParam = parseInt(url.searchParams.get("limit") || "50", 10);
  const limit = Number.isNaN(limitParam) ? 50 : Math.min(Math.max(limitParam, 1), 50);
  const cursor = url.searchParams.get("cursor") || undefined;

  const results: UrlItem[] = [];
  let hasNextPage = false;
  let endCursor: string | null = null;

  // ── Key pages (Homepage, Cart, Collections, Search) ──────────────────────
  if (type === "key_pages" || type === "all") {
    const keyPages: UrlItem[] = [
      { id: "home", title: "Home", handle: "", url: `https://${shopDomain}/`, type: "key_page" },
      { id: "collections", title: "All Collections", handle: "collections", url: `https://${shopDomain}/collections`, type: "key_page" },
      { id: "cart", title: "Cart", handle: "cart", url: `https://${shopDomain}/cart`, type: "key_page" },
      { id: "search", title: "Search", handle: "search", url: `https://${shopDomain}/search`, type: "key_page" },
    ];
    results.push(...keyPages);
  }

  // ── Products ──────────────────────────────────────────────────────────────
  if (type === "products" || type === "all") {
    const response = await admin.graphql(PRODUCTS_QUERY, {
      variables: { first: limit, after: cursor },
    });
    const data = await response.json();
    const products = data.data?.products;
    if (products) {
      for (const edge of products.edges) {
        const node = edge.node;
        results.push({
          id: node.id,
          title: node.title,
          handle: node.handle,
          url: node.onlineStoreUrl || `https://${shopDomain}/products/${node.handle}`,
          type: "product",
        });
      }
      if (type === "products") {
        hasNextPage = products.pageInfo.hasNextPage;
        endCursor = products.pageInfo.endCursor;
      }
    }
  }

  // ── Collections ───────────────────────────────────────────────────────────
  if (type === "collections" || type === "all") {
    const response = await admin.graphql(COLLECTIONS_QUERY, {
      variables: { first: limit, after: type === "all" ? undefined : cursor },
    });
    const data = await response.json();
    const collections = data.data?.collections;
    if (collections) {
      for (const edge of collections.edges) {
        const node = edge.node;
        results.push({
          id: node.id,
          title: node.title,
          handle: node.handle,
          url: `https://${shopDomain}/collections/${node.handle}`,
          type: "collection",
        });
      }
      if (type === "collections") {
        hasNextPage = collections.pageInfo.hasNextPage;
        endCursor = collections.pageInfo.endCursor;
      }
    }
  }

  // ── Pages ─────────────────────────────────────────────────────────────────
  if (type === "pages" || type === "all") {
    const response = await admin.graphql(PAGES_QUERY, {
      variables: { first: limit, after: type === "all" ? undefined : cursor },
    });
    const data = await response.json();
    const pages = data.data?.pages;
    if (pages) {
      for (const edge of pages.edges) {
        const node = edge.node;
        results.push({
          id: node.id,
          title: node.title,
          handle: node.handle,
          url: `https://${shopDomain}/pages/${node.handle}`,
          type: "page",
        });
      }
      if (type === "pages") {
        hasNextPage = pages.pageInfo.hasNextPage;
        endCursor = pages.pageInfo.endCursor;
      }
    }
  }

  return Response.json({
    urls: results,
    pageInfo: { hasNextPage, endCursor },
  });
};
