import { describe, it, expect } from "vitest";
import { render } from "@react-email/components";
import { WelcomePaidEmail } from "../welcome-paid";

describe("WelcomePaidEmail", () => {
  it("renders the Pro welcome body and portfolio CTA", async () => {
    const html = await render(
      <WelcomePaidEmail portfolioUrl="https://dividendmapper.com/app/portfolio" />,
    );
    expect(html).toContain("https://dividendmapper.com/app/portfolio");
    expect(html).toContain("Glenn at DividendMapper");
    // Broker sync and the dividend calendar have shipped; don't tell
    // Pro subscribers they're still "coming this summer."
    expect(html).not.toMatch(/summer 2026/i);
    // Self-serve billing (/api/billing/portal) already exists; don't tell
    // subscribers to cancel by replying to the email.
    expect(html).not.toMatch(/replying to this email/i);
    expect(html).toMatch(/manage.*(billing|subscription)/i);
    // Voice rules.
    expect(html).not.toMatch(/—/);
    expect(html).not.toMatch(/\bsimply\b/i);
  });
});
