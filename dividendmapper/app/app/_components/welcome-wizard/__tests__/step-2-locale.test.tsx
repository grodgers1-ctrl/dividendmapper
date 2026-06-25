import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Step2Locale } from "../step-2-locale";

const useLocaleMock = vi.fn();
vi.mock("@/lib/locale/context", () => ({
  useLocale: () => useLocaleMock(),
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
});
