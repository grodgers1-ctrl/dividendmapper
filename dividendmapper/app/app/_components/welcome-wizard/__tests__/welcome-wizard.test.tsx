import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WelcomeWizard } from "../welcome-wizard";

const captureClientEventMock = vi.fn();
vi.mock("@/lib/analytics/posthog-capture", () => ({
  captureClientEvent: (n: string, p?: Record<string, unknown>) => captureClientEventMock(n, p),
}));

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }) as unknown as typeof fetch;
});

describe("WelcomeWizard modal frame", () => {
  it("renders step 1 by default and fires welcome_wizard_shown on mount", () => {
    render(<WelcomeWizard initialHoldingsCount={0} />);
    expect(screen.getByRole("dialog", { name: /welcome to dividendmapper/i })).toBeInTheDocument();
    expect(captureClientEventMock).toHaveBeenCalledWith(
      "welcome_wizard_shown",
      expect.objectContaining({ first_step: 1 }),
    );
  });

  it("ESC fires dismissed_session and does NOT call the dismissal endpoint", () => {
    render(<WelcomeWizard initialHoldingsCount={0} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(captureClientEventMock).toHaveBeenCalledWith(
      "welcome_wizard_dismissed_session",
      expect.objectContaining({ from_step: 1 }),
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("X button does the same as ESC", () => {
    render(<WelcomeWizard initialHoldingsCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: /close welcome tour/i }));
    expect(captureClientEventMock).toHaveBeenCalledWith(
      "welcome_wizard_dismissed_session",
      expect.objectContaining({ from_step: 1 }),
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
