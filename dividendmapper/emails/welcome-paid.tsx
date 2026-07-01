import { Button, Text } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES } from "./_layout";

// Subject: "Welcome to DividendMapper Pro"
//
// Sent from /api/webhooks/stripe after checkout.session.completed writes
// the profile's stripe_customer_id. Idempotent via send_key=`welcome_paid_<subscription_id>`.

interface WelcomePaidProps {
  portfolioUrl: string;
}

export function WelcomePaidEmail({
  portfolioUrl = "https://dividendmapper.com/app/portfolio",
}: Partial<WelcomePaidProps> = {}) {
  return (
    <EmailLayout preview="You're on Pro. Unlimited holdings, full portfolio view, every calculator.">
      <Text style={EMAIL_STYLES.heading}>Welcome to Pro</Text>
      <Text style={EMAIL_STYLES.text}>
        Thanks for going Pro. You now have unlimited holdings, the full
        portfolio income view across every wrapper, and all the calculators.
      </Text>
      <Text style={EMAIL_STYLES.text}>
        Broker sync and the dividend calendar are both live too, so your
        holdings and upcoming payouts stay current without manual entry.
      </Text>
      <Text style={{ ...EMAIL_STYLES.text, margin: "24px 0" }}>
        <Button href={portfolioUrl} style={EMAIL_STYLES.button}>
          Open your portfolio
        </Button>
      </Text>
      <Text style={EMAIL_STYLES.textMuted}>
        Manage or cancel your billing any time from your account page, or
        just reply to this email if you&apos;d rather we sort it.
      </Text>
      <Text style={EMAIL_STYLES.signature}>Glenn at DividendMapper</Text>
    </EmailLayout>
  );
}

export default WelcomePaidEmail;
