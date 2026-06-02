import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PersonalisationWizard } from "../personalisation-wizard";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

describe("<PersonalisationWizard>", () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.restoreAllMocks();
  });

  it("renders the first question when open", () => {
    render(<PersonalisationWizard open onOpenChange={() => {}} initial={null} />);
    expect(screen.getByText(/what matters most/i)).toBeTruthy();
  });

  it("submitting calls PUT /api/preferences with action complete", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const onOpenChange = vi.fn();
    render(<PersonalisationWizard open onOpenChange={onOpenChange} initial={null} />);
    fireEvent.click(screen.getByRole("button", { name: /income now/i }));
    fireEvent.click(screen.getByRole("button", { name: /save preferences/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, opts] = fetchMock.mock.calls[0];
    expect((opts as RequestInit).method).toBe("PUT");
    expect(JSON.parse((opts as RequestInit).body as string).action).toBe("complete");
    expect(JSON.parse((opts as RequestInit).body as string).primary_goal).toBe("income_now");
  });

  it("skip calls the API with action skip", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<PersonalisationWizard open onOpenChange={vi.fn()} initial={null} />);
    fireEvent.click(screen.getByRole("button", { name: /skip for now/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string).action).toBe(
      "skip",
    );
  });
});
