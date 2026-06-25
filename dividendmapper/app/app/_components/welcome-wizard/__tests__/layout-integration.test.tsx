import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { WelcomeWizardIsland } from "../welcome-wizard-island";

vi.mock("../welcome-wizard", () => ({
  WelcomeWizard: ({ initialHoldingsCount }: { initialHoldingsCount: number }) => (
    <div data-testid="welcome-wizard-island">count={initialHoldingsCount}</div>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WelcomeWizardIsland", () => {
  it("renders nothing when shouldShow is false", () => {
    render(<WelcomeWizardIsland shouldShow={false} initialHoldingsCount={0} />);
    expect(screen.queryByTestId("welcome-wizard-island")).toBeNull();
  });

  it("renders the wizard when shouldShow is true", () => {
    render(<WelcomeWizardIsland shouldShow initialHoldingsCount={2} />);
    expect(screen.getByTestId("welcome-wizard-island")).toHaveTextContent("count=2");
  });
});
