import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";
import { getCampaignStats } from "../lib/queries.server";
import prisma from "../db.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const id = parseInt(params.id || "", 10);

  if (Number.isNaN(id)) throw new Response("Invalid ID", { status: 400 });

  const campaign = await prisma.campaign.findFirst({
    where: { id, shop: session.shop },
  });

  if (!campaign) throw new Response("Not found", { status: 404 });

  const stats = await getCampaignStats(session.shop, campaign.campaign);

  return { campaign, stats };
};

// ── SVG Sparkline (reused pattern) ───────────────────────────────────────────

function Sparkline({
  data,
  width = 700,
  height = 180,
}: {
  data: { date: string; visits: number; uniques: number }[];
  width?: number;
  height?: number;
}) {
  if (!data.length) {
    return (
      <s-box padding="base">
        <s-text color="subdued">No daily data yet.</s-text>
      </s-box>
    );
  }

  const maxVisits = Math.max(...data.map((d) => d.visits), 1);
  const pad = 40;
  const cW = width - pad * 2;
  const cH = height - pad * 2;

  const pts = data.map((d, i) => ({
    x: pad + (i / Math.max(data.length - 1, 1)) * cW,
    y: pad + cH - (d.visits / maxVisits) * cH,
  }));

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const yLabels = [0, Math.round(maxVisits / 2), maxVisits];
  const step = Math.max(1, Math.floor(data.length / 5));
  const xLabels = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }}>
      {yLabels.map((val) => {
        const y = pad + cH - (val / maxVisits) * cH;
        return (
          <g key={val}>
            <line x1={pad} y1={y} x2={width - pad} y2={y} stroke="#e1e3e5" strokeWidth="1" />
            <text x={pad - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#6d7175">{val}</text>
          </g>
        );
      })}
      <path d={line} fill="none" stroke="#2c6ecb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="#2c6ecb" />)}
      {xLabels.map((d) => {
        const i = data.indexOf(d);
        const x = pad + (i / Math.max(data.length - 1, 1)) * cW;
        return <text key={d.date} x={x} y={height - 8} textAnchor="middle" fontSize="10" fill="#6d7175">{d.date.slice(5)}</text>;
      })}
    </svg>
  );
}

// ── Goal Progress Bar ────────────────────────────────────────────────────────

function GoalProgress({ visits, goal }: { visits: number; goal: number }) {
  if (goal <= 0) {
    return <s-text color="subdued">No goal set</s-text>;
  }

  const pct = Math.min(100, Math.round((visits / goal) * 100));
  const barColor = pct >= 100 ? "#22c55e" : pct >= 50 ? "#2c6ecb" : "#f59e0b";

  return (
    <s-stack gap="small-200">
      <s-stack direction="inline" gap="small-200">
        <s-text type="strong">{pct}%</s-text>
        <s-text color="subdued">
          ({visits.toLocaleString()} / {goal.toLocaleString()} visits)
        </s-text>
      </s-stack>
      <svg viewBox="0 0 300 16" style={{ width: "100%", height: "16px" }}>
        <rect x="0" y="4" width="300" height="8" rx="4" fill="#e1e3e5" />
        <rect x="0" y="4" width={Math.max(4, (pct / 100) * 300)} height="8" rx="4" fill={barColor} />
      </svg>
    </s-stack>
  );
}

// ── Tagged URL Generator ──────────────────────────────────────────────────────

function buildTaggedUrl(baseUrl: string, campaign: any): string {
  if (!baseUrl) return "";
  try {
    const url = new URL(baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`);
    if (campaign.source) url.searchParams.set("utm_source", campaign.source);
    if (campaign.medium) url.searchParams.set("utm_medium", campaign.medium);
    if (campaign.campaign) url.searchParams.set("utm_campaign", campaign.campaign);
    if (campaign.term) url.searchParams.set("utm_term", campaign.term);
    if (campaign.content) url.searchParams.set("utm_content", campaign.content);
    return url.toString();
  } catch {
    return "";
  }
}

function CampaignUrlGenerator({ campaign }: { campaign: any }) {
  const [urls, setUrls] = useState("");
  const [copied, setCopied] = useState(false);

  const urlList = urls.split("\n").map((u) => u.trim()).filter(Boolean);
  const taggedRows = urlList.map((u) => ({
    original: u,
    tagged: buildTaggedUrl(u, campaign),
  }));

  const handleCopyAll = useCallback(() => {
    const text = taggedRows.map((r) => r.tagged).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [taggedRows]);

  const handleExportCsv = useCallback(() => {
    if (!taggedRows.length) return;
    const header = "Original URL,Tagged URL\n";
    const body = taggedRows
      .map((r) => `"${r.original.replace(/"/g, '""')}","${r.tagged.replace(/"/g, '""')}"`)
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${campaign.slug}-tagged-urls.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [taggedRows, campaign.slug]);

  return (
    <s-section heading="Generate Tagged URLs">
      <s-stack gap="base">
        <s-text color="subdued">
          Paste destination URLs below. This campaign's UTM parameters will be appended automatically.
        </s-text>

        <s-text-area
          label="Destination URLs (one per line)"
          name="campaign_urls"
          rows={4}
          placeholder={"https://your-store.com/products/item-1\nhttps://your-store.com/collections/sale"}
          value={urls}
          onChange={(e: any) => setUrls(e.currentTarget.value)}
        />

        {taggedRows.length > 0 && (
          <>
            <s-table variant="auto" accessibility-label="Tagged URLs">
              <s-table-header-row>
                <s-table-header list-slot="primary">Original</s-table-header>
                <s-table-header list-slot="labeled">Tagged URL</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {taggedRows.map((row, i) => (
                  <s-table-row key={i}>
                    <s-table-cell>{row.original}</s-table-cell>
                    <s-table-cell><s-text>{row.tagged}</s-text></s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>

            <s-stack direction="inline" gap="small-200">
              <s-button variant="primary" icon="export" onClick={handleExportCsv}>
                Export CSV
              </s-button>
              <s-button
                variant="secondary"
                icon={copied ? "check" : "clipboard"}
                onClick={handleCopyAll}
              >
                {copied ? "Copied!" : "Copy All"}
              </s-button>
            </s-stack>
          </>
        )}
      </s-stack>
    </s-section>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CampaignStatsPage() {
  const { campaign, stats } = useLoaderData<typeof loader>();

  const tone =
    campaign.status === "active"
      ? "success"
      : campaign.status === "paused"
        ? "warning"
        : "info";

  return (
    <s-page heading={campaign.name}>
      <s-link slot="breadcrumb-actions" href="/app/campaigns">
        Campaigns
      </s-link>

      {/* ── Summary Cards ──────────────────────────────────────────────── */}
      <s-section padding="base">
        <s-grid
          grid-template-columns="@container (inline-size <= 400px) 1fr, 1fr auto 1fr auto 1fr"
          gap="small"
        >
          <s-box padding="base">
            <s-grid gap="small-300">
              <s-heading>Total Visits</s-heading>
              <s-text type="strong">{stats.visits.toLocaleString()}</s-text>
            </s-grid>
          </s-box>
          <s-divider direction="block" />
          <s-box padding="base">
            <s-grid gap="small-300">
              <s-heading>Unique Visitors</s-heading>
              <s-text type="strong">{stats.uniques.toLocaleString()}</s-text>
            </s-grid>
          </s-box>
          <s-divider direction="block" />
          <s-box padding="base">
            <s-grid gap="small-300">
              <s-heading>Status</s-heading>
              <s-badge tone={tone}>{campaign.status}</s-badge>
            </s-grid>
          </s-box>
        </s-grid>
      </s-section>

      {/* ── Goal Progress ──────────────────────────────────────────────── */}
      <s-section heading="Goal Progress">
        <s-box padding="base">
          <GoalProgress visits={stats.visits} goal={campaign.goalVisits} />
        </s-box>
      </s-section>

      {/* ── UTM Details ────────────────────────────────────────────────── */}
      <s-section heading="UTM Parameters">
        <s-grid
          grid-template-columns="@container (inline-size <= 400px) 1fr, 1fr 1fr 1fr"
          gap="base"
        >
          <s-box padding="base">
            <s-stack gap="small-200">
              <s-text color="subdued">Source</s-text>
              <s-text type="strong">{campaign.source || "—"}</s-text>
            </s-stack>
          </s-box>
          <s-box padding="base">
            <s-stack gap="small-200">
              <s-text color="subdued">Medium</s-text>
              <s-text type="strong">{campaign.medium || "—"}</s-text>
            </s-stack>
          </s-box>
          <s-box padding="base">
            <s-stack gap="small-200">
              <s-text color="subdued">Campaign</s-text>
              <s-text type="strong">{campaign.campaign || "—"}</s-text>
            </s-stack>
          </s-box>
        </s-grid>
      </s-section>

      {/* ── Daily Trend ────────────────────────────────────────────────── */}
      <s-section heading="Daily Trend">
        <s-box padding="base">
          <Sparkline data={stats.daily} />
        </s-box>
      </s-section>

      {/* ── Tagged URL Generator ──────────────────────────────────────── */}
      <CampaignUrlGenerator campaign={campaign} />

      {/* ── Top Landing Pages ──────────────────────────────────────────── */}
      <s-section heading="Top Landing Pages">
        {stats.topPages.length > 0 ? (
          <s-table variant="auto" accessibility-label="Top landing pages">
            <s-table-header-row>
              <s-table-header list-slot="primary">Page</s-table-header>
              <s-table-header list-slot="labeled" format="numeric">Visits</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {stats.topPages.map((row) => (
                <s-table-row key={row.landingPage}>
                  <s-table-cell>{row.landingPage || "/"}</s-table-cell>
                  <s-table-cell>{row.visits.toLocaleString()}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        ) : (
          <s-box padding="base">
            <s-text color="subdued">No page data yet for this campaign.</s-text>
          </s-box>
        )}
      </s-section>
    </s-page>
  );
}
