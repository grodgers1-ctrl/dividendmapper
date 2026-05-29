import { describe, it, expect } from "vitest";
import { computeD2ExDivProximity } from "../d2-ex-div-proximity";

const asOf = new Date("2026-05-29T00:00:00Z");
const inDays = (n: number) =>
  new Date(asOf.getTime() + n * 24 * 60 * 60 * 1000).toISOString();

describe("computeD2ExDivProximity", () => {
  it("returns 100 when ex-div is within 14 days", () => {
    expect(computeD2ExDivProximity({ nextExDivDate: inDays(10), asOf }).score).toBe(100);
  });

  it("returns 70 when ex-div is within 30 days", () => {
    expect(computeD2ExDivProximity({ nextExDivDate: inDays(20), asOf }).score).toBe(70);
  });

  it("returns 50 when ex-div is within 60 days", () => {
    expect(computeD2ExDivProximity({ nextExDivDate: inDays(45), asOf }).score).toBe(50);
  });

  it("returns 30 when ex-div is more than 60 days away", () => {
    expect(computeD2ExDivProximity({ nextExDivDate: inDays(90), asOf }).score).toBe(30);
  });

  it("returns N/A when there is no upcoming ex-div", () => {
    expect(computeD2ExDivProximity({ nextExDivDate: null, asOf }).score).toBeNull();
  });

  it("returns N/A when the ex-div date is in the past", () => {
    expect(computeD2ExDivProximity({ nextExDivDate: inDays(-5), asOf }).score).toBeNull();
  });
});
