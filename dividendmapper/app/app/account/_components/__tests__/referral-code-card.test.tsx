import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReferralCodeCard } from "../referral-code-card";

const URL = "https://dividendmapper.com/refer/GLENN-3K7QPA";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("ReferralCodeCard", () => {
  it("renders the share URL and a Copy button when unredeemed", () => {
    render(<ReferralCodeCard url={URL} redeemed={false} redeemedAt={null} />);
    expect(screen.getByText(URL)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
  });

  it("copies the URL to the clipboard and flips to Copied", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<ReferralCodeCard url={URL} redeemed={false} redeemedAt={null} />);
    await user.click(screen.getByRole("button", { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith(URL);
    expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();
  });

  it("shows the redeemed date and no Copy button when redeemed", () => {
    render(
      <ReferralCodeCard
        url={URL}
        redeemed={true}
        redeemedAt="2026-07-01T05:00:00.000Z"
      />,
    );
    expect(screen.getByText(/redeemed on/i)).toBeInTheDocument();
    expect(screen.getByText(/1 july 2026/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /copy/i }),
    ).not.toBeInTheDocument();
  });

  it("applies the line-through redeemed styling to the URL", () => {
    render(
      <ReferralCodeCard
        url={URL}
        redeemed={true}
        redeemedAt="2026-07-01T05:00:00.000Z"
      />,
    );
    expect(screen.getByText(URL).className).toContain("line-through");
  });

  it("falls back to a plain redeemed label when no date is given", () => {
    render(<ReferralCodeCard url={URL} redeemed={true} redeemedAt={null} />);
    expect(screen.getByText(/^redeemed$/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /copy/i }),
    ).not.toBeInTheDocument();
  });
});
