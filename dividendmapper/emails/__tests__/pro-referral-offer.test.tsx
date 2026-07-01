import { describe, it, expect } from "vitest";
import { render } from "@react-email/components";
import { ProReferralOfferEmail } from "../pro-referral-offer";

describe("ProReferralOfferEmail", () => {
  it("renders the code, referral link, account link and signature", async () => {
    const html = await render(
      <ProReferralOfferEmail
        code="GLENN-ABCD"
        referralUrl="https://dividendmapper.com/refer/GLENN-ABCD"
        accountUrl="https://dividendmapper.com/app/account"
      />,
    );
    expect(html).toContain("GLENN-ABCD");
    expect(html).toContain("https://dividendmapper.com/refer/GLENN-ABCD");
    expect(html).toContain("https://dividendmapper.com/app/account");
    expect(html).toContain("Glenn at DividendMapper");
    // Voice rules.
    expect(html).not.toMatch(/—/);
    expect(html).not.toMatch(/\bsimply\b/i);
  });
});
