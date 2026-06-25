import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Step4Tour } from "../step-4-tour";

const captureClientEventMock = vi.fn();
vi.mock("@/lib/analytics/posthog-capture", () => ({
  captureClientEvent: (n: string, p?: Record<string, unknown>) => captureClientEventMock(n, p),
}));

describe("Step4Tour", () => {
  it("renders all three cards with target=_blank and rel=noopener", () => {
    render(<Step4Tour onAdvance={() => {}} onBack={() => {}} />);
    const incomeLink = screen.getByRole("link", { name: /your income chart/i });
    const scoringLink = screen.getByRole("link", { name: /public scoring/i });
    const vehiclesLink = screen.getByRole("link", { name: /income vehicle hub/i });
    for (const link of [incomeLink, scoringLink, vehiclesLink]) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    }
  });

  it("clicking a card fires welcome_wizard_tour_card_clicked with the correct card_key", () => {
    render(<Step4Tour onAdvance={() => {}} onBack={() => {}} />);
    fireEvent.click(screen.getByRole("link", { name: /your income chart/i }));
    expect(captureClientEventMock).toHaveBeenCalledWith(
      "welcome_wizard_tour_card_clicked",
      { card_key: "income" },
    );
    fireEvent.click(screen.getByRole("link", { name: /public scoring/i }));
    expect(captureClientEventMock).toHaveBeenCalledWith(
      "welcome_wizard_tour_card_clicked",
      { card_key: "scoring" },
    );
    fireEvent.click(screen.getByRole("link", { name: /income vehicle hub/i }));
    expect(captureClientEventMock).toHaveBeenCalledWith(
      "welcome_wizard_tour_card_clicked",
      { card_key: "vehicles" },
    );
  });
});
