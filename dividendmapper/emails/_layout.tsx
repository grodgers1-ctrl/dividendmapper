import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

// Shared shell for transactional emails. Inline styles only. Gmail strips
// <style> blocks, and most clients ignore external CSS.

const BG = "#f7f8f9";
const CARD_BG = "#ffffff";
const BORDER = "#e5e7eb";
const TEXT = "#111827";
const MUTED = "#6b7280";
const BRAND = "#0d9488";
const LOGO_URL = "https://dividendmapper.com/logo-pin.png";

export function EmailLayout({
  preview,
  children,
}: {
  preview: string;
  children: ReactNode;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: BG,
          margin: 0,
          padding: 0,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          color: TEXT,
        }}
      >
        <Container
          style={{
            backgroundColor: CARD_BG,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            maxWidth: 560,
            margin: "32px auto",
            padding: "32px",
          }}
        >
          <Section>
            <table
              cellPadding={0}
              cellSpacing={0}
              role="presentation"
              style={{ border: "none", borderCollapse: "collapse" }}
            >
              <tbody>
                <tr>
                  <td
                    style={{
                      verticalAlign: "middle",
                      paddingRight: 12,
                    }}
                  >
                    <Img
                      src={LOGO_URL}
                      width={36}
                      height={36}
                      alt=""
                      style={{
                        display: "block",
                        borderRadius: 8,
                      }}
                    />
                  </td>
                  <td style={{ verticalAlign: "middle" }}>
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        margin: 0,
                        color: BRAND,
                        letterSpacing: "-0.02em",
                        lineHeight: "24px",
                      }}
                    >
                      DividendMapper
                    </Text>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>
          <Hr
            style={{
              borderColor: BORDER,
              borderWidth: "0 0 1px 0",
              margin: "20px 0 24px 0",
            }}
          />
          {children}
        </Container>
        <Container
          style={{
            maxWidth: 560,
            margin: "0 auto 32px auto",
            padding: "0 32px",
            textAlign: "center",
          }}
        >
          <Text
            style={{
              fontSize: 12,
              color: MUTED,
              margin: 0,
            }}
          >
            DividendMapper · hello@dividendmapper.com
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const EMAIL_STYLES = {
  text: {
    fontSize: 16,
    lineHeight: "24px",
    color: TEXT,
    margin: "0 0 16px 0",
  },
  textMuted: {
    fontSize: 14,
    lineHeight: "20px",
    color: MUTED,
    margin: "0 0 16px 0",
  },
  heading: {
    fontSize: 24,
    fontWeight: 700,
    color: TEXT,
    margin: "0 0 16px 0",
    letterSpacing: "-0.01em",
  },
  button: {
    backgroundColor: "#0d9488",
    color: "#ffffff",
    fontSize: 16,
    fontWeight: 600,
    padding: "12px 20px",
    borderRadius: 8,
    textDecoration: "none",
    display: "inline-block",
  },
  code: {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
    fontSize: 16,
    fontWeight: 600,
    backgroundColor: "#f3f4f6",
    border: `1px solid ${BORDER}`,
    borderRadius: 6,
    padding: "8px 12px",
    margin: "0 0 8px 0",
    display: "inline-block",
    color: TEXT,
    letterSpacing: "0.02em",
  },
  signature: {
    fontSize: 14,
    color: MUTED,
    margin: "24px 0 0 0",
  },
} as const;
