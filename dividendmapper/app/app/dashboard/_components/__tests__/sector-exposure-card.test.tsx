import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SectorExposureCard } from "../SectorExposureCard";

const rollup = {
  top: [
    { sector: "technology", weight: 0.43 },
    { sector: "consumer_staples", weight: 0.19 },
    { sector: "financial", weight: 0.17 },
    { sector: "consumer_discretionary", weight: 0.13 },
    { sector: "industrials", weight: 0.06 },
  ],
  other: { sector: "Smaller Sectors", weight: 0.02 },
  max: { sector: "technology", weight: 0.43 },
};

describe("SectorExposureCard", () => {
  it("renders a doughnut SVG with six slices (top-5 + tail)", () => {
    const { container } = render(<SectorExposureCard rollup={rollup} />);
    const slices = container.querySelectorAll("svg circle[stroke-dasharray]");
    expect(slices).toHaveLength(6);
  });

  it("renders the side legend with Title Case sector names", () => {
    const { getByText } = render(<SectorExposureCard rollup={rollup} />);
    expect(getByText("Technology")).toBeInTheDocument();
    expect(getByText("Consumer Staples")).toBeInTheDocument();
    expect(getByText("Financial")).toBeInTheDocument();
    expect(getByText("Consumer Discretionary")).toBeInTheDocument();
    expect(getByText("Industrials")).toBeInTheDocument();
    expect(getByText("Smaller Sectors")).toBeInTheDocument();
  });

  it("shows the sector count in the doughnut centre", () => {
    const { getByText } = render(<SectorExposureCard rollup={rollup} />);
    expect(getByText("6")).toBeInTheDocument();
    expect(getByText("sectors")).toBeInTheDocument();
  });

  it("renders an overweight pill when max.weight > 0.35, using Title Case", () => {
    const { getByTestId } = render(<SectorExposureCard rollup={rollup} />);
    const pill = getByTestId("sector-overweight-pill");
    expect(pill.textContent).toContain("Technology");
    expect(pill.textContent).toContain("43%");
  });

  it("omits the overweight pill when max.weight ≤ 0.35", () => {
    const quietRollup = { ...rollup, max: { sector: "technology", weight: 0.33 } };
    const { queryByTestId } = render(<SectorExposureCard rollup={quietRollup} />);
    expect(queryByTestId("sector-overweight-pill")).toBeNull();
  });

  it("uses the shared card-surface utility class", () => {
    const { container } = render(<SectorExposureCard rollup={rollup} />);
    expect(container.firstChild).toHaveClass("card-surface");
  });

  it("renders the empty state when rollup.top is empty", () => {
    const empty = { top: [], other: null, max: null };
    const { getByText } = render(<SectorExposureCard rollup={empty} />);
    expect(getByText(/Sectors collecting/)).toBeInTheDocument();
  });
});
