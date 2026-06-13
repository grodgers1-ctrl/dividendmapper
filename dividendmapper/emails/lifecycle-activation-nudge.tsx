import { Button, Text } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES } from "./_layout";

// Subject: "Add a holding to see what the score does"
//
// Day 3 transactional nudge. Skipped by the cron's skip-gate if the user
// already has at least one holding. Sent only to truly inactive accounts.

interface LifecycleActivationNudgeProps {
  addHoldingUrl: string;
  unsubscribeUrl: string;
}

export function LifecycleActivationNudgeEmail({
  addHoldingUrl = "https://dividendmapper.com/app",
  unsubscribeUrl = "https://dividendmapper.com/api/lifecycle/unsubscribe?token=PREVIEW",
}: Partial<LifecycleActivationNudgeProps> = {}) {
  return (
    <EmailLayout preview="Quick nudge: add a holding to see what the score does.">
      <Text style={EMAIL_STYLES.heading}>Quick nudge</Text>
      <Text style={EMAIL_STYLES.text}>
        The resilience score is the bit that turns DividendMapper from
        interesting to useful, and it only kicks in once you have at least one
        holding in there.
      </Text>
      <Text style={{ ...EMAIL_STYLES.text, margin: "24px 0" }}>
        <Button href={addHoldingUrl} style={EMAIL_STYLES.button}>
          Add a holding
        </Button>
      </Text>
      <Text style={EMAIL_STYLES.text}>
        Takes about a minute. If your broker is Trading 212 and you go Pro,
        the sync pulls them all automatically. Adding one by hand on Free
        works fine too.
      </Text>
      <Text style={EMAIL_STYLES.signature}>Glenn at DividendMapper</Text>
      <Text style={{ ...EMAIL_STYLES.textMuted, marginTop: 24 }}>
        Account email about your DividendMapper signup. You can{" "}
        <a href={unsubscribeUrl} style={{ color: "#6b7280" }}>
          unsubscribe from non-essential emails
        </a>
        .
      </Text>
    </EmailLayout>
  );
}

export default LifecycleActivationNudgeEmail;
