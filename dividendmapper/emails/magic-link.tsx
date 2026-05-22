import { Button, Text } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES } from "./_layout";

// Subject (set in Supabase Auth dashboard): "Your DividendMapper sign-in link"
//
// Rendered to static HTML and pasted into the Supabase Auth dashboard
// → Email Templates → both Magic Link AND Confirm Signup (the same HTML
// covers both flows). Supabase substitutes {{ .ConfirmationURL }} and
// {{ .Token }} at send time. SMTP relay is Resend (configured separately
// in Supabase Auth → SMTP Settings).
//
// Why include the 6-digit code as a fallback: email security scanners
// (Gmail Safe Browsing, Outlook Defender, antivirus link-scanners) often
// pre-fetch URLs in emails to scan them, which consumes the single-use
// PKCE code embedded in the link. The 6-digit token is also single-use
// but requires deliberate user action to enter, so it survives scanner
// pre-fetch. The login form accepts it via verifyOtp.

export function MagicLinkEmail() {
  return (
    <EmailLayout preview="Your sign-in link and code are inside. Single-use, expires in five minutes.">
      <Text style={EMAIL_STYLES.heading}>Sign in to DividendMapper</Text>
      <Text style={EMAIL_STYLES.text}>
        Tap the button below to sign in. The link is single-use and expires
        in five minutes.
      </Text>
      <Text style={{ ...EMAIL_STYLES.text, margin: "24px 0" }}>
        <Button
          href="{{ .ConfirmationURL }}"
          style={EMAIL_STYLES.button}
        >
          Sign in to DividendMapper
        </Button>
      </Text>
      <Text style={EMAIL_STYLES.text}>
        Or enter this 6-digit code on the sign-in page:
      </Text>
      <Text style={{ margin: "0 0 16px 0" }}>
        <span
          style={{
            ...EMAIL_STYLES.code,
            fontSize: 22,
            letterSpacing: "0.2em",
            padding: "10px 16px",
          }}
        >
          {"{{ .Token }}"}
        </span>
      </Text>
      <Text style={EMAIL_STYLES.textMuted}>
        If you didn&apos;t ask for this, ignore the email. Nothing happens.
      </Text>
      <Text style={EMAIL_STYLES.signature}>Glenn at DividendMapper</Text>
    </EmailLayout>
  );
}

export default MagicLinkEmail;
