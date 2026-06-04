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

const activeConn: BrokerConnectionState = {
  provider: "trading212",
  wrapper: "isa",
  status: "active",
  lastSyncedAt: "2026-06-04T05:00:00.000Z",
  lastSyncError: null,
};

describe("BrokerConnection", () => {
  it("gates Free users with an upgrade prompt and no form", () => {
    render(<BrokerConnection isPro={false} initial={null} />);
    expect(screen.getByText(/broker sync is a pro feature/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/api key/i)).not.toBeInTheDocument();
  });

  it("shows the connect form for a Pro user with no connection", () => {
    render(<BrokerConnection isPro={true} initial={null} />);
    expect(screen.getByLabelText(/api key/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/api secret/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/which account is this/i)).toBeInTheDocument();
    // Connect is disabled until both credentials are entered.
    expect(screen.getByRole("button", { name: /connect trading 212/i })).toBeDisabled();
  });

  it("shows the status card with Sync now + Disconnect when connected", () => {
    render(<BrokerConnection isPro={true} initial={activeConn} />);
    expect(screen.getByText(/trading 212/i)).toBeInTheDocument();
    expect(screen.getByText(/stocks & shares isa/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sync now/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument();
  });

  it("treats a revoked connection as not connected (back to the form)", () => {
    render(<BrokerConnection isPro={true} initial={{ ...activeConn, status: "revoked" }} />);
    expect(screen.getByLabelText(/api key/i)).toBeInTheDocument();
  });

  it("POSTs the entered credentials + wrapper to the connect endpoint", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<BrokerConnection isPro={true} initial={null} />);
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
