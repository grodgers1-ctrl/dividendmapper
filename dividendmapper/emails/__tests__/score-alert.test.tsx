import { describe, it, expect } from "vitest";
import { render } from "@react-email/components";
import { ScoreAlertEmail } from "../score-alert";

describe("ScoreAlertEmail", () => {
  it("renders Quality and Risk sections, the disclaimer, and both links", async () => {
    const html = await render(
      <ScoreAlertEmail
        qualityCrossings={[{ ticker: "VOD.L", from: 35, to: 22 }]}
        riskCrossings={[{ ticker: "MSFT", from: 70, to: 81 }]}
        manageUrl="https://dividendmapper.com/app/account/notifications"
        unsubscribeUrl="https://dividendmapper.com/api/notifications/unsubscribe?token=abc"
      />,
    );
    expect(html).toContain("VOD.L");
    expect(html).toContain("MSFT");
    expect(html).toContain("Not financial advice");
    expect(html).toContain("https://dividendmapper.com/app/account/notifications");
    expect(html).toContain("token=abc");
    // Never advice language.
    expect(html).not.toMatch(/\bbuy\b|\bsell\b|recommend/i);
  });

  it("omits a section that has no crossings", async () => {
    const html = await render(
      <ScoreAlertEmail
        qualityCrossings={[]}
        riskCrossings={[{ ticker: "MSFT", from: 70, to: 81 }]}
        manageUrl="https://x/manage"
        unsubscribeUrl="https://x/unsub"
      />,
    );
    expect(html).toContain("MSFT");
    expect(html).not.toContain("Resilience fell below");
  });

  it("renders a watchlist section with its own heading and crossings", async () => {
    const html = await render(
      <ScoreAlertEmail
        qualityCrossings={[]}
        riskCrossings={[]}
        watchlistRiskCrossings={[{ ticker: "BP.L", from: 70, to: 80 }]}
        watchlistQualityCrossings={[{ ticker: "AAPL", from: 35, to: 20 }]}
        manageUrl="https://x/manage"
        unsubscribeUrl="https://x/unsub"
      />,
    );
    expect(html).toContain("On your watchlist");
    expect(html).toContain("BP.L");
    expect(html).toContain("AAPL");
    expect(html).not.toMatch(/\bbuy\b|\bsell\b|recommend/i);
  });

  it("omits the watchlist section when there are no watchlist crossings", async () => {
    const html = await render(
      <ScoreAlertEmail
        qualityCrossings={[]}
        riskCrossings={[{ ticker: "MSFT", from: 70, to: 81 }]}
        manageUrl="https://x/manage"
        unsubscribeUrl="https://x/unsub"
      />,
    );
    expect(html).not.toContain("On your watchlist");
  });
});
