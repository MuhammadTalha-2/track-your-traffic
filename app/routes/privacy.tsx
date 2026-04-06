/**
 * GET /privacy
 *
 * Public privacy policy page — required for Shopify App Store submission.
 * No authentication required.
 */

export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px", fontFamily: "system-ui, sans-serif", color: "#202223", lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: "#6d7175", marginBottom: 40 }}>Last updated: April 6, 2026</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>1. Overview</h2>
        <p>
          Track Your Traffic ("the App") is a Shopify application that helps merchants understand
          their store traffic and UTM campaign performance. This Privacy Policy explains what data
          we collect, how we use it, and how we protect it.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>2. Data We Collect</h2>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Merchant Data</h3>
        <p>When you install the App, we store your Shopify shop domain and OAuth session token to authenticate API requests. We do not store your personal contact details.</p>

        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, marginTop: 16 }}>Visitor Analytics Data</h3>
        <p>The App tracks storefront visitors on your behalf. For each visit we record:</p>
        <ul style={{ paddingLeft: 24, marginTop: 8 }}>
          <li>UTM parameters (source, medium, campaign, term, content)</li>
          <li>Traffic channel classification (organic search, paid, social, etc.)</li>
          <li>Landing page URL</li>
          <li>Referring domain</li>
          <li>Device type (mobile / tablet / desktop) — derived from User-Agent</li>
          <li>Country code — derived from CDN headers (no precise geolocation)</li>
          <li>An anonymised visitor hash (SHA-256 of IP address + User-Agent + date)</li>
        </ul>
        <p style={{ marginTop: 12 }}>
          <strong>We do not store raw IP addresses, names, email addresses, phone numbers,
          or any other personally identifiable information (PII).</strong> The visitor hash
          is a one-way cryptographic function and cannot be reversed to identify an individual.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>3. How We Use Data</h2>
        <ul style={{ paddingLeft: 24 }}>
          <li>To display traffic analytics dashboards to the merchant</li>
          <li>To attribute visits to UTM campaigns created by the merchant</li>
          <li>To generate aggregated reports (by channel, device, country, page)</li>
        </ul>
        <p style={{ marginTop: 12 }}>We do not sell, rent, or share any data with third parties for marketing purposes.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>4. Data Retention</h2>
        <p>
          Visit data is retained for the period configured in the App settings (default: indefinite).
          Merchants can configure automatic data cleanup or manually delete data at any time from the
          Settings page. All data is permanently deleted within 48 hours of app uninstallation.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>5. GDPR &amp; CCPA Compliance</h2>
        <p>
          Because the App does not store PII, individual customer data requests and erasure requests
          (GDPR Art. 15 / Art. 17, CCPA) cannot be fulfilled on a per-customer basis — there is no
          data linkable to a specific individual. Shop-level data deletion is available and is
          executed automatically on uninstallation.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>6. Third-Party Services</h2>
        <p>The App uses the following third-party infrastructure:</p>
        <ul style={{ paddingLeft: 24 }}>
          <li><strong>Shopify</strong> — App hosting, OAuth authentication, and webhook delivery</li>
          <li><strong>Supabase / PostgreSQL</strong> — Encrypted database storage for analytics data</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>7. Security</h2>
        <p>
          All data is transmitted over HTTPS. Database connections use TLS encryption.
          Visitor hashes are computed using SHA-256 and are not reversible.
          Each merchant's data is isolated by shop domain — no cross-merchant data access is possible.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>8. Contact</h2>
        <p>
          If you have questions about this Privacy Policy or your data, please contact us through
          the Shopify App Store support channel for Track Your Traffic.
        </p>
      </section>

      <p style={{ color: "#6d7175", fontSize: 13, borderTop: "1px solid #e1e3e5", paddingTop: 24 }}>
        This policy applies to the Track Your Traffic Shopify App only.
      </p>
    </div>
  );
}
