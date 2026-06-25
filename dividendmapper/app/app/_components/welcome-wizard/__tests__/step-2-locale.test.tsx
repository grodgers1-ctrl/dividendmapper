import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Step2Locale } from "../step-2-locale";

const useLocaleMock = vi.fn();
vi.mock("@/lib/locale/context", () => ({
  useLocale: () => useLocaleMock(),
}));

// LocaleToggle is the existing standalone component; stub it so we only
// test that Step 2 mounts it inline, not its internals.
vi.mock("@/components/locale-toggle", () => ({
  LocaleToggle: () => <div data-testid="inline-locale-toggle" />,
}));

describe("Step2Locale", () => {
  it("interpolates the current locale into the body copy (UK)", () => {
    useLocaleMock.mockReturnValue({ config: { locale: "uk" } });
    render(<Step2Locale onAdvance={() => {}} onBack={() => {}} />);
    expect(screen.getByText(/heads up\./i)).toBeInTheDocument();
    expect(screen.getByText(/set to uk/i)).toBeInTheDocument();
  });

  it("interpolates the current locale into the body copy (US)", () => {
    useLocaleMock.mockReturnValue({ config: { locale: "us" } });
    render(<Step2Locale onAdvance={() => {}} onBack={() => {}} />);
    expect(screen.getByText(/set to us/i)).toBeInTheDocument();
  });

  it("renders the LocaleToggle inline so the user can switch from inside the modal", () => {
    useLocaleMock.mockReturnValue({ config: { locale: "uk" } });
    render(<Step2Locale onAdvance={() => {}} onBack={() => {}} />);
    expect(screen.getByTestId("inline-locale-toggle")).toBeInTheDocument();
    // The old "Look for the toggle in the top-right" line is gone:
    // the modal+backdrop covered the topbar in prod, so we drop the
    // pointer altogether.
    expect(screen.queryByText(/look for the.*toggle in the top-right/i)).toBeNull();
  });
});
