import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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

  it("shows a visible ticker label on each scatter dot", () => {
    render(
      <QuadrantMap
        points={[point({ ticker: "PEP" }), point({ ticker: "PYPL", x: 20, y: 79 })]}
        excluded={[]}
        isBeta={false}
      />,
    );
    const scatter = screen.getByTestId("quadrant-scatter");
    expect(within(scatter).getByText("PEP")).toBeInTheDocument();
    expect(within(scatter).getByText("PYPL")).toBeInTheDocument();
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

describe("<QuadrantMap> graticule (brand accent #4)", () => {
  const points = [point({ ticker: "PEP" })];

  it("renders the graticule SVG group inside the scatter", () => {
    const { container } = render(
      <QuadrantMap points={points} excluded={[]} isBeta={false} />,
    );
    expect(
      container.querySelector("[data-testid='quadrant-graticule']"),
    ).not.toBeNull();
  });

  it("renders bolder gridlines at 25 / 50 / 75 on both axes", () => {
    const { container } = render(
      <QuadrantMap points={points} excluded={[]} isBeta={false} />,
    );
    const g = container.querySelector("[data-testid='quadrant-graticule']");
    const bold = g?.querySelectorAll("line[stroke-width='1']") ?? [];
    // 3 vertical + 3 horizontal bolder lines (25, 50, 75).
    expect(bold.length).toBeGreaterThanOrEqual(6);
  });

  it("renders minor gridlines (stroke-width 0.5)", () => {
    const { container } = render(
      <QuadrantMap points={points} excluded={[]} isBeta={false} />,
    );
    const g = container.querySelector("[data-testid='quadrant-graticule']");
    const minor = g?.querySelectorAll("line[stroke-width='0.5']") ?? [];
    // Minor lines at every 10% step (excluding the bolder 25/50/75).
    expect(minor.length).toBeGreaterThanOrEqual(12);
  });

  it("labels the 25 / 50 / 75 / 100 ticks on each axis", () => {
    const { container } = render(
      <QuadrantMap points={points} excluded={[]} isBeta={false} />,
    );
    const labels = container.querySelectorAll(
      "[data-testid='quadrant-axis-label']",
    );
    expect(labels.length).toBeGreaterThanOrEqual(8);
    const texts = Array.from(labels).map((el) => el.textContent ?? "");
    expect(texts).toContain("25");
    expect(texts).toContain("50");
    expect(texts).toContain("75");
    expect(texts).toContain("100");
  });
});

describe("<QuadrantMap> compact prop", () => {
  const points = [point({ ticker: "PEP" }), point({ ticker: "PYPL", x: 20, y: 79 })];

  it("defaults to non-compact when the prop is omitted", () => {
    const { container } = render(
      <QuadrantMap points={points} excluded={[]} isBeta={false} />,
    );
    const root = container.querySelector("[data-quadrant-root]");
    expect(root?.getAttribute("data-compact")).toBe("false");
  });

  it("flags compact mode on the root element", () => {
    const { container } = render(
      <QuadrantMap points={points} excluded={[]} isBeta={false} compact />,
    );
    const root = container.querySelector("[data-quadrant-root]");
    expect(root?.getAttribute("data-compact")).toBe("true");
  });

  it("hides the section header text in compact mode", () => {
    render(<QuadrantMap points={points} excluded={[]} isBeta={false} compact />);
    expect(screen.queryByText(/quality and risk map/i)).toBeNull();
  });

  it("keeps the section header in default mode", () => {
    render(<QuadrantMap points={points} excluded={[]} isBeta={false} />);
    expect(screen.getByText(/quality and risk map/i)).toBeInTheDocument();
  });
});
