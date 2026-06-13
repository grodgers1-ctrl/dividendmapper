import { describe, it, expect } from "vitest";
import { render } from "@react-email/components";
import { LifecycleWelcomeFreeEmail } from "../lifecycle-welcome-free";

describe("LifecycleWelcomeFreeEmail", () => {
  it("renders the welcome body and the add-holding CTA", async () => {
    const html = await render(
      <LifecycleWelcomeFreeEmail
        addHoldingUrl="https://dividendmapper.com/app"
        unsubscribeUrl="https://dividendmapper.com/api/lifecycle/unsubscribe?token=t"
      />,
    );
    expect(html).toContain("Welcome to DividendMapper");
    expect(html).toContain("https://dividendmapper.com/app");
    expect(html).toContain("Glenn at DividendMapper");
    expect(html).toContain("token=t");
    // Voice rules.
    expect(html).not.toMatch(/—/);
    expect(html).not.toMatch(/\bsimply\b/i);
  });
});
