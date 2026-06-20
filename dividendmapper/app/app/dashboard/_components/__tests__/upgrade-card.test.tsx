import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { UpgradeCard } from "@/app/app/dashboard/_components/UpgradeCard";

afterEach(cleanup);

describe("UpgradeCard", () => {
  it("renders the headline", () => {
    render(<UpgradeCard />);
    expect(screen.getByText(/unlock resilience scoring/i)).toBeTruthy();
  });

  it("renders a primary CTA linking to /pricing", () => {
    render(<UpgradeCard />);
    const link = screen.getByRole("link", { name: /upgrade|see pricing|unlock|go pro/i });
    expect(link.getAttribute("href")).toBe("/pricing");
  });

  it("renders at least two value bullets", () => {
    const { container } = render(<UpgradeCard />);
    expect(container.querySelectorAll("li").length).toBeGreaterThanOrEqual(2);
  });
});
