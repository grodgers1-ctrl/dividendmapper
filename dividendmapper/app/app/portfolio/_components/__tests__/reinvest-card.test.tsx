import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ReinvestCard } from "../reinvest-card";
import type { Suggestion } from "@/lib/reinvest/build-suggestions";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  vi.stubGlobal("fetch", fetchMock);
});

const cand = (over: Partial<Suggestion>): Suggestion => ({
  holdingId: "h",
  ticker: "MSFT",
  buyScore: 43,
  reinvestScore: 50,
  currentWeight: 0.1,
  reason: "",
  diversificationNote: "a different sector",
  ...over,
});

const trigger = {
  holdingId: "vod",
  ticker: "VOD.L",
  exDivDate: "2026-06-04",
  payDate: "2026-07-30",
  estPaymentGbp: 36.86,
  currentWeight: 0.18,
};

const fiveCandidates = [
  cand({ holdingId: "a", ticker: "PEP", buyScore: 78, currentWeight: 0.1 }),
  cand({ holdingId: "b", ticker: "PYPL", buyScore: 79, currentWeight: 0.05 }),
  cand({ holdingId: "c", ticker: "MSFT", buyScore: 43, currentWeight: 0.4 }),
  cand({ holdingId: "d", ticker: "KO", buyScore: 60, currentWeight: 0.08 }),
  cand({ holdingId: "e", ticker: "JNJ", buyScore: 55, currentWeight: 0.07 }),
];

describe("<ReinvestCard>", () => {
  it("renders the heading + trigger line with a formatted date and GBP estimate", () => {
    render(<ReinvestCard trigger={trigger} candidates={[cand({})]} />);
    expect(screen.getByText("Dividend due soon")).toBeTruthy();
    const body = screen.getByText(/goes ex-dividend on 4 Jun/);
    expect(body.textContent).toContain("£37"); // rounded
    expect(body.textContent).toContain("VOD.L");
  });

  it("lists candidate rows with ticker, quality, weight, and note", () => {
    render(<ReinvestCard trigger={trigger} candidates={[cand({ ticker: "PEP", buyScore: 78, currentWeight: 0.1, diversificationNote: "a different sector" })]} />);
    const row = screen.getByTestId("reinvest-candidate-PEP");
    expect(row.textContent).toContain("PEP");
    expect(row.textContent).toContain("Quality 78");
    expect(row.textContent).toContain("10%");
    expect(row.textContent).toContain("a different sector");
  });

  it("logs an accepted suggestion and shows an inline confirmation on that row", async () => {
    render(<ReinvestCard trigger={trigger} candidates={[cand({ ticker: "PEP" }), cand({ ticker: "PYPL", holdingId: "p2" })]} />);
    const row = screen.getByTestId("reinvest-candidate-PEP");
    fireEvent.click(within(row).getByRole("button", { name: /use this idea/i }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.userAction).toBe("accepted");
    expect(body.userActionTicker).toBe("PEP");
    expect(body.triggerHoldingId).toBe("vod");
    expect(await screen.findByText(/added to your reinvest log/i)).toBeTruthy();
  });

  it("dismisses the card and logs it", () => {
    render(<ReinvestCard trigger={trigger} candidates={[cand({})]} />);
    fireEvent.click(screen.getByRole("button", { name: /not now/i }));
    expect(screen.queryByText("Dividend due soon")).toBeNull();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).userAction).toBe("dismissed");
  });

  it("reveals rows 6-10 on Show more and logs shown_only once", () => {
    const ten = [
      ...fiveCandidates,
      cand({ holdingId: "f", ticker: "T", buyScore: 30 }),
      cand({ holdingId: "g", ticker: "VZ", buyScore: 31 }),
      cand({ holdingId: "h2", ticker: "IBM", buyScore: 32 }),
      cand({ holdingId: "i", ticker: "MMM", buyScore: 33 }),
      cand({ holdingId: "j", ticker: "O", buyScore: 34 }),
    ];
    render(<ReinvestCard trigger={trigger} candidates={ten} />);
    expect(screen.queryByTestId("reinvest-candidate-IBM")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));
    expect(screen.getByTestId("reinvest-candidate-IBM")).toBeTruthy();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).userAction).toBe("shown_only");
  });

  it("does not render Show more when there are five or fewer candidates", () => {
    render(<ReinvestCard trigger={trigger} candidates={fiveCandidates} />);
    expect(screen.queryByRole("button", { name: /show more/i })).toBeNull();
  });

  it("omits the figure clause when the estimate is null but still renders", () => {
    render(
      <ReinvestCard
        trigger={{ ...trigger, estPaymentGbp: null }}
        candidates={[cand({})]}
      />,
    );
    expect(screen.getByText("Dividend due soon")).toBeTruthy();
    expect(screen.queryByText(/You're due about/)).toBeNull();
  });

  it("shows the not-financial-advice footer", () => {
    render(<ReinvestCard trigger={trigger} candidates={[cand({})]} />);
    expect(screen.getByText(/not financial advice/i)).toBeTruthy();
  });
});
