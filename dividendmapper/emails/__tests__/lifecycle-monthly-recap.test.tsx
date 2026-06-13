import { describe, it, expect } from "vitest";
import { render } from "@react-email/components";
import { LifecycleMonthlyRecapEmail } from "../lifecycle-monthly-recap";

describe("LifecycleMonthlyRecapEmail", () => {
  it("renders score moves and ex-div lines", async () => {
    const html = await render(
      <LifecycleMonthlyRecapEmail
        scoreMoves={[{ ticker: "AAPL", from: 70, to: 78 }]}
        exDivs={[{ ticker: "VOD.L", exDate: "2026-07-04", payment: "10.5p" }]}
        portfolioUrl="https://dividendmapper.com/app"
        unsubscribeUrl="https://x/u?token=t"
      />,
    );
    expect(html).toContain("AAPL");
    expect(html).toContain("78");
    expect(html).toContain("VOD.L");
    expect(html).toContain("2026-07-04");
    expect(html).toContain("Glenn at DividendMapper");
  });
});
