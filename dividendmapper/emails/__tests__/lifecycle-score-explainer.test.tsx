import { describe, it, expect } from "vitest";
import { render } from "@react-email/components";
import { LifecycleScoreExplainerEmail } from "../lifecycle-score-explainer";

describe("LifecycleScoreExplainerEmail", () => {
  it("anchors body to the user's lowest-scoring ticker", async () => {
    const html = await render(
      <LifecycleScoreExplainerEmail
        lowestTicker="VOD.L"
        lowestScore={22}
        holdingUrl="https://dividendmapper.com/app/holdings/VOD.L"
        unsubscribeUrl="https://dividendmapper.com/api/lifecycle/unsubscribe?token=t"
      />,
    );
    expect(html).toContain("VOD.L");
    expect(html).toContain("22");
    expect(html).toContain("/app/holdings/VOD.L");
    expect(html).toContain("Glenn at DividendMapper");
    expect(html).not.toMatch(/—/);
  });
});
