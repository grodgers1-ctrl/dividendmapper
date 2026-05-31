import { describe, it, expect } from "vitest";
import { buildReinvestCard } from "../build-card";
import type { QuoteResult } from "@/lib/market/quote";
import type { HoldingScore } from "@/lib/scoring/portfolio-scores";

const q = (price: number | null, currency: string | null, dividend = 0): QuoteResult => ({
  ok: true,
  cached: false,
  data: {
    ticker: "X",
    source: "FMP",
    price,
    dividend,
    dividendYield: null,
    dividendGrowth3yr: null,
    currency,
    exchange: null,
    name: null,
    fetchedAt: "1970-01-01T00:00:00.000Z",
  },
});

const sc = (buy: number | null, hiddenBuy = false): HoldingScore => ({
  ticker: "X",
  buy,
  trim: 50,
  risk: 20,
  buyFailedGates: buy === null ? ["GATE_4"] : [],
  buyGateReason: buy === null ? "ETF or fund" : null,
  dataQuality: "sparse",
  deltas: { buy: null, trim: null, risk: null },
  hidden: { buy: hiddenBuy, trim: false, risk: false },
  actionHint: "Hold",
});

const today = "2026-05-31";

const base = {
  ratesToGbp: { USD: 0.79, GBP: 1 },
  totalPortfolioIncomeGbp: 1000,
  today,
  windowDays: 5,
};

describe("buildReinvestCard", () => {
  it("returns null when no holding has an ex-div in the window", () => {
    const out = buildReinvestCard({
      ...base,
      holdings: [
        { id: "pep", ticker: "PEP", quantity: 50 },
        { id: "msft", ticker: "MSFT", quantity: 10 },
      ],
      exDivByTicker: { PEP: { date: "2026-09-05", amount: 1.48, payDate: "2026-09-30" } },
      quotesByTicker: { PEP: q(140, "USD", 4), MSFT: q(400, "USD", 3) },
      scoresByTicker: { PEP: sc(76), MSFT: sc(43) },
      weightByTicker: { PEP: 0.3, MSFT: 0.1 },
    });
    expect(out).toBeNull();
  });

  it("triggers on a near ex-div and estimates the USD payment in GBP", () => {
    const out = buildReinvestCard({
      ...base,
      holdings: [
        { id: "pep", ticker: "PEP", quantity: 50 },
        { id: "msft", ticker: "MSFT", quantity: 10 },
        { id: "pypl", ticker: "PYPL", quantity: 20 },
      ],
      exDivByTicker: { PEP: { date: "2026-06-05", amount: 1.48, payDate: "2026-06-30" } },
      quotesByTicker: { PEP: q(140, "USD", 4), MSFT: q(400, "USD", 3), PYPL: q(70, "USD", 1) },
      scoresByTicker: { PEP: sc(76), MSFT: sc(43), PYPL: sc(79) },
      weightByTicker: { PEP: 0.3, MSFT: 0.1, PYPL: 0.06 },
    });
    expect(out).not.toBeNull();
    expect(out!.trigger.ticker).toBe("PEP");
    expect(out!.trigger.holdingId).toBe("pep");
    expect(out!.trigger.exDivDate).toBe("2026-06-05");
    expect(out!.trigger.payDate).toBe("2026-06-30");
    expect(out!.trigger.estPaymentGbp).toBeCloseTo(58.46, 2); // 50 * 1.48 * 0.79
    expect(out!.candidates.map((c) => c.ticker)).not.toContain("PEP");
  });

  it("estimates a .L payment from pence (amount/100), ignoring the quote currency", () => {
    const out = buildReinvestCard({
      ...base,
      holdings: [
        { id: "vod", ticker: "VOD.L", quantity: 1000 },
        { id: "msft", ticker: "MSFT", quantity: 10 },
      ],
      exDivByTicker: { "VOD.L": { date: "2026-06-04", amount: 2.05, payDate: "2026-07-30" } },
      // uk-income synthesises currency "GBP" even though the amount is pence.
      quotesByTicker: { "VOD.L": q(null, "GBP", 0.04), MSFT: q(400, "USD", 3) },
      scoresByTicker: { "VOD.L": sc(null), MSFT: sc(43) },
      weightByTicker: { "VOD.L": 0.05, MSFT: 0.1 },
    });
    expect(out!.trigger.ticker).toBe("VOD.L");
    expect(out!.trigger.estPaymentGbp).toBeCloseTo(20.5, 2); // 1000 * 2.05 / 100
    expect(out!.candidates.map((c) => c.ticker)).toEqual(["MSFT"]);
  });

  it("breaks a same-date tie by the larger estimated payment", () => {
    const out = buildReinvestCard({
      ...base,
      holdings: [
        { id: "small", ticker: "SMALL", quantity: 1 },
        { id: "big", ticker: "BIG", quantity: 100 },
        { id: "msft", ticker: "MSFT", quantity: 10 },
      ],
      exDivByTicker: {
        SMALL: { date: "2026-06-02", amount: 0.5, payDate: "2026-06-20" },
        BIG: { date: "2026-06-02", amount: 0.5, payDate: "2026-06-20" },
      },
      quotesByTicker: {
        SMALL: q(10, "USD", 0.5),
        BIG: q(10, "USD", 0.5),
        MSFT: q(400, "USD", 3),
      },
      scoresByTicker: { SMALL: sc(60), BIG: sc(60), MSFT: sc(43) },
      weightByTicker: { SMALL: 0.01, BIG: 0.2, MSFT: 0.1 },
    });
    expect(out!.trigger.ticker).toBe("BIG"); // 100*0.5 > 1*0.5
  });

  it("never offers a gate-failer as a candidate", () => {
    const out = buildReinvestCard({
      ...base,
      holdings: [
        { id: "pep", ticker: "PEP", quantity: 50 },
        { id: "schd", ticker: "SCHD", quantity: 5 },
        { id: "msft", ticker: "MSFT", quantity: 10 },
      ],
      exDivByTicker: { PEP: { date: "2026-06-05", amount: 1.48, payDate: "2026-06-30" } },
      quotesByTicker: { PEP: q(140, "USD", 4), SCHD: q(80, "USD", 2), MSFT: q(400, "USD", 3) },
      scoresByTicker: { PEP: sc(76), SCHD: sc(null), MSFT: sc(43) },
      weightByTicker: { PEP: 0.3, SCHD: 0.1, MSFT: 0.1 },
    });
    expect(out!.candidates.map((c) => c.ticker)).toEqual(["MSFT"]);
  });

  it("excludes a buy-hidden candidate", () => {
    const out = buildReinvestCard({
      ...base,
      holdings: [
        { id: "pep", ticker: "PEP", quantity: 50 },
        { id: "msft", ticker: "MSFT", quantity: 10 },
        { id: "pypl", ticker: "PYPL", quantity: 20 },
      ],
      exDivByTicker: { PEP: { date: "2026-06-05", amount: 1.48, payDate: "2026-06-30" } },
      quotesByTicker: { PEP: q(140, "USD", 4), MSFT: q(400, "USD", 3), PYPL: q(70, "USD", 1) },
      scoresByTicker: { PEP: sc(76), MSFT: sc(43, true), PYPL: sc(79) },
      weightByTicker: { PEP: 0.3, MSFT: 0.1, PYPL: 0.06 },
    });
    expect(out!.candidates.map((c) => c.ticker)).toEqual(["PYPL"]);
  });

  it("returns null when a trigger exists but there are no eligible candidates", () => {
    const out = buildReinvestCard({
      ...base,
      holdings: [
        { id: "pep", ticker: "PEP", quantity: 50 },
        { id: "schd", ticker: "SCHD", quantity: 5 },
      ],
      exDivByTicker: { PEP: { date: "2026-06-05", amount: 1.48, payDate: "2026-06-30" } },
      quotesByTicker: { PEP: q(140, "USD", 4), SCHD: q(80, "USD", 2) },
      scoresByTicker: { PEP: sc(76), SCHD: sc(null) },
      weightByTicker: { PEP: 0.3, SCHD: 0.1 },
    });
    expect(out).toBeNull();
  });

  it("renders the card with a null estimate when the trigger currency has no FX rate", () => {
    const out = buildReinvestCard({
      ...base,
      ratesToGbp: { GBP: 1 }, // no USD rate
      holdings: [
        { id: "pep", ticker: "PEP", quantity: 50 },
        { id: "msft", ticker: "MSFT", quantity: 10 },
      ],
      exDivByTicker: { PEP: { date: "2026-06-05", amount: 1.48, payDate: "2026-06-30" } },
      quotesByTicker: { PEP: q(140, "USD", 4), MSFT: q(400, "USD", 3) },
      scoresByTicker: { PEP: sc(76), MSFT: sc(43) },
      weightByTicker: { PEP: 0.3, MSFT: 0.1 },
    });
    expect(out).not.toBeNull();
    expect(out!.trigger.ticker).toBe("PEP");
    expect(out!.trigger.estPaymentGbp).toBeNull();
    expect(out!.candidates.map((c) => c.ticker)).toEqual(["MSFT"]);
  });
});
