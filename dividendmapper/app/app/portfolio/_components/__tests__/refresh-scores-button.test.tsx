import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { RefreshScoresButton } from "../refresh-scores-button";

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("RefreshScoresButton", () => {
  it("renders the idle label", () => {
    render(<RefreshScoresButton />);
    expect(screen.getByRole("button", { name: /refresh scores/i })).toBeInTheDocument();
  });

  it("POSTs on click and refreshes on success", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ scored: 3, failed: 0, remaining: 0 }), { status: 200 }),
    );
    render(<RefreshScoresButton />);
    await userEvent.click(screen.getByRole("button", { name: /refresh scores/i }));
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/portfolio/refresh-scores",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(await screen.findByText(/up to date/i)).toBeInTheDocument();
  });

  it("offers 'next 20' when remaining > 0", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ scored: 20, failed: 0, remaining: 5 }), { status: 200 }),
    );
    render(<RefreshScoresButton />);
    await userEvent.click(screen.getByRole("button", { name: /refresh scores/i }));
    expect(await screen.findByText(/next 20/i)).toBeInTheDocument();
  });

  it("shows a cooldown message on 429", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: "cooldown", retryAfterSeconds: 600 }), { status: 429 }),
    );
    render(<RefreshScoresButton />);
    await userEvent.click(screen.getByRole("button", { name: /refresh scores/i }));
    expect(await screen.findByText(/try again/i)).toBeInTheDocument();
  });
});
