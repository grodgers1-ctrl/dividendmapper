import { describe, it, expect } from "vitest";
import {
  DEFAULT_NAV_ITEMS,
  filterNavItems,
  type NavItem,
} from "../nav-items";

describe("DEFAULT_NAV_ITEMS", () => {
  it("declares the twelve drawer items in display order (Tools group before Account)", () => {
    expect(DEFAULT_NAV_ITEMS.map((i) => i.href)).toEqual([
      "/app/dashboard",
      "/app/calendar",
      "/app/portfolio",
      "/app/portfolio/scoring",
      "/app/income-vehicles",
      "/app/etfs",
      "/app/portfolio/watchlist",
      "/app/inspect",
      "/app/tools/dcf-calculator",
      "/app/tools/retirement-calculator",
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
  it("free non-admin → 7 items (free items + the two free Tools before Account)", () => {
    const items = filterNavItems(DEFAULT_NAV_ITEMS, {
      tier: "free",
      isAdmin: false,
    });
    expect(items.map((i) => i.href)).toEqual([
      "/app/dashboard",
      "/app/portfolio",
      "/app/etfs",
      "/app/inspect",
      "/app/tools/dcf-calculator",
      "/app/tools/retirement-calculator",
      "/app/account",
    ]);
  });

  it("pro non-admin → 11 items (Pro items + the two free Tools)", () => {
    const items = filterNavItems(DEFAULT_NAV_ITEMS, {
      tier: "pro",
      isAdmin: false,
    });
    expect(items).toHaveLength(11);
    expect(items.map((i) => i.href)).toEqual([
      "/app/dashboard",
      "/app/calendar",
      "/app/portfolio",
      "/app/portfolio/scoring",
      "/app/income-vehicles",
      "/app/etfs",
      "/app/portfolio/watchlist",
      "/app/inspect",
      "/app/tools/dcf-calculator",
      "/app/tools/retirement-calculator",
      "/app/account",
    ]);
  });

  it("premium counts as Pro-equivalent (founding-member path)", () => {
    const items = filterNavItems(DEFAULT_NAV_ITEMS, {
      tier: "premium",
      isAdmin: false,
    });
    expect(items).toHaveLength(11);
    expect(items.map((i) => i.href)).toContain("/app/calendar");
    expect(items.map((i) => i.href)).toContain("/app/income-vehicles");
  });

  it("admin pro → 12 items (adds Admin)", () => {
    const items = filterNavItems(DEFAULT_NAV_ITEMS, {
      tier: "pro",
      isAdmin: true,
    });
    expect(items).toHaveLength(12);
    expect(items.map((i) => i.href)).toContain("/app/admin/scoring/audit");
  });

  it("admin free → 8 items (free items + the two Tools + Admin) — Pro items still hidden", () => {
    const items = filterNavItems(DEFAULT_NAV_ITEMS, {
      tier: "free",
      isAdmin: true,
    });
    expect(items.map((i) => i.href)).toEqual([
      "/app/dashboard",
      "/app/portfolio",
      "/app/etfs",
      "/app/inspect",
      "/app/tools/dcf-calculator",
      "/app/tools/retirement-calculator",
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

describe("nav-items — Tools group", () => {
  const byHref = Object.fromEntries(
    DEFAULT_NAV_ITEMS.map((i) => [i.href, i] as const),
  );

  it("surfaces both calculators tagged into the Tools group", () => {
    expect(byHref["/app/tools/dcf-calculator"].group).toBe("Tools");
    expect(byHref["/app/tools/retirement-calculator"].group).toBe("Tools");
  });

  it("keeps the Tools calculators free for every signed-in tier", () => {
    expect(byHref["/app/tools/dcf-calculator"].requiresPro).toBeFalsy();
    expect(byHref["/app/tools/retirement-calculator"].requiresPro).toBeFalsy();
    const free = filterNavItems(DEFAULT_NAV_ITEMS, { tier: "free", isAdmin: false });
    expect(free.map((i) => i.href)).toContain("/app/tools/dcf-calculator");
    expect(free.map((i) => i.href)).toContain("/app/tools/retirement-calculator");
  });

  it("places the Tools group immediately before Account", () => {
    const hrefs = DEFAULT_NAV_ITEMS.map((i) => i.href);
    expect(hrefs.indexOf("/app/tools/retirement-calculator")).toBe(
      hrefs.indexOf("/app/account") - 1,
    );
    expect(hrefs.indexOf("/app/tools/dcf-calculator")).toBe(
      hrefs.indexOf("/app/tools/retirement-calculator") - 1,
    );
  });
});
