import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Step3AddHolding } from "../step-3-add-holding";

const useLocaleMock = vi.fn(() => ({ config: { locale: "uk" } }));
vi.mock("@/lib/locale/context", () => ({ useLocale: () => useLocaleMock() }));

const captureClientEventMock = vi.fn();
vi.mock("@/lib/analytics/posthog-capture", () => ({
  captureClientEvent: (n: string, p?: Record<string, unknown>) => captureClientEventMock(n, p),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

// TickerSearch is complex; we replace it with a tiny stub for these tests.
vi.mock("@/components/ui/ticker-search", () => ({
  TickerSearch: ({ onSelect }: { onSelect: (r: { symbol: string; currency: string }) => void }) => (
    <button
      type="button"
      data-testid="ticker-stub"
      onClick={() => onSelect({ symbol: "AAPL", currency: "USD" })}
    >
      pick ticker
    </button>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch;
});

describe("Step3AddHolding", () => {
  it("smart-skip: when existingHoldingsCount > 0, renders the confirmation card instead of the form", () => {
    render(<Step3AddHolding existingHoldingsCount={3} onAdvance={() => {}} onBack={() => {}} />);
    expect(screen.getByText(/you've already got 3 holdings/i)).toBeInTheDocument();
    expect(screen.queryByTestId("ticker-stub")).toBeNull();
  });

  it("renders the form with UK wrapper options", () => {
    render(<Step3AddHolding existingHoldingsCount={0} onAdvance={() => {}} onBack={() => {}} />);
    expect(screen.getByLabelText(/wrapper/i)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /isa/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /401/ })).toBeNull();
  });

  it("blocks the primary until ticker, quantity, avg cost, and wrapper are set", () => {
    render(<Step3AddHolding existingHoldingsCount={0} onAdvance={() => {}} onBack={() => {}} />);
    const primary = screen.getByRole("button", { name: /add holding/i });
    expect(primary).toBeDisabled();
    fireEvent.click(screen.getByTestId("ticker-stub"));
    fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/avg cost/i), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText(/wrapper/i), { target: { value: "isa" } });
    expect(primary).not.toBeDisabled();
  });

  it("successful POST advances and fires welcome_wizard_holding_added", async () => {
    const onAdvance = vi.fn();
    render(<Step3AddHolding existingHoldingsCount={0} onAdvance={onAdvance} onBack={() => {}} />);
    fireEvent.click(screen.getByTestId("ticker-stub"));
    fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/avg cost/i), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText(/wrapper/i), { target: { value: "isa" } });
    fireEvent.click(screen.getByRole("button", { name: /add holding/i }));
    await waitFor(() => expect(onAdvance).toHaveBeenCalledOnce());
    expect(captureClientEventMock).toHaveBeenCalledWith(
      "welcome_wizard_holding_added",
      expect.objectContaining({ wrapper: "isa", currency: "USD" }),
    );
  });

  it("POST failure leaves the modal open and surfaces an inline error", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "invalid_quantity" }),
    });
    const onAdvance = vi.fn();
    render(<Step3AddHolding existingHoldingsCount={0} onAdvance={onAdvance} onBack={() => {}} />);
    fireEvent.click(screen.getByTestId("ticker-stub"));
    fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/avg cost/i), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText(/wrapper/i), { target: { value: "isa" } });
    fireEvent.click(screen.getByRole("button", { name: /add holding/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(onAdvance).not.toHaveBeenCalled();
  });
});
