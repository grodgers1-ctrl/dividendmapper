import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, render, screen, act } from "@testing-library/react";
import { pageTitleStore } from "../page-title-store";
import { PageTitleSync } from "../page-title-sync";
import { usePageTitle } from "../use-page-title";

beforeEach(() => {
  pageTitleStore.set("");
});

describe("pageTitleStore", () => {
  it("reads and writes the current title", () => {
    pageTitleStore.set("Ledger");
    expect(pageTitleStore.get()).toBe("Ledger");
  });

  it("notifies subscribers when the title changes", () => {
    let calls = 0;
    const unsubscribe = pageTitleStore.subscribe(() => {
      calls++;
    });
    pageTitleStore.set("Scoring");
    expect(calls).toBe(1);
    pageTitleStore.set("Watchlist");
    expect(calls).toBe(2);
    unsubscribe();
    pageTitleStore.set("Account");
    expect(calls).toBe(2); // no more after unsubscribe
  });

  it("skips notification when the new value equals the current value", () => {
    pageTitleStore.set("Account");
    let calls = 0;
    const unsubscribe = pageTitleStore.subscribe(() => {
      calls++;
    });
    pageTitleStore.set("Account");
    expect(calls).toBe(0);
    unsubscribe();
  });
});

describe("usePageTitle + <PageTitleSync>", () => {
  it("returns the current title from the store", () => {
    pageTitleStore.set("Hello");
    const { result } = renderHook(() => usePageTitle());
    expect(result.current).toBe("Hello");
  });

  it("PageTitleSync sets the title on mount and clears on unmount", () => {
    const { unmount } = render(<PageTitleSync title="Portfolio Manager" />);
    expect(pageTitleStore.get()).toBe("Portfolio Manager");
    unmount();
    expect(pageTitleStore.get()).toBe("");
  });

  it("usePageTitle re-renders when the title broadcasts", () => {
    function Probe() {
      return <span data-testid="title">{usePageTitle()}</span>;
    }
    render(<Probe />);
    expect(screen.getByTestId("title")).toHaveTextContent("");
    act(() => {
      pageTitleStore.set("Account");
    });
    expect(screen.getByTestId("title")).toHaveTextContent("Account");
  });
});
