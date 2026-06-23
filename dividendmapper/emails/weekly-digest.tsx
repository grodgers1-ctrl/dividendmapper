import { Text, Link } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES } from "./_layout";

// Weekly resilience digest. Scores are a resilience check, never advice. Sent by
// /api/internal/send-weekly-digest; idempotent via send_key=`${userId}:weekly:${isoWeek}`.

export interface WeeklyRow {
  ticker: string;
  resilience: { curr: number; delta: number } | null;
  risk: { curr: number; delta: number } | null;
  priceSwingPct: number | null;
}

interface WeeklyDigestProps {
  holdings: WeeklyRow[];
  watchlist: WeeklyRow[];
  // How many tickers fell out of the movers list because we don't have a
  // baseline for them yet (added < 7d ago, or cron only started recently).
  // Used to distinguish "all steady" from "your portfolio is too new to
  // compare" in the quiet-week branch.
  pendingBaselineCount?: number;
  manageUrl: string;
  unsubscribeUrl: string;
}

const TH: React.CSSProperties = {
  textAlign: "left",
  fontSize: 12,
  fontWeight: 700,
  color: "#6b7280",
  padding: "0 12px 6px 0",
  borderBottom: "1px solid #e5e7eb",
};
const TD: React.CSSProperties = {
  fontSize: 14,
  color: "#111827",
  padding: "8px 12px 8px 0",
  borderBottom: "1px solid #f3f4f6",
};

function scoreCell(m: { curr: number; delta: number } | null) {
  if (!m) return "n/a"; // no data
  const tag = m.delta > 0 ? `+${m.delta}` : m.delta < 0 ? `${m.delta}` : "=";
  return `${m.curr}  ${tag}`;
}

function swingCell(p: number | null) {
  if (p === null) return "n/a";
  if (p === 0) return "=";
  return p > 0 ? `+${p}%` : `${p}%`;
}

function Table({ heading, rows }: { heading: string; rows: WeeklyRow[] }) {
  return (
    <>
      <Text style={{ ...EMAIL_STYLES.text, fontWeight: 700, margin: "24px 0 8px 0" }}>{heading}</Text>
      <table cellPadding={0} cellSpacing={0} role="presentation" style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={TH}>Ticker</th>
            <th style={TH}>Resilience</th>
            <th style={TH}>Risk</th>
            <th style={TH}>Price swing</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ticker}>
              <td style={{ ...TD, fontWeight: 600 }}>{r.ticker}</td>
              <td style={TD}>{scoreCell(r.resilience)}</td>
              <td style={TD}>{scoreCell(r.risk)}</td>
              <td style={TD}>{swingCell(r.priceSwingPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function WeeklyDigestEmail({
  holdings = [],
  watchlist = [],
  pendingBaselineCount = 0,
  manageUrl = "https://dividendmapper.com/app/account/notifications",
  unsubscribeUrl = "https://dividendmapper.com/api/notifications/unsubscribe?token=",
}: Partial<WeeklyDigestProps> = {}) {
  const quiet = holdings.length === 0 && watchlist.length === 0;
  const allTooFresh = quiet && pendingBaselineCount > 0;
  return (
    <EmailLayout preview="Your weekly resilience digest.">
      <Text style={EMAIL_STYLES.heading}>Your week in resilience</Text>
      {quiet ? (
        allTooFresh ? (
          <Text style={EMAIL_STYLES.text}>
            Your weekly recap will fill out once we have a week of scores for your holdings. A few
            tickers were added too recently to compare over seven days; you will see them here from
            next Sunday.
          </Text>
        ) : (
          <Text style={EMAIL_STYLES.text}>
            All steady this week. Nothing on your holdings or watchlist moved enough to flag. This is a
            prompt to look, not advice.
          </Text>
        )
      ) : (
        <>
          <Text style={EMAIL_STYLES.text}>
            Here is how the resilience scores and prices on your holdings and watchlist moved over the
            past week. This is a prompt to look, not advice.
          </Text>
          {holdings.length > 0 && <Table heading="Your holdings" rows={holdings} />}
          {watchlist.length > 0 && <Table heading="On your watchlist" rows={watchlist} />}
        </>
      )}

      <Text style={{ ...EMAIL_STYLES.text, margin: "24px 0 8px 0" }}>
        <Link href={manageUrl} style={{ color: "#0d9488", fontWeight: 600 }}>
          See the full breakdown and manage these alerts
        </Link>
      </Text>
      <Text style={EMAIL_STYLES.textMuted}>
        These scores measure how well a holding has held up, not whether to trade it. Not financial
        advice.
      </Text>
      <Text style={EMAIL_STYLES.textMuted}>
        <Link href={unsubscribeUrl} style={{ color: "#6b7280" }}>
          Turn off all alert emails
        </Link>
      </Text>
    </EmailLayout>
  );
}

export default WeeklyDigestEmail;
