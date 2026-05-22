import { Button, Text } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES } from "./_layout";

// Subject: "You're in. Three 50% off codes for friends."
//
// Sent from /api/internal/provision-founding-member after the 3 codes are
// inserted. Idempotent via send_key=`welcome_founding_member_<user_id>`.

interface WelcomeFoundingMemberProps {
  codes: string[];
  accountUrl: string;
  expiresOnLabel: string;
}

export function WelcomeFoundingMemberEmail({
  codes = ["GLENN-3K7QPA", "GLENN-9M2WXY", "GLENN-4K8VRT"],
  accountUrl = "https://dividendmapper.com/app/account",
  expiresOnLabel = "25 November 2026",
}: Partial<WelcomeFoundingMemberProps> = {}) {
  return (
    <EmailLayout preview="You're a founding member. Pro until November, plus three codes for friends.">
      <Text style={EMAIL_STYLES.heading}>You&apos;re a founding member</Text>
      <Text style={EMAIL_STYLES.text}>
        Thanks for backing DividendMapper this early. You&apos;re on Pro for
        free until {expiresOnLabel}, with unlimited holdings and the full
        portfolio view.
      </Text>
      <Text style={{ ...EMAIL_STYLES.text, fontWeight: 600 }}>
        Three 50% off Pro codes for friends:
      </Text>
      <Text style={{ margin: "0 0 16px 0" }}>
        {codes.map((code) => (
          <span key={code} style={{ display: "block", marginBottom: 8 }}>
            <span style={EMAIL_STYLES.code}>{code}</span>
          </span>
        ))}
      </Text>
      <Text style={EMAIL_STYLES.text}>
        Each code is single-use and gives a friend six months of Pro at half
        price. Friends paste them at checkout.
      </Text>
      <Text style={{ ...EMAIL_STYLES.text, margin: "24px 0" }}>
        <Button href={accountUrl} style={EMAIL_STYLES.button}>
          Open your account
        </Button>
      </Text>
      <Text style={EMAIL_STYLES.signature}>Glenn at DividendMapper</Text>
    </EmailLayout>
  );
}

export default WelcomeFoundingMemberEmail;
