import { describe, it, expect } from "vitest";
import { nextUpcomingDividend } from "../next-dividend";
import type { FmpCalendarDividend } from "../fmp-client";

const row = (over: Partial<FmpCalendarDividend>): FmpCalendarDividend => ({
  symbol: "PEP",
  date: "2026-06-05",
  adjDividend: 1.48,
  dividend: 1.48,
  paymentDate: "2026-06-30",
  ...over,
});

describe("nextUpcomingDividend", () => {
  it("returns the soonest row on or after today for the ticker", () => {
    const cal = [
      row({ symbol: "PEP", date: "2026-06-05" }),
      row({ symbol: "PEP", date: "2026-09-05", dividend: 1.5 }),
      row({ symbol: "MSFT", date: "2026-06-01" }),
    ];
    const out = nextUpcomingDividend(cal, "PEP", "2026-05-31");
    expect(out?.date).toBe("2026-06-05");
    expect(out?.dividend).toBe(1.48);
  });

  it("ignores past ex-div dates", () => {
    const cal = [row({ date: "2026-05-20" }), row({ date: "2026-08-20" })];
    expect(nextUpcomingDividend(cal, "PEP", "2026-05-31")?.date).toBe("2026-08-20");
  });

  it("treats today as in-window (>= today)", () => {
    const cal = [row({ date: "2026-05-31" })];
    expect(nextUpcomingDividend(cal, "PEP", "2026-05-31")?.date).toBe("2026-05-31");
  });

  it("returns null when the ticker has no upcoming row", () => {
    const cal = [row({ symbol: "MSFT", date: "2026-06-05" })];
    expect(nextUpcomingDividend(cal, "PEP", "2026-05-31")).toBeNull();
  });

  it("returns null for an empty calendar", () => {
    expect(nextUpcomingDividend([], "PEP", "2026-05-31")).toBeNull();
  });
});
