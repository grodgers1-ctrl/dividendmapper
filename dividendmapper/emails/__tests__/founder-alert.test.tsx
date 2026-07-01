import { describe, it, expect } from "vitest";
import { render } from "@react-email/components";
import { FounderAlertEmail } from "../founder-alert";

describe("FounderAlertEmail", () => {
  it("renders the heading and each provided line", async () => {
    const html = await render(
      <FounderAlertEmail
        heading="New Pro conversion"
        lines={["jane@example.com went Pro.", "Plan: annual (£49)."]}
      />,
    );
    expect(html).toContain("New Pro conversion");
    expect(html).toContain("jane@example.com went Pro.");
    expect(html).toContain("Plan: annual (£49).");
    // Voice rules.
    expect(html).not.toMatch(/—/);
    expect(html).not.toMatch(/\bsimply\b/i);
  });
});
