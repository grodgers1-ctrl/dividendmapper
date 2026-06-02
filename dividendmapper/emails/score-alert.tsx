import { Text, Link } from "@react-email/components";
import type { ReactNode } from "react";
import { EmailLayout, EMAIL_STYLES } from "./_layout";

// Daily resilience digest. Scores are a resilience check, never advice. Sent by
// /api/internal/send-score-alerts; idempotent via send_key=`${userId}:digest:${date}`.

export interface AlertRow {
  ticker: string;
  from: number;
  to: number;
}

interface ScoreAlertProps {
  qualityCrossings: AlertRow[];
  riskCrossings: AlertRow[];
  manageUrl: string;
  unsubscribeUrl: string;
}

function Line({ children }: { children: ReactNode }) {
  return <Text style={{ ...EMAIL_STYLES.text, margin: "0 0 8px 0" }}>{children}</Text>;
}

export function ScoreAlertEmail({
  qualityCrossings = [],
  riskCrossings = [],
  manageUrl = "https://dividendmapper.com/app/account/notifications",
  unsubscribeUrl = "https://dividendmapper.com/api/notifications/unsubscribe?token=",
}: Partial<ScoreAlertProps> = {}) {
  return (
    <EmailLayout preview="A resilience update on your holdings.">
      <Text style={EMAIL_STYLES.heading}>Your holdings update</Text>
      <Text style={EMAIL_STYLES.text}>
        A resilience score on one or more of your holdings moved past a level you
        set. This is a prompt to look, not advice.
      </Text>

      {qualityCrossings.length > 0 && (
        <>
          <Text style={{ ...EMAIL_STYLES.text, fontWeight: 700, margin: "24px 0 8px 0" }}>
            Resilience fell below your floor
          </Text>
          {qualityCrossings.map((c) => (
            <Line key={`q-${c.ticker}`}>
              {c.ticker}: now {c.to}, was {c.from}.
            </Line>
          ))}
        </>
      )}

      {riskCrossings.length > 0 && (
        <>
          <Text style={{ ...EMAIL_STYLES.text, fontWeight: 700, margin: "24px 0 8px 0" }}>
            Risk indicator rose into the elevated band
          </Text>
          {riskCrossings.map((c) => (
            <Line key={`r-${c.ticker}`}>
              {c.ticker}: now {c.to}, was {c.from}.
            </Line>
          ))}
        </>
      )}

      <Text style={{ ...EMAIL_STYLES.text, margin: "24px 0 8px 0" }}>
        <Link href={manageUrl} style={{ color: "#0d9488", fontWeight: 600 }}>
          See the full breakdown and manage these alerts
        </Link>
      </Text>

      <Text style={EMAIL_STYLES.textMuted}>
        These scores measure how well a holding has held up, not whether to trade
        it. Not financial advice.
      </Text>
      <Text style={EMAIL_STYLES.textMuted}>
        <Link href={unsubscribeUrl} style={{ color: "#6b7280" }}>
          Turn off all alert emails
        </Link>
      </Text>
    </EmailLayout>
  );
}

export default ScoreAlertEmail;
