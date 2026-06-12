import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrokerConnection, type BrokerConnectionState } from "../broker-connection";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

beforeEach(() => {
  refresh.mockReset();
  vi.restoreAllMocks();
});

const isaConn: BrokerConnectionState = {
  id: "c-isa",
  provider: "trading212",
  wrapper: "isa",
  status: "active",
  lastSyncedAt: "2026-06-04T05:00:00.000Z",
  lastSyncError: null,
};
const giaConn: BrokerConnectionState = {
  id: "c-gia",
  provider: "trading212",
  wrapper: "gia",
  status: "active",
  lastSyncedAt: null,
  lastSyncError: null,
};

describe("BrokerConnection", () => {
  it("gates Free users with an upgrade prompt and no form", () => {
    render(<BrokerConnection isPro={false} connections={[]} />);
    expect(screen.getByText(/broker sync is a pro feature/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/api key/i)).not.toBeInTheDocument();
  });

  it("shows the connect form for a Pro user with no connections", () => {
    render(<BrokerConnection isPro={true} connections={[]} />);
    expect(screen.getByLabelText(/api key/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/which account is this/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect trading 212/i })).toBeDisabled();
  });

  it("shows a card per connection and an add-another form offering only the free wrapper", () => {
    render(<BrokerConnection isPro={true} connections={[isaConn]} />);
    expect(screen.getByText(/stocks & shares isa/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sync now/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument();
    // Add-another form: the ISA option is taken, so only Invest is offered.
    const select = screen.getByLabelText(/which account is this/i) as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toEqual(["gia"]);
  });

  it("hides the add form once both wrappers are connected", () => {
    render(<BrokerConnection isPro={true} connections={[isaConn, giaConn]} />);
    expect(screen.getAllByText(/trading 212/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByLabelText(/api key/i)).not.toBeInTheDocument();
    expect(screen.getByText(/both your trading 212 accounts/i)).toBeInTheDocument();
  });

  it("Sync now posts the connection id", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<BrokerConnection isPro={true} connections={[isaConn]} />);
    await user.click(screen.getByRole("button", { name: /sync now/i }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/portfolio/broker/sync",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ connectionId: "c-isa" }) }),
    );
  });

  it("Disconnect posts the connection id", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<BrokerConnection isPro={true} connections={[isaConn]} />);
    await user.click(screen.getByRole("button", { name: /disconnect/i }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/portfolio/broker/connect",
      expect.objectContaining({ method: "DELETE", body: JSON.stringify({ connectionId: "c-isa" }) }),
    );
  });

  it("POSTs the entered credentials + wrapper to the connect endpoint", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<BrokerConnection isPro={true} connections={[]} />);
    await user.type(screen.getByLabelText(/api key/i), "mykey");
    await user.type(screen.getByLabelText(/api secret/i), "mysecret");
    await user.selectOptions(screen.getByLabelText(/which account is this/i), "gia");
    await user.click(screen.getByRole("button", { name: /connect trading 212/i }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/portfolio/broker/connect",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ apiKey: "mykey", apiSecret: "mysecret", wrapper: "gia" }),
      }),
    );
    expect(refresh).toHaveBeenCalled();
  });
});
