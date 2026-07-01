import { Text } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES } from "./_layout";

// Generic internal FYI email sent to the founder(s) when a high-value
// business event happens (new Pro conversion, trial redeemed, cancellation).
// Content-agnostic: caller supplies the heading and body lines, so the same
// template renders every alert type. No CTA (these are internal notices).

interface FounderAlertProps {
  heading: string;
  lines: string[];
}

export function FounderAlertEmail({
  heading = "Founder alert",
  lines = [],
}: Partial<FounderAlertProps> = {}) {
  return (
    <EmailLayout preview={heading}>
      <Text style={EMAIL_STYLES.heading}>{heading}</Text>
      {lines.map((line, i) => (
        <Text key={i} style={EMAIL_STYLES.text}>
          {line}
        </Text>
      ))}
      <Text style={EMAIL_STYLES.signature}>DividendMapper</Text>
    </EmailLayout>
  );
}

export default FounderAlertEmail;
