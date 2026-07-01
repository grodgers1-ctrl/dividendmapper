import { Button, Text } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES } from "./_layout";

// Subject: "Your 7-day Pro trial has ended"
//
// Sent from /api/internal/expire-trials once a referral trial's
// tier_expires_at passes. Idempotent via send_key=`trial_expired_<user_id>`.

interface TrialExpiredProps {
  pricingUrl: string;
}

export function TrialExpiredEmail({
  pricingUrl = "https://dividendmapper.com/pricing",
}: Partial<TrialExpiredProps> = {}) {
  return (
    <EmailLayout preview="Your Pro trial has ended. Your holdings and history are safe.">
      <Text style={EMAIL_STYLES.heading}>Your trial&apos;s up</Text>
      <Text style={EMAIL_STYLES.text}>
        Your 7-day Pro trial has ended, so your account has gone back to the
        free tier. The holdings cap is back in place and the full portfolio
        income view across every wrapper is limited again.
      </Text>
      <Text style={EMAIL_STYLES.text}>
        Nothing has been deleted. Every holding, dividend and note you added
        is still there, waiting for you. Go Pro again and it all comes
        straight back, exactly as you left it.
      </Text>
      <Text style={{ ...EMAIL_STYLES.text, margin: "24px 0" }}>
        <Button href={pricingUrl} style={EMAIL_STYLES.button}>
          Keep your full portfolio view
        </Button>
      </Text>
      <Text style={EMAIL_STYLES.textMuted}>
        No pressure either way. If you have a question about what Pro unlocks,
        just reply to this email and I&apos;ll help.
      </Text>
      <Text style={EMAIL_STYLES.signature}>Glenn at DividendMapper</Text>
    </EmailLayout>
  );
}

export default TrialExpiredEmail;
