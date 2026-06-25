import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Step1Welcome } from "../step-1-welcome";

describe("Step1Welcome", () => {
  it("renders the locked headline and body", () => {
    render(<Step1Welcome onAdvance={() => {}} onSkipTour={() => {}} />);
    expect(screen.getByText(/welcome to dividendmapper\./i)).toBeInTheDocument();
    expect(screen.getByText(/first quality score/i)).toBeInTheDocument();
    expect(screen.getByText(/takes about a minute/i)).toBeInTheDocument();
  });

  it("Let's go advances and Skip the tour dismisses", () => {
    const onAdvance = vi.fn();
    const onSkipTour = vi.fn();
    render(<Step1Welcome onAdvance={onAdvance} onSkipTour={onSkipTour} />);
    fireEvent.click(screen.getByRole("button", { name: /let's go/i }));
    expect(onAdvance).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: /skip the tour/i }));
    expect(onSkipTour).toHaveBeenCalledOnce();
  });
});
