import { Button, Text } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES } from "./_layout";

// Subject: "50% off your first month of Pro"
//
// Day-60 final nudge with a one-time, single-use, 7-day-expiry 50% off
// code minted per recipient by generateLifecycleProCode. Dispatcher (Task
// 19) short-circuits if Stripe isn't configured so the code field is
// always populated when this renders for a real send.

interface LifecycleProPitchFinalProps {
  code: string;
  expiresOnLabel: string;
  pricingUrl: string;
  unsubscribeUrl: string;
}

export function LifecycleProPitchFinalEmail({
  code = "DM60-PREVIEW",
  expiresOnLabel = "20 August 2026",
  pricingUrl = "https://dividendmapper.com/pricing",
  unsubscribeUrl = "https://dividendmapper.com/api/lifecycle/unsubscribe?token=PREVIEW",
}: Partial<LifecycleProPitchFinalProps> = {}) {
  return (
    <EmailLayout preview="50% off your first month of Pro. Valid for 7 days.">
      <Text style={EMAIL_STYLES.heading}>50% off your first month</Text>
      <Text style={EMAIL_STYLES.text}>
        Last automated nudge from me. Promise.
      </Text>
      <Text style={EMAIL_STYLES.text}>
        If you have been meaning to give Pro a go, here is a one-time 50% off
        your first month code. Valid until {expiresOnLabel}:
      </Text>
      <Text style={{ margin: "0 0 16px 0" }}>
        <span style={EMAIL_STYLES.code}>{code}</span>
      </Text>
      <Text style={{ ...EMAIL_STYLES.text, margin: "24px 0" }}>
        <Button href={pricingUrl} style={EMAIL_STYLES.button}>
          Use code at checkout
        </Button>
      </Text>
      <Text style={EMAIL_STYLES.text}>
        If Pro is not right for you, no hard feelings. Free continues to cover
        the basics for as long as you want, and the monthly recap keeps you in
        the loop.
      </Text>
      <Text style={EMAIL_STYLES.signature}>Glenn at DividendMapper</Text>
      <Text style={{ ...EMAIL_STYLES.textMuted, marginTop: 24 }}>
        Final lifecycle email from DividendMapper.{" "}
        <a href={unsubscribeUrl} style={{ color: "#6b7280" }}>
          Unsubscribe
        </a>
        .
      </Text>
    </EmailLayout>
  );
}

export default LifecycleProPitchFinalEmail;
