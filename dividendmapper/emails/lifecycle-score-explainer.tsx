import { Button, Text } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES } from "./_layout";

// Subject: "Here's what your resilience score is telling you"
//
// Day-7 marketing email. Anchored to the user's lowest-scoring holding so
// the body has something concrete to talk about. Dispatcher short-circuits
// if no scored holdings exist yet (the cron defers to a later day).

interface LifecycleScoreExplainerProps {
  lowestTicker: string;
  lowestScore: number;
  holdingUrl: string;
  unsubscribeUrl: string;
}

export function LifecycleScoreExplainerEmail({
  lowestTicker = "VOD.L",
  lowestScore = 22,
  holdingUrl = "https://dividendmapper.com/app",
  unsubscribeUrl = "https://dividendmapper.com/api/lifecycle/unsubscribe?token=PREVIEW",
}: Partial<LifecycleScoreExplainerProps> = {}) {
  return (
    <EmailLayout preview="What your resilience score actually tells you, anchored to your portfolio.">
      <Text style={EMAIL_STYLES.heading}>What the score is telling you</Text>
      <Text style={EMAIL_STYLES.text}>
        Your portfolio&apos;s lowest-scoring holding right now is{" "}
        <strong>{lowestTicker}</strong> at <strong>{lowestScore}/100</strong>.
      </Text>
      <Text style={EMAIL_STYLES.text}>
        The resilience score blends three things: dividend cover,
        payout-vs-cashflow, and balance-sheet headroom. A score under 50 means
        at least one of those is stretched. It does not mean &quot;sell&quot;.
        It means &quot;this is the one to read on next earnings&quot;.
      </Text>
      <Text style={{ ...EMAIL_STYLES.text, margin: "24px 0" }}>
        <Button href={holdingUrl} style={EMAIL_STYLES.button}>
          See the full breakdown
        </Button>
      </Text>
      <Text style={EMAIL_STYLES.signature}>Glenn at DividendMapper</Text>
      <Text style={{ ...EMAIL_STYLES.textMuted, marginTop: 24 }}>
        You&apos;re getting this as part of the DividendMapper lifecycle emails.{" "}
        <a href={unsubscribeUrl} style={{ color: "#6b7280" }}>
          Unsubscribe
        </a>
        .
      </Text>
    </EmailLayout>
  );
}

export default LifecycleScoreExplainerEmail;
