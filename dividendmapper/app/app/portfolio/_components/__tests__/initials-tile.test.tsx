import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { InitialsTile, hashHue } from "../initials-tile";

describe("hashHue", () => {
  it("is deterministic for the same ticker", () => {
    expect(hashHue("AAPL")).toBe(hashHue("AAPL"));
    expect(hashHue("BME.L")).toBe(hashHue("BME.L"));
  });

  it("differs across distinct tickers", () => {
    expect(hashHue("AAPL")).not.toBe(hashHue("PYPL"));
  });

  it("returns a value in [0, 360)", () => {
    for (const t of ["A", "AAPL", "BME.L", "401k", "VERY_LONG_TICKER_NAME"]) {
      const h = hashHue(t);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    }
  });
});

describe("InitialsTile", () => {
  it("renders 1-2 uppercase alphanumerics from the ticker", () => {
    const { getByRole } = render(<InitialsTile ticker="AAPL" />);
    expect(getByRole("img").textContent).toBe("AA");
  });

  it("strips non-alphanumerics", () => {
    const { getByRole } = render(<InitialsTile ticker="BME.L" />);
    expect(getByRole("img").textContent).toBe("BM");
  });

  it("falls back to a single letter when only one alphanumeric is present", () => {
    const { getByRole } = render(<InitialsTile ticker="X" />);
    expect(getByRole("img").textContent).toBe("X");
  });

  it("falls back to ? when no alphanumerics", () => {
    const { getByRole } = render(<InitialsTile ticker="$$$" />);
    expect(getByRole("img").textContent).toBe("?");
  });

  it("uses the same colour for the same ticker across renders", () => {
    const renderA = render(<InitialsTile ticker="AAPL" />);
    const a = renderA.container.querySelector("[role='img']") as HTMLElement;
    renderA.unmount();
    const renderB = render(<InitialsTile ticker="AAPL" />);
    const b = renderB.container.querySelector("[role='img']") as HTMLElement;
    expect(a.style.backgroundColor).toBe(b.style.backgroundColor);
  });

  it("has an accessible label including the ticker", () => {
    const { getByRole } = render(<InitialsTile ticker="AAPL" />);
    expect(getByRole("img").getAttribute("aria-label")).toContain("AAPL");
  });
});
