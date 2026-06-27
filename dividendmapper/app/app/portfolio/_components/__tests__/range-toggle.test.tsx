import { describe, it, expect, beforeEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import {
  RangeToggle,
  readStoredRange,
  RANGE_STORAGE_KEY,
  RANGE_CHANGE_EVENT,
} from "../range-toggle";

beforeEach(() => {
  window.localStorage.clear();
});

describe("readStoredRange", () => {
  it("returns 30D when nothing stored", () => {
    expect(readStoredRange()).toBe("30D");
  });
  it("returns the stored value when valid", () => {
    window.localStorage.setItem(RANGE_STORAGE_KEY, "1Y");
    expect(readStoredRange()).toBe("1Y");
  });
  it("returns 30D when an invalid value is stored", () => {
    window.localStorage.setItem(RANGE_STORAGE_KEY, "bogus");
    expect(readStoredRange()).toBe("30D");
  });
});

describe("RangeToggle", () => {
  it("renders three buttons labelled 30D / 1Y / 5Y", () => {
    const { getByRole } = render(<RangeToggle />);
    for (const label of ["30D", "1Y", "5Y"]) {
      expect(getByRole("button", { name: label })).toBeDefined();
    }
  });

  it("highlights the active range as aria-pressed=true", () => {
    window.localStorage.setItem(RANGE_STORAGE_KEY, "1Y");
    const { getByRole } = render(<RangeToggle />);
    expect(getByRole("button", { name: "1Y" }).getAttribute("aria-pressed")).toBe("true");
    expect(getByRole("button", { name: "30D" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("persists the choice + broadcasts the custom event on click", () => {
    let fired = 0;
    window.addEventListener(RANGE_CHANGE_EVENT, () => {
      fired++;
    });
    const { getByRole } = render(<RangeToggle />);
    act(() => {
      fireEvent.click(getByRole("button", { name: "5Y" }));
    });
    expect(window.localStorage.getItem(RANGE_STORAGE_KEY)).toBe("5Y");
    expect(fired).toBeGreaterThan(0);
  });
});
