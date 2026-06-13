import { Button, Text } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES } from "./_layout";

// Subject: "Your DividendMapper recap"
//
// Day-30 retention-leaning recap. Pure value: what changed this month in
// the user's holdings. Dispatcher (Task 19) short-circuits if both arrays
// are empty so we never send an empty body.

interface ScoreMove {
  ticker: string;
  from: number;
  to: number;
}
interface ExDiv {
  ticker: string;
  exDate: string;
  payment: string;
}

interface LifecycleMonthlyRecapProps {
  scoreMoves: ScoreMove[];
  exDivs: ExDiv[];
  portfolioUrl: string;
  unsubscribeUrl: string;
}

export function LifecycleMonthlyRecapEmail({
  scoreMoves = [],
  exDivs = [],
  portfolioUrl = "https://dividendmapper.com/app",
  unsubscribeUrl = "https://dividendmapper.com/api/lifecycle/unsubscribe?token=PREVIEW",
}: Partial<LifecycleMonthlyRecapProps> = {}) {
  return (
    <EmailLayout preview="Your DividendMapper recap: score moves and dividends coming up.">
      <Text style={EMAIL_STYLES.heading}>Your DividendMapper recap</Text>
      <Text style={EMAIL_STYLES.text}>This month in your holdings:</Text>
      {scoreMoves.length > 0 && (
        <ul
          style={{
            margin: "0 0 16px 0",
            paddingLeft: 20,
            fontSize: 16,
            lineHeight: "24px",
            color: "#111827",
          }}
        >
          {scoreMoves.map((m) => (
            <li key={m.ticker} style={{ marginBottom: 8 }}>
              <strong>{m.ticker}</strong>: resilience score moved from {m.from}{" "}
              to {m.to}
            </li>
          ))}
        </ul>
      )}
      {exDivs.length > 0 && (
        <ul
          style={{
            margin: "0 0 16px 0",
            paddingLeft: 20,
            fontSize: 16,
            lineHeight: "24px",
            color: "#111827",
          }}
        >
          {exDivs.map((d) => (
            <li key={d.ticker} style={{ marginBottom: 8 }}>
              <strong>{d.ticker}</strong>: ex-div {d.exDate}, payment{" "}
              {d.payment}
            </li>
          ))}
        </ul>
      )}
      <Text style={{ ...EMAIL_STYLES.text, margin: "24px 0" }}>
        <Button href={portfolioUrl} style={EMAIL_STYLES.button}>
          Open your portfolio
        </Button>
      </Text>
      <Text style={EMAIL_STYLES.signature}>Glenn at DividendMapper</Text>
      <Text style={{ ...EMAIL_STYLES.textMuted, marginTop: 24 }}>
        Monthly recap from DividendMapper.{" "}
        <a href={unsubscribeUrl} style={{ color: "#6b7280" }}>
          Unsubscribe
        </a>
        .
      </Text>
    </EmailLayout>
  );
}

export default LifecycleMonthlyRecapEmail;
