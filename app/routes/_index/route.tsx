import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

function LogoIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect width="28" height="28" rx="6" fill="#2c6ecb" />
      <rect x="5"  y="16" width="4" height="7"  rx="1" fill="#fff" />
      <rect x="12" y="11" width="4" height="12" rx="1" fill="#fff" />
      <rect x="19" y="5"  width="4" height="18" rx="1" fill="#fff" />
    </svg>
  );
}

// Feature card icons
function IconCampaign() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22 3L2 8.5l7.5 3L17 5l-6.5 7.5L14 20l8-17z" stroke="#2c6ecb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconSources() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="18" cy="5" r="3" stroke="#10b981" strokeWidth="1.8" />
      <circle cx="6"  cy="12" r="3" stroke="#10b981" strokeWidth="1.8" />
      <circle cx="18" cy="19" r="3" stroke="#10b981" strokeWidth="1.8" />
      <path d="M8.59 13.51l6.83 3.98M15.41 6.51L8.59 10.49" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconDevice() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="2" width="14" height="20" rx="2" stroke="#a855f7" strokeWidth="1.8" />
      <circle cx="12" cy="17.5" r="1" fill="#a855f7" />
      <path d="M9 6h6" stroke="#a855f7" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconLink() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconFilter() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconExport() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="7 10 12 15 17 10" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="15" x2="12" y2="3" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>

      {/* ── Header / Nav ───────────────────────────────────────────── */}
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <a href="/" className={styles.navBrand}>
            <LogoIcon />
            Track Your Traffic
          </a>

          <div className={styles.navRight}>
            <nav className={styles.navLinks}>
              {[
                { label: "Features", href: "/features" },
                { label: "Pricing",  href: "/pricing"  },
                { label: "Help",     href: "/help"      },
                { label: "Privacy",  href: "/privacy"   },
              ].map(({ label, href }) => (
                <a key={label} href={href} className={styles.navLink}>{label}</a>
              ))}
            </nav>

            {showForm && (
              <Form method="post" action="/auth/login" style={{ display: "flex", alignItems: "center" }}>
                <input type="hidden" name="shop" id="nav-shop-input" />
                <a
                  href="#install"
                  className={styles.navCta}
                  style={{ marginLeft: 8 }}
                  onClick={(e) => {
                    e.preventDefault();
                    const input = document.querySelector<HTMLInputElement>("input[name='shop']");
                    input?.focus();
                    input?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                >
                  Install App
                </a>
              </Form>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className={styles.hero} id="install">
        <span className={styles.pill}>UTM Analytics for Shopify</span>

        <h1 className={styles.heading}>
          Know exactly where<br />
          <span className={styles.headingAccent}>your traffic comes from</span>
        </h1>

        <p className={styles.subtext}>
          Track UTM campaigns, traffic sources, devices, and countries — all from inside your Shopify admin. No coding required.
        </p>

        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <div className={styles.inputRow}>
              <input
                className={styles.input}
                type="text"
                name="shop"
                placeholder="your-store.myshopify.com"
                autoComplete="off"
              />
              <button className={styles.button} type="submit">
                Install App
              </button>
            </div>
            <span className={styles.formHint}>Enter your Shopify store domain to get started</span>
          </Form>
        )}
      </section>

      {/* ── Stats bar ──────────────────────────────────────────────── */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>UTM</span>
          <span className={styles.statLabel}>Attribution</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>Real-time</span>
          <span className={styles.statLabel}>Visit tracking</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>No code</span>
          <span className={styles.statLabel}>Setup required</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>GDPR</span>
          <span className={styles.statLabel}>Compliant</span>
        </div>
      </div>

      {/* ── Features ───────────────────────────────────────────────── */}
      <section className={styles.featuresSection}>
        <div className={styles.featuresSectionInner}>
          <h2 className={styles.featuresHeading}>Everything you need to understand your traffic</h2>
          <p className={styles.featuresSubtext}>Powerful analytics built directly into your Shopify admin — no external tools needed.</p>
          <div className={styles.features}>
            {[
              { icon: <IconCampaign />, bg: "#eff6ff", title: "UTM Campaign Tracking",      desc: "Track every UTM-tagged campaign and see exactly how many visits each one generates. Set goals and monitor progress." },
              { icon: <IconSources />,  bg: "#ecfdf5", title: "Traffic Source Breakdown",   desc: "See which channels — organic search, paid ads, social, email, and more — are driving visitors to your store." },
              { icon: <IconDevice />,   bg: "#faf5ff", title: "Device & Country Insights",  desc: "Understand whether your visitors are on mobile or desktop, and where they are in the world." },
              { icon: <IconLink />,     bg: "#fffbeb", title: "UTM Link Builder",            desc: "Generate perfectly formatted UTM URLs for any campaign. Bulk-tag multiple URLs at once with a single click." },
              { icon: <IconFilter />,   bg: "#fef2f2", title: "Bot & IP Filtering",          desc: "Exclude bots, crawlers, and your own team's traffic so your analytics stay clean and accurate." },
              { icon: <IconExport />,   bg: "#f9fafb", title: "CSV Export",                  desc: "Export your visit data any time for reporting, sharing with clients, or deeper analysis in a spreadsheet." },
            ].map(({ icon, bg, title, desc }) => (
              <div key={title} className={styles.featureCard}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {icon}
                </div>
                <p className={styles.featureTitle}>{title}</p>
                <p className={styles.featureDesc}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <p style={{ margin: 0 }}>
          &copy; {new Date().getFullYear()} AddOne Plugins &nbsp;·&nbsp;{" "}
          <a href="/privacy">Privacy Policy</a>
          &nbsp;·&nbsp;{" "}
          <a href="/terms">Terms of Service</a>
          &nbsp;·&nbsp;{" "}
          <a href="/help">Help</a>
        </p>
      </footer>
    </div>
  );
}
