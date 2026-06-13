import { Button, Text } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES } from "./_layout";

// Subject: "Here's what Pro would say about your portfolio today"
//
// Day-14 marketing email. First real Pro pitch. Frames Pro as concrete
// output about THEIR holdings, not a feature list. Dispatcher (Task 19)
// short-circuits if fewer than 2 pitch lines can be built (insufficient
// data to be specific).

export type ProPitchAction = "BUY" | "HOLD" | "TRIM";

interface ProPitchLine {
  ticker: string;
  action: ProPitchAction;
  score: number;
}

interface LifecycleProPitch1Props {
  lines: ProPitchLine[];
  pricingUrl: string;
  unsubscribeUrl: string;
}

export function LifecycleProPitch1Email({
  lines = [],
  pricingUrl = "https://dividendmapper.com/pricing",
  unsubscribeUrl = "https://dividendmapper.com/api/lifecycle/unsubscribe?token=PREVIEW",
}: Partial<LifecycleProPitch1Props> = {}) {
  return (
    <EmailLayout preview="Here's what Pro would say about your portfolio today.">
      <Text style={EMAIL_STYLES.heading}>What Pro would say today</Text>
      <Text style={EMAIL_STYLES.text}>
        Across your holdings, Pro would flag:
      </Text>
      <ul
        style={{
          margin: "0 0 16px 0",
          paddingLeft: 20,
          fontSize: 16,
          lineHeight: "24px",
          color: "#111827",
        }}
      >
        {lines.map((line) => (
          <li key={line.ticker} style={{ marginBottom: 8 }}>
            <strong>{line.ticker}</strong>: {line.action} (score {line.score})
          </li>
        ))}
      </ul>
      <Text style={EMAIL_STYLES.text}>
        Plus a Reinvest Recommender that picks which of your holdings would
        best absorb next month&apos;s contribution based on Quality, price,
        and concentration.
      </Text>
      <Text style={{ ...EMAIL_STYLES.text, margin: "24px 0" }}>
        <Button href={pricingUrl} style={EMAIL_STYLES.button}>
          See Pro pricing
        </Button>
      </Text>
      <Text style={EMAIL_STYLES.text}>
        Free continues to cover the basics for as long as you want.
      </Text>
      <Text style={EMAIL_STYLES.signature}>Glenn at DividendMapper</Text>
      <Text style={{ ...EMAIL_STYLES.textMuted, marginTop: 24 }}>
        Lifecycle email from DividendMapper.{" "}
        <a href={unsubscribeUrl} style={{ color: "#6b7280" }}>
          Unsubscribe
        </a>
        .
      </Text>
    </EmailLayout>
  );
}

export default LifecycleProPitch1Email;
