import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DRAWER_COLLAPSED_STORAGE_KEY,
  DrawerCollapsedProvider,
  useDrawerCollapsed,
} from "../drawer-collapsed-context";

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  window.localStorage.clear();
});

function Consumer() {
  const { collapsed, setCollapsed } = useDrawerCollapsed();
  return (
    <div>
      <div data-testid="state">{collapsed ? "collapsed" : "expanded"}</div>
      <button type="button" onClick={() => setCollapsed(!collapsed)}>
        toggle
      </button>
    </div>
  );
}

describe("<DrawerCollapsedProvider>", () => {
  it("renders its children", () => {
    render(
      <DrawerCollapsedProvider>
        <span data-testid="child">hello</span>
      </DrawerCollapsedProvider>,
    );
    expect(screen.getByTestId("child")).toHaveTextContent("hello");
  });

  it("defaults to expanded (collapsed=false)", () => {
    render(
      <DrawerCollapsedProvider>
        <Consumer />
      </DrawerCollapsedProvider>,
    );
    expect(screen.getByTestId("state")).toHaveTextContent("expanded");
  });

  it("setCollapsed flips the value", async () => {
    const user = userEvent.setup();
    render(
      <DrawerCollapsedProvider>
        <Consumer />
      </DrawerCollapsedProvider>,
    );
    expect(screen.getByTestId("state")).toHaveTextContent("expanded");
    await user.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByTestId("state")).toHaveTextContent("collapsed");
    await user.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByTestId("state")).toHaveTextContent("expanded");
  });

  it("accepts an initialCollapsed override (Day 3 will use this for hydrated state)", () => {
    render(
      <DrawerCollapsedProvider initialCollapsed={true}>
        <Consumer />
      </DrawerCollapsedProvider>,
    );
    expect(screen.getByTestId("state")).toHaveTextContent("collapsed");
  });
});

describe("useDrawerCollapsed", () => {
  it("returns a safe default outside any provider (no throw)", () => {
    // Defensive — drawer-internal components should never render outside the
    // provider, but unit tests for sibling components may render in isolation.
    render(<Consumer />);
    expect(screen.getByTestId("state")).toHaveTextContent("expanded");
  });
});

describe("DrawerCollapsedProvider localStorage round-trip", () => {
  it("exposes the storage key as a public constant", () => {
    expect(DRAWER_COLLAPSED_STORAGE_KEY).toBe("dm.drawer.collapsed");
  });

  it("reads stored 'true' on mount and switches to collapsed", async () => {
    window.localStorage.setItem(DRAWER_COLLAPSED_STORAGE_KEY, "true");
    render(
      <DrawerCollapsedProvider>
        <Consumer />
      </DrawerCollapsedProvider>,
    );
    // SSR initial render is expanded; useEffect on mount reads localStorage
    // and flips the state. Verify the post-mount value.
    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent("collapsed"),
    );
  });

  it("reads stored 'false' on mount and stays expanded", async () => {
    window.localStorage.setItem(DRAWER_COLLAPSED_STORAGE_KEY, "false");
    render(
      <DrawerCollapsedProvider>
        <Consumer />
      </DrawerCollapsedProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent("expanded"),
    );
  });

  it("falls back to expanded when the stored value is corrupted/unrecognised", async () => {
    window.localStorage.setItem(DRAWER_COLLAPSED_STORAGE_KEY, "not-a-bool");
    render(
      <DrawerCollapsedProvider>
        <Consumer />
      </DrawerCollapsedProvider>,
    );
    // No flip — corrupted value is ignored.
    expect(screen.getByTestId("state")).toHaveTextContent("expanded");
  });

  it("writes 'true' to localStorage when setCollapsed(true) is called", async () => {
    const user = userEvent.setup();
    render(
      <DrawerCollapsedProvider>
        <Consumer />
      </DrawerCollapsedProvider>,
    );
    await user.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByTestId("state")).toHaveTextContent("collapsed");
    expect(
      window.localStorage.getItem(DRAWER_COLLAPSED_STORAGE_KEY),
    ).toBe("true");
  });

  it("writes 'false' to localStorage when collapsing back", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(DRAWER_COLLAPSED_STORAGE_KEY, "true");
    render(
      <DrawerCollapsedProvider>
        <Consumer />
      </DrawerCollapsedProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent("collapsed"),
    );
    await user.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByTestId("state")).toHaveTextContent("expanded");
    expect(
      window.localStorage.getItem(DRAWER_COLLAPSED_STORAGE_KEY),
    ).toBe("false");
  });

  it("syncs state across tabs via the window 'storage' event", async () => {
    render(
      <DrawerCollapsedProvider>
        <Consumer />
      </DrawerCollapsedProvider>,
    );
    expect(screen.getByTestId("state")).toHaveTextContent("expanded");

    // Tab B writes 'true' to localStorage AND the browser fires a StorageEvent
    // in tab A. In the real world the write lands first; we simulate both.
    act(() => {
      window.localStorage.setItem(DRAWER_COLLAPSED_STORAGE_KEY, "true");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: DRAWER_COLLAPSED_STORAGE_KEY,
          newValue: "true",
          storageArea: window.localStorage,
        }),
      );
    });

    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent("collapsed"),
    );
  });

  it("ignores storage events for unrelated keys", async () => {
    render(
      <DrawerCollapsedProvider>
        <Consumer />
      </DrawerCollapsedProvider>,
    );
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "some.other.key",
          newValue: "true",
          storageArea: window.localStorage,
        }),
      );
    });
    expect(screen.getByTestId("state")).toHaveTextContent("expanded");
  });

  it("ignores storage events with a corrupted newValue", async () => {
    window.localStorage.setItem(DRAWER_COLLAPSED_STORAGE_KEY, "true");
    render(
      <DrawerCollapsedProvider>
        <Consumer />
      </DrawerCollapsedProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent("collapsed"),
    );

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: DRAWER_COLLAPSED_STORAGE_KEY,
          newValue: "junk",
          storageArea: window.localStorage,
        }),
      );
    });
    // State holds at collapsed; junk event is ignored.
    expect(screen.getByTestId("state")).toHaveTextContent("collapsed");
  });
});
