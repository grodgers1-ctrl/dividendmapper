import { Button, Text } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES } from "./_layout";

// Subject: "You're in. Sign in to activate your Pro access."
//
// Day 12 one-shot send to unsigned founders (Roland, David, Hannah). Step 1
// of two: this nudges them to sign in. Step 2 (welcome_founding_member with
// the 3 codes) fires automatically from /api/internal/provision-founding-
// member after each person actually signs up.

interface FounderStepOneProps {
  loginUrl: string;
}

export function FounderStepOneEmail({
  loginUrl = "https://dividendmapper.com/login",
}: Partial<FounderStepOneProps> = {}) {
  return (
    <EmailLayout preview="You're in. Sign in to activate Pro for six months.">
      <Text style={EMAIL_STYLES.heading}>You&apos;re in.</Text>
      <Text style={EMAIL_STYLES.text}>
        You&apos;re a DividendMapper founding member. Pro level access with no
        charge for six months.
      </Text>
      <Text style={{ ...EMAIL_STYLES.text, margin: "24px 0" }}>
        <Button href={loginUrl} style={EMAIL_STYLES.button}>
          Sign in to activate
        </Button>
      </Text>
      <Text style={EMAIL_STYLES.text}>
        Once all founders are signed in, we&apos;ll send out 50% off codes you
        can share with investors. Each code gives them 6 months of Pro at half
        price.
      </Text>
      <Text style={{ ...EMAIL_STYLES.text, fontWeight: 600 }}>
        Roadmap over the next 6-8 weeks:
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
        <li style={{ marginBottom: 8 }}>
          <strong>Now to Week 2:</strong> equity scoring (Buy / Trim / Risk
          signal per holding) plus a Reinvest Recommender for new
          contributions.
        </li>
        <li style={{ marginBottom: 8 }}>
          <strong>Weeks 3-4:</strong> threshold alert emails, personalisation
          wizard, public score lookup pages.
        </li>
        <li style={{ marginBottom: 8 }}>
          <strong>Weeks 5-8:</strong> Trading 212 sync. Pull ISA + SIPP
          positions automatically. We think it&apos;s a UK first.
        </li>
      </ul>
      <Text style={EMAIL_STYLES.text}>
        Expect periodic update emails as each lands.
      </Text>
      <Text style={EMAIL_STYLES.signature}>
        Many thanks,
        <br />
        Glenn
      </Text>
    </EmailLayout>
  );
}

export default FounderStepOneEmail;
