import { describe, it, expect } from "vitest";
import { render } from "@react-email/components";
import { LifecycleProPitch1Email } from "../lifecycle-pro-pitch-1";

describe("LifecycleProPitch1Email", () => {
  it("renders per-ticker action lines and the pricing CTA", async () => {
    const html = await render(
      <LifecycleProPitch1Email
        lines={[
          { ticker: "AAPL", action: "BUY", score: 78 },
          { ticker: "VOD.L", action: "TRIM", score: 22 },
        ]}
        pricingUrl="https://dividendmapper.com/pricing"
        unsubscribeUrl="https://x/u?token=t"
      />,
    );
    expect(html).toContain("AAPL");
    expect(html).toContain("BUY");
    expect(html).toContain("VOD.L");
    expect(html).toContain("TRIM");
    expect(html).toContain("/pricing");
    expect(html).toContain("Glenn at DividendMapper");
    expect(html).not.toMatch(/—/);
  });
});
