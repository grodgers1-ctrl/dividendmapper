import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { SectorExposureCard } from "@/app/app/dashboard/_components/SectorExposureCard";
import type { SectorRollup } from "@/lib/portfolio/sector-exposure";

afterEach(cleanup);

function rollup(over: Partial<SectorRollup> = {}): SectorRollup {
  return {
    top: [
      { sector: "technology", weight: 0.4 },
      { sector: "financials", weight: 0.25 },
      { sector: "healthcare", weight: 0.15 },
    ],
    other: { sector: "Other", weight: 0.2 },
    max: { sector: "technology", weight: 0.4 },
    ...over,
  };
}

describe("<SectorExposureCard>", () => {
  it("renders the eyebrow 'Sector exposure'", () => {
    render(<SectorExposureCard rollup={rollup()} />);
    expect(screen.getByText(/sector exposure/i)).toBeTruthy();
  });

  it("renders all top-3 sector names with title-cased labels", () => {
    render(<SectorExposureCard rollup={rollup()} />);
    // Technology appears in both the row label and the overweight pill.
    expect(screen.getAllByText(/Technology/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Financials/i)).toBeTruthy();
    expect(screen.getByText(/Healthcare/i)).toBeTruthy();
  });

  it("renders an Other row when there are more sectors than topN", () => {
    render(<SectorExposureCard rollup={rollup()} />);
    expect(screen.getByText(/Other/)).toBeTruthy();
    expect(screen.getByText("20%")).toBeTruthy();
  });

  it("does not render the Other row when other is null", () => {
    render(<SectorExposureCard rollup={rollup({ other: null })} />);
    expect(screen.queryByText(/Other/)).toBeNull();
  });

  it("renders a heavily-formatted weight pct per slice", () => {
    render(<SectorExposureCard rollup={rollup()} />);
    expect(screen.getByText("40%")).toBeTruthy();
    expect(screen.getByText("25%")).toBeTruthy();
    expect(screen.getByText("15%")).toBeTruthy();
  });

  it("renders an overweight pill when max.weight > 35%", () => {
    render(<SectorExposureCard rollup={rollup()} />);
    const pill = screen.getByTestId("sector-overweight-pill");
    expect(pill).toBeTruthy();
    expect(pill.textContent).toContain("Technology");
    expect(pill.textContent).toContain("40%");
  });

  it("omits the overweight pill when max.weight ≤ 35%", () => {
    render(
      <SectorExposureCard
        rollup={rollup({
          top: [
            { sector: "technology", weight: 0.3 },
            { sector: "financials", weight: 0.25 },
            { sector: "healthcare", weight: 0.15 },
          ],
          max: { sector: "technology", weight: 0.3 },
        })}
      />,
    );
    expect(screen.queryByTestId("sector-overweight-pill")).toBeNull();
  });

  it("renders an empty state when top is empty", () => {
    render(
      <SectorExposureCard rollup={{ top: [], other: null, max: null }} />,
    );
    expect(screen.getByText(/sectors collecting/i)).toBeTruthy();
  });
});
