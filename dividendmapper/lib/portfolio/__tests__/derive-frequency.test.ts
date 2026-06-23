import { describe, it, expect } from "vitest";
import { deriveFrequency } from "@/lib/portfolio/derive-frequency";

const asOf = new Date("2026-06-22T00:00:00Z");
const DAY = 86_400_000;

// Build N payment dates spread evenly over the last `spanDays`, ending today.
function evenDates(n: number, spanDays: number): string[] {
  if (n === 0) return [];
  const step = (spanDays * DAY) / Math.max(n - 1, 1);
  const out: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const t = asOf.getTime() - (n - 1 - i) * step;
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

describe("deriveFrequency", () => {
  it("classifies 12 evenly-spaced payments as monthly", () => {
    // Spread over 18 months so the oldest is well past the 1y gate.
    expect(deriveFrequency(evenDates(18, 540), asOf)).toBe("monthly");
  });

  it("classifies 4 payments in TTM as quarterly when history is >1y", () => {
    // 8 quarterly payments → 2 years of history; last 4 in TTM
    expect(deriveFrequency(evenDates(8, 730), asOf)).toBe("quarterly");
  });

  it("classifies 2 payments in TTM as semi-annual when history is >1y", () => {
    // 4 semi-annual payments → 2 years of history; last 2 in TTM
    expect(deriveFrequency(evenDates(4, 730), asOf)).toBe("semi-annual");
  });

  it("classifies 1 payment in TTM as annual when history is >1y", () => {
    // 2 annual payments — older one outside TTM (380d), recent one today.
    expect(
      deriveFrequency(
        [
          new Date(asOf.getTime() - 380 * DAY).toISOString().slice(0, 10),
          asOf.toISOString().slice(0, 10),
        ],
        asOf,
      ),
    ).toBe("annual");
  });

  it("returns null when no payments at all", () => {
    expect(deriveFrequency([], asOf)).toBeNull();
  });

  it("returns null when history is less than 1 year", () => {
    // 4 payments over 6 months — quarterly cadence but not enough history yet.
    expect(deriveFrequency(evenDates(4, 180), asOf)).toBeNull();
  });

  it("returns null for an ambiguous TTM count (e.g. 6 payments)", () => {
    // History is long enough but cadence doesn't match any class.
    const dates: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      const t = asOf.getTime() - (i * 50 * DAY);
      dates.push(new Date(t).toISOString().slice(0, 10));
    }
    // Old anchor to clear the 1y gate
    dates.push(new Date(asOf.getTime() - 400 * DAY).toISOString().slice(0, 10));
    expect(deriveFrequency(dates, asOf)).toBeNull();
  });

  it("treats exactly 10 TTM payments as monthly", () => {
    // 10 evenly spaced across the last year + an older anchor for history gate
    const dates: string[] = [];
    for (let i = 0; i < 10; i += 1) {
      const t = asOf.getTime() - (i * 36 * DAY);
      dates.push(new Date(t).toISOString().slice(0, 10));
    }
    dates.push(new Date(asOf.getTime() - 400 * DAY).toISOString().slice(0, 10));
    expect(deriveFrequency(dates, asOf)).toBe("monthly");
  });
});
