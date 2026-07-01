import { Button, Text } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES } from "./_layout";

// Subject: "Give a friend 7 days of Pro, on us"
//
// Sent by the day-21 referral cron (/api/internal/send-pro-referral-emails)
// to paying Pro subscribers, 21 days after they became Pro. Framed as a
// favour, not a funnel. Idempotent via send_key=`pro_referral_offer_<userId>`.

interface ProReferralOfferProps {
  code: string;
  referralUrl: string;
  accountUrl: string;
}

export function ProReferralOfferEmail({
  code = "FRIEND-1234",
  referralUrl = "https://dividendmapper.com/refer/FRIEND-1234",
  accountUrl = "https://dividendmapper.com/app/account",
}: Partial<ProReferralOfferProps> = {}) {
  return (
    <EmailLayout preview="A code for a friend: no card, seven days of full Pro access.">
      <Text style={EMAIL_STYLES.heading}>Know someone who&apos;d like this?</Text>
      <Text style={EMAIL_STYLES.text}>
        If DividendMapper has been useful, here is a code for a friend. No card,
        no strings, seven days of full Pro access.
      </Text>
      <Text style={EMAIL_STYLES.code}>{code}</Text>
      <Text style={{ ...EMAIL_STYLES.text, margin: "24px 0" }}>
        <Button href={referralUrl} style={EMAIL_STYLES.button}>
          Share your invite
        </Button>
      </Text>
      <Text style={EMAIL_STYLES.textMuted}>
        You can always find this code on your{" "}
        <a href={accountUrl} style={{ color: "#0d9488" }}>
          account page
        </a>
        , so no need to keep this email.
      </Text>
      <Text style={EMAIL_STYLES.signature}>Glenn at DividendMapper</Text>
    </EmailLayout>
  );
}

export default ProReferralOfferEmail;
