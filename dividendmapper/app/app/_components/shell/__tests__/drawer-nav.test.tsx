import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DrawerNav } from "../drawer-nav";
import type { NavItem } from "../nav-items";

const SAMPLE_ITEMS: readonly NavItem[] = [
  { href: "/app/dashboard", label: "Dashboard", icon: () => null },
  { href: "/app/portfolio", label: "Ledger", icon: () => null, exact: true },
  {
    href: "/app/portfolio/scoring",
    label: "Portfolio Manager",
    icon: () => null,
  },
  { href: "/app/account", label: "Account", icon: () => null },
];

describe("<DrawerNav>", () => {
  it("renders one link per item with href and label", () => {
    render(<DrawerNav items={SAMPLE_ITEMS} currentPath="/app/dashboard" />);
    for (const item of SAMPLE_ITEMS) {
      expect(
        screen.getByRole("link", { name: new RegExp(item.label) }),
      ).toHaveAttribute("href", item.href);
    }
  });

  it("marks only the matching link as data-active on a plain dashboard path", () => {
    render(<DrawerNav items={SAMPLE_ITEMS} currentPath="/app/dashboard" />);
    const dashboard = screen.getByRole("link", { name: /Dashboard/ });
    expect(dashboard).toHaveAttribute("data-active", "true");
    expect(dashboard).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Ledger/ })).not.toHaveAttribute(
      "data-active",
    );
  });

  it("exact items do not activate on prefix matches (Ledger stays off on /scoring)", () => {
    render(
      <DrawerNav items={SAMPLE_ITEMS} currentPath="/app/portfolio/scoring" />,
    );
    const ledger = screen.getByRole("link", { name: /Ledger/ });
    expect(ledger).not.toHaveAttribute("data-active");
    const scoring = screen.getByRole("link", { name: /Portfolio Manager/ });
    expect(scoring).toHaveAttribute("data-active", "true");
  });

  it("non-exact items activate on direct match", () => {
    render(<DrawerNav items={SAMPLE_ITEMS} currentPath="/app/account" />);
    expect(screen.getByRole("link", { name: /Account/ })).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  it("non-exact items activate on sub-path matches (Account on /account/notifications)", () => {
    render(
      <DrawerNav
        items={SAMPLE_ITEMS}
        currentPath="/app/account/notifications"
      />,
    );
    expect(screen.getByRole("link", { name: /Account/ })).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  it("activates Ledger exactly on /app/portfolio (not on /app/portfolio/scoring)", () => {
    render(<DrawerNav items={SAMPLE_ITEMS} currentPath="/app/portfolio" />);
    expect(screen.getByRole("link", { name: /Ledger/ })).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(
      screen.getByRole("link", { name: /Portfolio Manager/ }),
    ).not.toHaveAttribute("data-active");
  });

  it("renders an aria-labelled list for screen-reader navigation", () => {
    render(<DrawerNav items={SAMPLE_ITEMS} currentPath="/app/dashboard" />);
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });
});
