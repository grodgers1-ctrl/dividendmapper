import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UpgradePill } from "../upgrade-pill";

describe("<UpgradePill>", () => {
  it("links to /pricing when pricing is public", () => {
    render(<UpgradePill pricingPublic={true} />);
    const link = screen.getByRole("link", { name: /upgrade to pro/i });
    expect(link).toHaveAttribute("href", "/pricing");
  });

  it("renders a static Pro tag with no link when pricing is gated", () => {
    render(<UpgradePill pricingPublic={false} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText(/pro/i)).toBeInTheDocument();
  });
});
