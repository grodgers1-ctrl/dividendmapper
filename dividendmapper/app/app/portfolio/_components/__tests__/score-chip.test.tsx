import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScoreChip } from "../score-chip";

describe("<ScoreChip>", () => {
  it("renders the score number and type label", () => {
    render(<ScoreChip type="buy" score={76} />);
    expect(screen.getByText("76")).toBeInTheDocument();
    expect(screen.getByText(/quality/i)).toBeInTheDocument();
  });

  it("uses the deep-green colour for a high buy score", () => {
    render(<ScoreChip type="buy" score={80} />);
    expect(screen.getByTestId("score-chip")).toHaveAttribute("data-color", "#0a8a4f");
  });

  it("renders a charcoal DNQ chip with the reason on hover when score is null", () => {
    render(
      <ScoreChip type="buy" score={null} gateReason="ETF or fund, not company-scored" />,
    );
    const chip = screen.getByTestId("score-chip");
    expect(chip).toHaveAttribute("data-color", "#27272a");
    expect(screen.getByText("DNQ")).toBeInTheDocument();
    expect(chip).toHaveAttribute("title", "ETF or fund, not company-scored");
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ETF or fund/)).not.toBeInTheDocument();
  });

  it("shows a β mark when isBeta", () => {
    render(<ScoreChip type="buy" score={76} isBeta />);
    expect(screen.getByText("β")).toBeInTheDocument();
  });

  it("shows the delta pill when a delta is supplied, and omits it otherwise", () => {
    const { rerender } = render(
      <ScoreChip type="buy" score={78} delta={{ value: 12, label: "+12", arrow: "↗" }} />,
    );
    expect(screen.getByText("+12")).toBeInTheDocument();
    expect(screen.getByText("↗")).toBeInTheDocument();
    rerender(<ScoreChip type="buy" score={78} delta={null} />);
    expect(screen.queryByText("+12")).not.toBeInTheDocument();
  });

  it("renders a Hidden state and fires onOpen when clicked", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<ScoreChip type="buy" score={76} hidden onOpen={onOpen} />);
    expect(screen.getByText(/hidden/i)).toBeInTheDocument();
    expect(screen.queryByText("76")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("score-chip"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
