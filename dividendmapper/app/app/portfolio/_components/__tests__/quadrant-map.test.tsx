import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuadrantMap } from "../quadrant-map";
import type { QuadrantPoint } from "@/lib/scoring/quadrant";

vi.mock("../score-drawer", () => ({
  ScoreDrawer: ({ ticker, open }: { ticker: string; open: boolean }) =>
    open ? <div data-testid="score-drawer">{ticker}</div> : null,
}));

const point = (over: Partial<QuadrantPoint> & { ticker: string }): QuadrantPoint => ({
  ticker: over.ticker,
  x: over.x ?? 40,
  y: over.y ?? 78,
  trim: over.trim ?? 22,
  weight: over.weight ?? 0.1,
  radius: over.radius ?? 10,
  trimElevated: over.trimElevated ?? false,
  quadrant: over.quadrant ?? "core",
});

describe("<QuadrantMap>", () => {
  it("renders a dot button per point", () => {
    render(
      <QuadrantMap
        points={[point({ ticker: "PEP" }), point({ ticker: "PYPL", x: 20, y: 79 })]}
        excluded={[]}
        isBeta={false}
      />,
    );
    // Desktop scatter + mobile list both render in jsdom, so each ticker
    // appears more than once; assert presence rather than uniqueness.
    expect(screen.getAllByRole("button", { name: /PEP/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /PYPL/ }).length).toBeGreaterThan(0);
  });

  it("lists excluded holdings with Risk, Trim and reason, collecting last", () => {
    render(
      <QuadrantMap
        points={[point({ ticker: "PEP" })]}
        excluded={[
          { ticker: "SCHD", risk: 60, trim: 88, reason: "ETF or fund, not company-scored", collecting: false },
          { ticker: "BOWL.L", risk: null, trim: null, reason: "Collecting…", collecting: true },
        ]}
        isBeta={false}
      />,
    );
    expect(screen.getByText(/SCHD/)).toBeInTheDocument();
    expect(
      screen.getByText(/ETF or fund, not company-scored/),
    ).toBeInTheDocument();
    // Risk + Trim surfaced for a gate-failer.
    expect(screen.getByText(/R\s*60/)).toBeInTheDocument();
    expect(screen.getByText(/T\s*88/)).toBeInTheDocument();
    // Collecting row present for the no-row ticker.
    expect(screen.getByText("BOWL.L")).toBeInTheDocument();
    expect(screen.getByText(/Collecting/)).toBeInTheDocument();
  });

  it("opens the score drawer when a dot is clicked", () => {
    render(
      <QuadrantMap points={[point({ ticker: "PEP" })]} excluded={[]} isBeta={false} />,
    );
    expect(screen.queryByTestId("score-drawer")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: /PEP/ })[0]);
    expect(screen.getByTestId("score-drawer")).toHaveTextContent("PEP");
  });

  it("shows an empty state when there are no points", () => {
    render(<QuadrantMap points={[]} excluded={[]} isBeta={false} />);
    expect(screen.getByText(/no scored holdings to map yet/i)).toBeInTheDocument();
  });
});
