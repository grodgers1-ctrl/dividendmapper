import { describe, it, expect } from "vitest";
import { render } from "@react-email/components";
import { LifecycleActivationNudgeEmail } from "../lifecycle-activation-nudge";

describe("LifecycleActivationNudgeEmail", () => {
  it("renders a single concrete CTA and Glenn sign-off", async () => {
    const html = await render(
      <LifecycleActivationNudgeEmail
        addHoldingUrl="https://dividendmapper.com/app"
        unsubscribeUrl="https://dividendmapper.com/api/lifecycle/unsubscribe?token=t"
      />,
    );
    expect(html).toContain("Add a holding");
    expect(html).toContain("Glenn at DividendMapper");
    expect(html).toContain("https://dividendmapper.com/app");
    expect((html.match(/Add a holding/g) ?? []).length).toBeLessThanOrEqual(3);
    expect(html).not.toMatch(/—/);
  });
});
