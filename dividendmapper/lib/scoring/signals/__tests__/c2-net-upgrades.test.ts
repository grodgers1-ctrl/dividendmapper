import { describe, it, expect } from "vitest";
import { computeC2NetUpgrades, type GradeChange } from "../c2-net-upgrades";

const asOf = new Date("2026-05-29T00:00:00Z");
// All recent dates within the 90d window relative to asOf.
const recent = (daysAgo: number) =>
  new Date(asOf.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

const events = (actions: string[], daysAgo = 5): GradeChange[] =>
  actions.map((action) => ({ action, date: recent(daysAgo) }));

describe("computeC2NetUpgrades", () => {
  it("returns 100 when net upgrades >= +5", () => {
    const result = computeC2NetUpgrades({
      events: events(["Upgrade", "Upgrade", "Upgrade", "Upgrade", "Upgrade"]),
      asOf,
    });
    expect(result.score).toBe(100);
  });

  it("returns 0 when net upgrades <= -5", () => {
    const result = computeC2NetUpgrades({
      events: events(["Downgrade", "Downgrade", "Downgrade", "Downgrade", "Downgrade"]),
      asOf,
    });
    expect(result.score).toBe(0);
  });

  it("returns 50 at net zero", () => {
    const result = computeC2NetUpgrades({
      events: events(["Upgrade", "Upgrade", "Downgrade", "Downgrade"]),
      asOf,
    });
    expect(result.score).toBe(50);
  });

  it("returns N/A when fewer than 3 events in 90d", () => {
    const result = computeC2NetUpgrades({
      events: events(["Upgrade", "Downgrade"]),
      asOf,
    });
    expect(result.score).toBeNull();
    expect(result.humanLabel).toMatch(/thin/i);
  });

  it("excludes events older than 90d (falls to N/A when too few remain)", () => {
    const result = computeC2NetUpgrades({
      events: events(["Upgrade", "Upgrade", "Upgrade", "Upgrade"], 200),
      asOf,
    });
    expect(result.score).toBeNull();
  });
});
