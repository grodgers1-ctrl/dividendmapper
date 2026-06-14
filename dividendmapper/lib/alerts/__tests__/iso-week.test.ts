import { describe, it, expect } from "vitest";
import { isoWeekKey } from "../iso-week";

describe("isoWeekKey", () => {
  it("formats as YYYY-Www with a zero-padded two-digit week", () => {
    expect(isoWeekKey(new Date("2021-01-04T00:00:00Z"))).toBe("2021-W01");
  });

  it("assigns the same key to every day Mon..Sun of one ISO week", () => {
    // 2021-01-04 is a Monday; 2021-01-10 the following Sunday.
    expect(isoWeekKey(new Date("2021-01-04T00:00:00Z"))).toBe("2021-W01");
    expect(isoWeekKey(new Date("2021-01-10T23:59:59Z"))).toBe("2021-W01");
  });

  it("rolls a year-boundary week into the year of its Thursday", () => {
    // 2020-12-31 is a Thursday -> belongs to 2020, week 53.
    expect(isoWeekKey(new Date("2020-12-31T00:00:00Z"))).toBe("2020-W53");
  });
});
