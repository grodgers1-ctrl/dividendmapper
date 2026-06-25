import { describe, it, expect, vi, beforeEach } from "vitest";
import { redirect } from "next/navigation";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
}));

const requireUserMock = vi.fn();
vi.mock("@/lib/auth/server", () => ({
  requireUser: (path: string) => requireUserMock(path),
}));

const loadPricedHoldingsMock = vi.fn();
vi.mock("@/lib/portfolio/load-priced-holdings", () => ({
  loadPricedHoldings: (id: string) => loadPricedHoldingsMock(id),
}));

const loadCalendarDataMock = vi.fn();
vi.mock("@/lib/portfolio/load-calendar-data", () => ({
  loadCalendarData: (...args: unknown[]) => loadCalendarDataMock(...args),
}));

import CalendarPage from "../page";

describe("/app/calendar page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({ id: "u1", email: "u@example.com" });
    loadCalendarDataMock.mockResolvedValue({
      userDividends: [],
      exDivByTicker: {},
      ratesToPrimary: { GBP: 1, USD: 0.79 },
    });
  });

  it("calls requireUser with the soft-nav-safe currentPath", async () => {
    loadPricedHoldingsMock.mockResolvedValue({
      tier: "pro",
      allHoldings: [],
      visibleRows: [],
      quotes: [],
      quotesByTicker: {},
      priceByTicker: {},
      nameByTicker: {},
      actualsByKey: new Map(),
      income: { gbp: 0 },
    });
    await CalendarPage();
    expect(requireUserMock).toHaveBeenCalledWith("/app/calendar");
  });

  it("redirects free users to /pricing", async () => {
    loadPricedHoldingsMock.mockResolvedValue({
      tier: "free",
      allHoldings: [],
      visibleRows: [],
      quotes: [],
      quotesByTicker: {},
      priceByTicker: {},
      nameByTicker: {},
      actualsByKey: new Map(),
      income: { gbp: 0 },
    });
    await expect(CalendarPage()).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/pricing?from=/app/calendar");
  });
});
