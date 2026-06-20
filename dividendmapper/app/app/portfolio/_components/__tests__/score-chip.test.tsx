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

  it("uses the deep-green colour as the border for a high buy score", () => {
    render(<ScoreChip type="buy" score={80} />);
    // Day 8 restyle: colour moved from bg to a 1px border. data-color still
    // exposes the tone hex so downstream tests can pin it.
    expect(screen.getByTestId("score-chip")).toHaveAttribute("data-color", "#0a8a4f");
  });

  it("renders DNQ as text on a neutral grey outline (no number)", () => {
    render(
      <ScoreChip type="buy" score={null} gateReason="ETF or fund, not company-scored" />,
    );
    const chip = screen.getByTestId("score-chip");
    expect(screen.getByText("DNQ")).toBeInTheDocument();
    // The gate-fail tone is neutral grey, NOT the score-coloured border.
    expect(chip).toHaveAttribute("data-color", "#94a3b8");
    expect(chip).toHaveAttribute("title", "ETF or fund, not company-scored");
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ETF or fund/)).not.toBeInTheDocument();
  });

  it("does NOT render a β superscript even when isBeta", () => {
    render(<ScoreChip type="buy" score={76} isBeta />);
    expect(screen.queryByText("β")).not.toBeInTheDocument();
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
