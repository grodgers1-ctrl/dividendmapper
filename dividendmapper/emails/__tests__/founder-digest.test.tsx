import { describe, it, expect } from "vitest";
import { render } from "@react-email/components";
import { FounderDigestEmail } from "../founder-digest";

describe("FounderDigestEmail", () => {
  it("renders the date label, metrics and top pages", async () => {
    const html = await render(
      <FounderDigestEmail
        dateLabel="2026-06-30"
        pageviews={1234}
        uniques={456}
        topPages={[
          { url: "https://dividendmapper.com/pricing", views: 88 },
          { url: "https://dividendmapper.com/app/portfolio", views: 41 },
        ]}
        signups={7}
        trials={3}
        conversions={2}
        cancellations={1}
        mrr={315}
      />,
    );

    expect(html).toContain("2026-06-30");
    expect(html).toContain("1234"); // pageviews
    expect(html).toContain("456"); // uniques
    expect(html).toContain("£315"); // MRR
    expect(html).toContain("/pricing"); // a top-page path
    // Voice rules.
    expect(html).not.toMatch(/—/);
    expect(html).not.toMatch(/\bsimply\b/i);
  });

  it("renders the muted fallback when there is no traffic data", async () => {
    const html = await render(
      <FounderDigestEmail
        dateLabel="2026-06-30"
        pageviews={null}
        uniques={null}
        topPages={[]}
        signups={0}
        trials={0}
        conversions={0}
        cancellations={0}
        mrr={0}
      />,
    );

    expect(html).toContain("No traffic data");
    // Voice rules still hold on the empty path.
    expect(html).not.toMatch(/—/);
    expect(html).not.toMatch(/\bsimply\b/i);
  });
});
