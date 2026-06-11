import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArchivedHoldings, type ArchivedRow } from "../archived-holdings";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const rows: ArchivedRow[] = [
  { id: "11111111-1111-1111-1111-111111111111", ticker: "DLO", wrapper: "isa", source: "manual" },
  { id: "22222222-2222-2222-2222-222222222222", ticker: "PYPL", wrapper: "gia", source: "trading212" },
];

beforeEach(() => {
  refresh.mockClear();
  globalThis.fetch = vi.fn().mockResolvedValue({ status: 204 }) as unknown as typeof fetch;
});
afterEach(() => vi.restoreAllMocks());

describe("<ArchivedHoldings>", () => {
  it("renders nothing when there are no archived rows", () => {
    const { container } = render(<ArchivedHoldings rows={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the count and lists each archived ticker", () => {
    render(<ArchivedHoldings rows={rows} />);
    expect(screen.getByText("Archived holdings (2)")).toBeInTheDocument();
    expect(screen.getByText("DLO")).toBeInTheDocument();
    expect(screen.getByText("PYPL")).toBeInTheDocument();
  });

  it("restores a holding via PATCH and refreshes", async () => {
    const user = userEvent.setup();
    render(<ArchivedHoldings rows={rows} />);
    await user.click(screen.getAllByRole("button", { name: /restore/i })[0]);
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/portfolio/holdings/11111111-1111-1111-1111-111111111111",
        { method: "PATCH" },
      );
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("deletes a holding via DELETE after confirm", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ArchivedHoldings rows={rows} />);
    await user.click(screen.getAllByRole("button", { name: /delete DLO/i })[0]);
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/portfolio/holdings/11111111-1111-1111-1111-111111111111",
        { method: "DELETE" },
      );
      expect(refresh).toHaveBeenCalled();
    });
  });
});
