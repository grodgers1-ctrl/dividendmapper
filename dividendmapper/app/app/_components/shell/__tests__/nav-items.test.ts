import { describe, it, expect } from "vitest";
import {
  DEFAULT_NAV_ITEMS,
  filterNavItems,
  type NavItem,
} from "../nav-items";

describe("DEFAULT_NAV_ITEMS", () => {
  it("declares the ten drawer items in display order (Calendar, Income vehicles, ETFs, and Inspect included)", () => {
    expect(DEFAULT_NAV_ITEMS.map((i) => i.href)).toEqual([
      "/app/dashboard",
      "/app/calendar",
      "/app/portfolio",
      "/app/portfolio/scoring",
      "/app/income-vehicles",
      "/app/etfs",
      "/app/portfolio/watchlist",
      "/app/inspect",
      "/app/account",
      "/app/admin/scoring/audit",
    ]);
  });

  it("marks the Pro-only items as requiresPro", () => {
    const byHref = Object.fromEntries(
      DEFAULT_NAV_ITEMS.map((i) => [i.href, i] as const),
    );
    expect(byHref["/app/calendar"].requiresPro).toBe(true);
    expect(byHref["/app/portfolio/scoring"].requiresPro).toBe(true);
    expect(byHref["/app/income-vehicles"].requiresPro).toBe(true);
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
  it("free non-admin → 5 items (Dashboard, Ledger, ETFs, Inspect, Account)", () => {
    const items = filterNavItems(DEFAULT_NAV_ITEMS, {
      tier: "free",
      isAdmin: false,
    });
    expect(items.map((i) => i.href)).toEqual([
      "/app/dashboard",
      "/app/portfolio",
      "/app/etfs",
      "/app/inspect",
      "/app/account",
    ]);
  });

  it("pro non-admin → 9 items (adds Calendar + Portfolio Manager + Income vehicles + Watchlist + Inspect)", () => {
    const items = filterNavItems(DEFAULT_NAV_ITEMS, {
      tier: "pro",
      isAdmin: false,
    });
    expect(items).toHaveLength(9);
    expect(items.map((i) => i.href)).toEqual([
      "/app/dashboard",
      "/app/calendar",
      "/app/portfolio",
      "/app/portfolio/scoring",
      "/app/income-vehicles",
      "/app/etfs",
      "/app/portfolio/watchlist",
      "/app/inspect",
      "/app/account",
    ]);
  });

  it("premium counts as Pro-equivalent (founding-member path)", () => {
    const items = filterNavItems(DEFAULT_NAV_ITEMS, {
      tier: "premium",
      isAdmin: false,
    });
    expect(items).toHaveLength(9);
    expect(items.map((i) => i.href)).toContain("/app/calendar");
    expect(items.map((i) => i.href)).toContain("/app/income-vehicles");
  });

  it("admin pro → 10 items (adds Admin)", () => {
    const items = filterNavItems(DEFAULT_NAV_ITEMS, {
      tier: "pro",
      isAdmin: true,
    });
    expect(items).toHaveLength(10);
    expect(items.map((i) => i.href)).toContain("/app/admin/scoring/audit");
  });

  it("admin free → 6 items (Dashboard, Ledger, ETFs, Inspect, Account, Admin) — Pro items still hidden", () => {
    const items = filterNavItems(DEFAULT_NAV_ITEMS, {
      tier: "free",
      isAdmin: true,
    });
    expect(items.map((i) => i.href)).toEqual([
      "/app/dashboard",
      "/app/portfolio",
      "/app/etfs",
      "/app/inspect",
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

describe("nav-items v2 — Calendar", () => {
  it("includes a Calendar entry between Dashboard and Ledger", () => {
    const labels = DEFAULT_NAV_ITEMS.map((i) => i.label);
    const dashboardIdx = labels.indexOf("Dashboard");
    const calendarIdx = labels.indexOf("Calendar");
    const portfolioMgrIdx = labels.indexOf("Portfolio Manager");
    expect(calendarIdx).toBeGreaterThan(dashboardIdx);
    expect(calendarIdx).toBeLessThan(portfolioMgrIdx);
  });

  it("Calendar requires Pro", () => {
    const filteredFree = filterNavItems(DEFAULT_NAV_ITEMS, { tier: "free", isAdmin: false });
    expect(filteredFree.find((i) => i.label === "Calendar")).toBeUndefined();
    const filteredPro = filterNavItems(DEFAULT_NAV_ITEMS, { tier: "pro", isAdmin: false });
    expect(filteredPro.find((i) => i.label === "Calendar")).toBeDefined();
  });
});
