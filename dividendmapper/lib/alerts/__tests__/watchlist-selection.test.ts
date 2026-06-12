import { describe, it, expect } from "vitest";
import { watchedNotHeld } from "../watchlist-selection";

describe("watchedNotHeld", () => {
  it("returns watched tickers the user does not hold", () => {
    expect(watchedNotHeld(["AAPL", "VOD.L", "MSFT"], ["MSFT"])).toEqual(["AAPL", "VOD.L"]);
  });

  it("returns all watched tickers when nothing is held", () => {
    expect(watchedNotHeld(["AAPL", "MSFT"], [])).toEqual(["AAPL", "MSFT"]);
  });

  it("returns an empty array when every watched ticker is also held", () => {
    expect(watchedNotHeld(["AAPL", "MSFT"], ["MSFT", "AAPL"])).toEqual([]);
  });

  it("de-duplicates repeated watched tickers", () => {
    expect(watchedNotHeld(["AAPL", "AAPL", "MSFT"], ["MSFT"])).toEqual(["AAPL"]);
  });

  it("returns an empty array for an empty watchlist", () => {
    expect(watchedNotHeld([], ["MSFT"])).toEqual([]);
  });
});
