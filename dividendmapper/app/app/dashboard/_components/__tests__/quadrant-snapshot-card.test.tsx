import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { QuadrantSnapshotCard } from "@/app/app/dashboard/_components/QuadrantSnapshotCard";
import type { QuadrantPoint } from "@/lib/scoring/quadrant";

vi.mock("@/app/app/portfolio/_components/score-drawer", () => ({
  ScoreDrawer: () => null,
}));

afterEach(cleanup);

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

describe("<QuadrantSnapshotCard>", () => {
  it("renders the quadrant scatter in compact mode", () => {
    const { container } = render(
      <QuadrantSnapshotCard
        points={[point({ ticker: "PEP" })]}
        excluded={[]}
        isBeta={false}
      />,
    );
    expect(container.querySelector("[data-quadrant-root]")).not.toBeNull();
    expect(
      container.querySelector("[data-quadrant-root]")?.getAttribute("data-compact"),
    ).toBe("true");
    expect(container.querySelector("[data-testid='quadrant-scatter']")).not.toBeNull();
  });

  it("renders the graticule (inherited from QuadrantMap compact mode)", () => {
    const { container } = render(
      <QuadrantSnapshotCard
        points={[point({ ticker: "PEP" })]}
        excluded={[]}
        isBeta={false}
      />,
    );
    expect(
      container.querySelector("[data-testid='quadrant-graticule']"),
    ).not.toBeNull();
  });

  it("links to /app/portfolio/scoring via 'Open Portfolio Manager →'", () => {
    render(
      <QuadrantSnapshotCard
        points={[point({ ticker: "PEP" })]}
        excluded={[]}
        isBeta={false}
      />,
    );
    const link = screen.getByRole("link", { name: /open portfolio manager/i });
    expect(link.getAttribute("href")).toBe("/app/portfolio/scoring");
  });

  it("renders an empty state when there are no points", () => {
    render(
      <QuadrantSnapshotCard points={[]} excluded={[]} isBeta={false} />,
    );
    expect(screen.getByText(/no scored holdings to map yet/i)).toBeInTheDocument();
  });
});
