import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditHoldingModal } from "../EditHoldingModal";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const HOLDING_ID = "11111111-1111-1111-1111-111111111111";

function defaultInitial() {
  return {
    quantity: 10,
    avgCost: 150,
    costCurrency: "GBP" as const,
    wrapper: "isa",
    brokerLabel: "T212 ISA",
    notes: null as string | null,
  };
}

afterEach(() => {
  cleanup();
  refresh.mockReset();
  vi.unstubAllGlobals();
});

describe("<EditHoldingModal>", () => {
  it("renders pre-populated with the current holding's values", () => {
    render(
      <EditHoldingModal
        open
        onOpenChange={() => {}}
        holdingId={HOLDING_ID}
        ticker="VOD.L"
        initial={defaultInitial()}
      />,
    );
    expect((screen.getByLabelText(/quantity/i) as HTMLInputElement).value).toBe("10");
    expect((screen.getByLabelText(/average cost/i) as HTMLInputElement).value).toBe("150");
    expect((screen.getByLabelText(/wrapper/i) as HTMLSelectElement).value).toBe("isa");
  });

  it("PATCHes the holding with new values and refreshes on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <EditHoldingModal
        open
        onOpenChange={onOpenChange}
        holdingId={HOLDING_ID}
        ticker="VOD.L"
        initial={defaultInitial()}
      />,
    );

    await user.clear(screen.getByLabelText(/quantity/i));
    await user.type(screen.getByLabelText(/quantity/i), "25");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`/api/portfolio/holdings/${HOLDING_ID}`);
    expect((init as RequestInit).method).toBe("PATCH");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.quantity).toBe(25);
    expect(body.cost_currency).toBe("GBP");
    expect(body.wrapper).toBe("isa");

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the field-error message returned by the API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid_quantity" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(
      <EditHoldingModal
        open
        onOpenChange={() => {}}
        holdingId={HOLDING_ID}
        ticker="VOD.L"
        initial={defaultInitial()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() =>
      expect(screen.getByText(/quantity must be greater than zero/i)).toBeInTheDocument(),
    );
  });

  it("blocks submission when client-side validation fails (zero quantity)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(
      <EditHoldingModal
        open
        onOpenChange={() => {}}
        holdingId={HOLDING_ID}
        ticker="VOD.L"
        initial={defaultInitial()}
      />,
    );

    await user.clear(screen.getByLabelText(/quantity/i));
    await user.type(screen.getByLabelText(/quantity/i), "0");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/quantity must be greater than zero/i)).toBeInTheDocument();
  });
});
