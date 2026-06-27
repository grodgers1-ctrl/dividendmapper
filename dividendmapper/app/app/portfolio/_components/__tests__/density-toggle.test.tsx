import { describe, it, expect, beforeEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import {
  DensityToggle,
  readStoredDensity,
  DENSITY_STORAGE_KEY,
  DENSITY_CHANGE_EVENT,
} from "../density-toggle";

beforeEach(() => {
  window.localStorage.clear();
});

describe("DensityToggle", () => {
  it("defaults to comfortable", () => {
    expect(readStoredDensity()).toBe("comfortable");
  });

  it("toggles between comfortable and compact on click", () => {
    let fired = 0;
    window.addEventListener(DENSITY_CHANGE_EVENT, () => {
      fired++;
    });
    const { getByRole } = render(<DensityToggle />);
    const btn = getByRole("button");
    act(() => {
      fireEvent.click(btn);
    });
    expect(window.localStorage.getItem(DENSITY_STORAGE_KEY)).toBe("compact");
    act(() => {
      fireEvent.click(btn);
    });
    expect(window.localStorage.getItem(DENSITY_STORAGE_KEY)).toBe("comfortable");
    expect(fired).toBe(2);
  });

  it("announces current state via aria-pressed", () => {
    window.localStorage.setItem(DENSITY_STORAGE_KEY, "compact");
    const { getByRole } = render(<DensityToggle />);
    expect(getByRole("button").getAttribute("aria-pressed")).toBe("true");
  });
});
