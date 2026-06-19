import { describe, it, expect } from "vitest";
import {
  DEFAULT_NAV_ITEMS,
  filterNavItems,
  type NavItem,
} from "../nav-items";

describe("DEFAULT_NAV_ITEMS", () => {
  it("declares the six v1 drawer items in display order", () => {
    expect(DEFAULT_NAV_ITEMS.map((i) => i.href)).toEqual([
      "/app/dashboard",
      "/app/portfolio",
      "/app/portfolio/scoring",
      "/app/portfolio/watchlist",
      "/app/account",
      "/app/admin/scoring/audit",
    ]);
  });

  it("marks the Pro-only items as requiresPro", () => {
    const byHref = Object.fromEntries(
      DEFAULT_NAV_ITEMS.map((i) => [i.href, i] as const),
    );
    expect(byHref["/app/portfolio/scoring"].requiresPro).toBe(true);
    expect(byHref["/app/portfolio/watchlist"].requiresPro).toBe(true);
    expect(byHref["/app/dashboard"].requiresPro).toBeFalsy();
    expect(byHref["/app/portfolio"].requiresPro).toBeFalsy();
    expect(byHref["/app/account"].requiresPro).toBeFalsy();
  });

  it("marks the Admin item as adminOnly", () => {
    const admin = DEFAULT_NAV_ITEMS.find(
      (i) => i.href === "/app/admin/scoring/audit",
    );
    expect(admin?.adminOnly).toBe(true);
  });

  it("ledger is exact-match; other prefix-matchable items are not", () => {
    const byHref = Object.fromEntries(
      DEFAULT_NAV_ITEMS.map((i) => [i.href, i] as const),
    );
    expect(byHref["/app/portfolio"].exact).toBe(true);
    expect(byHref["/app/account"].exact).toBeFalsy();
  });
});

describe("filterNavItems", () => {
  it("free non-admin → 3 items (Dashboard, Ledger, Account)", () => {
    const items = filterNavItems(DEFAULT_NAV_ITEMS, {
      tier: "free",
      isAdmin: false,
    });
    expect(items.map((i) => i.href)).toEqual([
      "/app/dashboard",
      "/app/portfolio",
      "/app/account",
    ]);
  });

  it("pro non-admin → 5 items (adds Portfolio Manager + Watchlist)", () => {
    const items = filterNavItems(DEFAULT_NAV_ITEMS, {
      tier: "pro",
      isAdmin: false,
    });
    expect(items).toHaveLength(5);
    expect(items.map((i) => i.href)).toEqual([
      "/app/dashboard",
      "/app/portfolio",
      "/app/portfolio/scoring",
      "/app/portfolio/watchlist",
      "/app/account",
    ]);
  });

  it("premium counts as Pro-equivalent (founding-member path)", () => {
    const items = filterNavItems(DEFAULT_NAV_ITEMS, {
      tier: "premium",
      isAdmin: false,
    });
    expect(items).toHaveLength(5);
    expect(items.map((i) => i.href)).toContain("/app/portfolio/scoring");
  });

  it("admin pro → 6 items (adds Admin)", () => {
    const items = filterNavItems(DEFAULT_NAV_ITEMS, {
      tier: "pro",
      isAdmin: true,
    });
    expect(items).toHaveLength(6);
    expect(items.map((i) => i.href)).toContain("/app/admin/scoring/audit");
  });

  it("admin free → 4 items (Dashboard, Ledger, Account, Admin) — Pro items still hidden", () => {
    const items = filterNavItems(DEFAULT_NAV_ITEMS, {
      tier: "free",
      isAdmin: true,
    });
    expect(items.map((i) => i.href)).toEqual([
      "/app/dashboard",
      "/app/portfolio",
      "/app/account",
      "/app/admin/scoring/audit",
    ]);
  });

  it("preserves original item order", () => {
    const customItems: readonly NavItem[] = [
      { href: "/c", label: "C", icon: () => null },
      { href: "/a", label: "A", icon: () => null, requiresPro: true },
      { href: "/b", label: "B", icon: () => null },
    ];
    const filtered = filterNavItems(customItems, {
      tier: "pro",
      isAdmin: false,
    });
    expect(filtered.map((i) => i.href)).toEqual(["/c", "/a", "/b"]);
  });
});
