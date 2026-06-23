import { describe, it, expect } from "vitest";
import { render } from "@react-email/components";
import { WeeklyDigestEmail } from "../weekly-digest";

describe("WeeklyDigestEmail", () => {
  it("renders holding and watchlist rows with deltas and a price swing", async () => {
    const html = await render(
      WeeklyDigestEmail({
        holdings: [{ ticker: "SHEL", resilience: { curr: 72, delta: 3 }, risk: { curr: 41, delta: -2 }, priceSwingPct: 1.8 }],
        watchlist: [{ ticker: "DGE", resilience: { curr: 61, delta: -4 }, risk: null, priceSwingPct: -2.1 }],
        manageUrl: "https://x/manage",
        unsubscribeUrl: "https://x/unsub",
      }),
    );
    expect(html).toContain("SHEL");
    expect(html).toContain("+3");
    expect(html).toContain("-2");
    expect(html).toContain("+1.8%");
    expect(html).toContain("DGE");
    expect(html).toContain("On your watchlist");
  });

  it("renders the quiet-week variant when there are no movers and no pending baselines", async () => {
    const html = await render(
      WeeklyDigestEmail({ holdings: [], watchlist: [], manageUrl: "https://x/manage", unsubscribeUrl: "https://x/unsub" }),
    );
    expect(html.toLowerCase()).toContain("steady");
    expect(html).not.toContain("Your holdings");
    expect(html.toLowerCase()).not.toContain("too recently");
  });

  it("renders the too-fresh variant when there are no movers but pending baselines exist", async () => {
    const html = await render(
      WeeklyDigestEmail({
        holdings: [],
        watchlist: [],
        pendingBaselineCount: 3,
        manageUrl: "https://x/manage",
        unsubscribeUrl: "https://x/unsub",
      }),
    );
    expect(html.toLowerCase()).toContain("week of scores");
    expect(html.toLowerCase()).toContain("too recently");
    expect(html.toLowerCase()).not.toContain("all steady this week");
  });

  it("ignores pendingBaselineCount when movers exist", async () => {
    const html = await render(
      WeeklyDigestEmail({
        holdings: [{ ticker: "SHEL", resilience: { curr: 72, delta: 3 }, risk: null, priceSwingPct: 0 }],
        watchlist: [],
        pendingBaselineCount: 5,
        manageUrl: "https://x/manage",
        unsubscribeUrl: "https://x/unsub",
      }),
    );
    expect(html).toContain("SHEL");
    expect(html.toLowerCase()).not.toContain("too recently");
    expect(html.toLowerCase()).not.toContain("week of scores");
  });
});
