import { Button, Text } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES } from "./_layout";

// Subject: "Welcome to DividendMapper"
//
// Day 0 of the free-user lifecycle. Sent on first sign-in (last_sign_in_at
// is non-null) by /api/internal/send-lifecycle-emails. Transactional: footer
// includes a courtesy unsubscribe link but the email itself ignores the
// unsubscribe flag.

interface LifecycleWelcomeFreeProps {
  addHoldingUrl: string;
  unsubscribeUrl: string;
}

export function LifecycleWelcomeFreeEmail({
  addHoldingUrl = "https://dividendmapper.com/app",
  unsubscribeUrl = "https://dividendmapper.com/api/lifecycle/unsubscribe?token=PREVIEW",
}: Partial<LifecycleWelcomeFreeProps> = {}) {
  return (
    <EmailLayout preview="Welcome to DividendMapper. Add a holding to see your first resilience score.">
      <Text style={EMAIL_STYLES.heading}>Welcome to DividendMapper</Text>
      <Text style={EMAIL_STYLES.text}>
        The app does one thing well: it scores your dividend holdings on
        resilience so you know which are quietly safe to compound and which
        want watching.
      </Text>
      <Text style={EMAIL_STYLES.text}>
        The fastest way to see what it does is to add a holding or two:
      </Text>
      <Text style={{ ...EMAIL_STYLES.text, margin: "24px 0" }}>
        <Button href={addHoldingUrl} style={EMAIL_STYLES.button}>
          Add a holding
        </Button>
      </Text>
      <Text style={EMAIL_STYLES.text}>
        Free tier covers up to 10 holdings. Pro is for when you want the full
        portfolio view across every account you hold, plus Buy, Trim, and
        Reinvest recommendations on each one.
      </Text>
      <Text style={EMAIL_STYLES.text}>
        Standing ask: if anything looks broken or off, reply to this email and
        let me know.
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

export default LifecycleWelcomeFreeEmail;
