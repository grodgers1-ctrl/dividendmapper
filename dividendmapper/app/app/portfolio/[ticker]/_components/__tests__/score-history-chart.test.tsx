import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { ScoreHistoryChart } from "@/app/app/portfolio/[ticker]/_components/ScoreHistoryChart";

afterEach(cleanup);

function series() {
  return [
    { date: "2026-05-01", buy: 70, trim: 30, risk: 25 },
    { date: "2026-05-10", buy: 72, trim: 28, risk: 22 },
    { date: "2026-05-20", buy: 75, trim: 25, risk: 20 },
    { date: "2026-05-30", buy: 78, trim: 22, risk: 18 },
  ];
}

describe("<ScoreHistoryChart>", () => {
  it("renders three score lines (Quality, Trim, Risk)", () => {
    const { container } = render(<ScoreHistoryChart series={series()} />);
    const lines = container.querySelectorAll("[data-testid='score-history-line']");
    expect(lines.length).toBe(3);
  });

  it("renders a graticule layer with 5 horizontal lines (0/25/50/75/100)", () => {
    const { container } = render(<ScoreHistoryChart series={series()} />);
    const g = container.querySelector("[data-testid='score-history-graticule']");
    expect(g).not.toBeNull();
    const gridLines = g?.querySelectorAll("line") ?? [];
    expect(gridLines.length).toBeGreaterThanOrEqual(5);
  });

  it("renders a legend with Quality / Trim / Risk labels", () => {
    render(<ScoreHistoryChart series={series()} />);
    expect(screen.getByText("Quality")).toBeInTheDocument();
    expect(screen.getByText("Trim")).toBeInTheDocument();
    expect(screen.getByText("Risk")).toBeInTheDocument();
  });

  it("renders an empty state when the series is empty", () => {
    render(<ScoreHistoryChart series={[]} />);
    expect(screen.getByText(/history collecting/i)).toBeInTheDocument();
  });

  it("is deterministic for a fixed series", () => {
    const first = render(<ScoreHistoryChart series={series()} />);
    const firstHtml = first.container.innerHTML;
    cleanup();
    const second = render(<ScoreHistoryChart series={series()} />);
    expect(second.container.innerHTML).toBe(firstHtml);
  });
});
