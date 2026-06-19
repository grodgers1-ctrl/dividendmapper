import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DrawerCollapsedProvider,
  useDrawerCollapsed,
} from "../drawer-collapsed-context";

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
