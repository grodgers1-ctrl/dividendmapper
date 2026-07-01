import { Text } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES } from "./_layout";

// Internal daily founder digest. Sent by /api/internal/send-founder-digest to
// each founder (FOUNDER_EMAILS). Combines PostHog traffic with Supabase-derived
// business counts + a rough MRR estimate. FYI-only, so the copy is terse.
// Idempotent via send_key=`founder_digest_${dateLabel}_${recipient}`.

export interface FounderDigestTopPage {
  url: string;
  views: number;
}

export interface FounderDigestProps {
  dateLabel: string;
  pageviews: number | null;
  uniques: number | null;
  topPages: FounderDigestTopPage[];
  signups: number;
  trials: number;
  conversions: number;
  cancellations: number;
  mrr: number;
}

const TD_LABEL: React.CSSProperties = {
  fontSize: 14,
  color: "#6b7280",
  padding: "8px 24px 8px 0",
  borderBottom: "1px solid #f3f4f6",
};
const TD_VALUE: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: "#111827",
  padding: "8px 0",
  borderBottom: "1px solid #f3f4f6",
  textAlign: "right",
};

function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url || "/";
  }
}

function metricValue(n: number | null): string {
  return n === null ? "n/a" : String(n);
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td style={TD_LABEL}>{label}</td>
      <td style={TD_VALUE}>{value}</td>
    </tr>
  );
}

export function FounderDigestEmail({
  dateLabel = "2026-07-01",
  pageviews = 0,
  uniques = 0,
  topPages = [],
  signups = 0,
  trials = 0,
  conversions = 0,
  cancellations = 0,
  mrr = 0,
}: Partial<FounderDigestProps> = {}) {
  return (
    <EmailLayout preview={`DividendMapper daily digest for ${dateLabel}.`}>
      <Text style={EMAIL_STYLES.heading}>DividendMapper daily: {dateLabel}</Text>
      <Text style={EMAIL_STYLES.textMuted}>
        Yesterday&apos;s numbers. Traffic is from PostHog, business counts from Supabase, MRR is a
        rough estimate.
      </Text>

      <table
        cellPadding={0}
        cellSpacing={0}
        role="presentation"
        style={{ borderCollapse: "collapse", width: "100%", margin: "8px 0 8px 0" }}
      >
        <tbody>
          <MetricRow label="Pageviews" value={metricValue(pageviews)} />
          <MetricRow label="Unique visitors" value={metricValue(uniques)} />
          <MetricRow label="New signups" value={String(signups)} />
          <MetricRow label="New trials" value={String(trials)} />
          <MetricRow label="New Pro conversions" value={String(conversions)} />
          <MetricRow label="Cancellations" value={String(cancellations)} />
          <MetricRow label="Est. MRR" value={`£${mrr}`} />
        </tbody>
      </table>

      <Text style={{ ...EMAIL_STYLES.text, fontWeight: 700, margin: "24px 0 8px 0" }}>Top pages</Text>
      {topPages.length > 0 ? (
        <table
          cellPadding={0}
          cellSpacing={0}
          role="presentation"
          style={{ borderCollapse: "collapse", width: "100%" }}
        >
          <tbody>
            {topPages.map((p) => (
              <tr key={p.url}>
                <td style={TD_LABEL}>{safePath(p.url)}</td>
                <td style={TD_VALUE}>{p.views}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Text style={EMAIL_STYLES.textMuted}>No traffic data.</Text>
      )}
    </EmailLayout>
  );
}

export default FounderDigestEmail;
