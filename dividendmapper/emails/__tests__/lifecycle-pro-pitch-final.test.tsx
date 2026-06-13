import { describe, it, expect } from "vitest";
import { render } from "@react-email/components";
import { LifecycleProPitchFinalEmail } from "../lifecycle-pro-pitch-final";

describe("LifecycleProPitchFinalEmail", () => {
  it("renders the code, the expiry, and the pricing CTA", async () => {
    const html = await render(
      <LifecycleProPitchFinalEmail
        code="DM60-AB12CD"
        expiresOnLabel="20 August 2026"
        pricingUrl="https://dividendmapper.com/pricing"
        unsubscribeUrl="https://x/u?token=t"
      />,
    );
    expect(html).toContain("DM60-AB12CD");
    expect(html).toContain("20 August 2026");
    expect(html).toContain("/pricing");
    expect(html).toContain("Glenn at DividendMapper");
    expect(html).not.toMatch(/—/);
  });
});
