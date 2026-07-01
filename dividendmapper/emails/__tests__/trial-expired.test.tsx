import { describe, it, expect } from "vitest";
import { render } from "@react-email/components";
import { TrialExpiredEmail } from "../trial-expired";

describe("TrialExpiredEmail", () => {
  it("renders the trial-ended body and pricing CTA", async () => {
    const html = await render(
      <TrialExpiredEmail pricingUrl="https://dividendmapper.com/pricing" />,
    );
    expect(html).toContain("https://dividendmapper.com/pricing");
    expect(html).toContain("Glenn at DividendMapper");
    // Reassurance: their data is not deleted when the trial reverts to free.
    expect(html).toMatch(/nothing.*(deleted|gone)|not.*deleted|still there/i);
    // Voice rules.
    expect(html).not.toMatch(/—/);
    expect(html).not.toMatch(/\bsimply\b/i);
  });
});
