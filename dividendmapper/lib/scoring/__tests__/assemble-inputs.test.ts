import { describe, it, expect } from "vitest";
import { assembleScoreInputs, type RawFmpBundle, type PriorHistory } from "../assemble-inputs";

const asOf = new Date("2026-05-29T00:00:00Z");
const daysAgo = (n: number) => new Date(asOf.getTime() - n * 86400000).toISOString().slice(0, 10);
const daysAhead = (n: number) => new Date(asOf.getTime() + n * 86400000).toISOString().slice(0, 10);

// 300 daily EOD bars, close rising from 100, highs rising so the 52w max is known.
const eodBars = (symbol: string) =>
  Array.from({ length: 300 }, (_, i) => ({
    symbol,
    date: daysAgo(i),
    close: 100 + (300 - i) * 0.1,
    high: 100 + (300 - i) * 0.1 + 1,
    low: 100 + (300 - i) * 0.1 - 1,
  }));

const emptyHistory: PriorHistory = { r1: [], epsAvg: [] };

const bundle = (symbol: string, over: Partial<RawFmpBundle> = {}): RawFmpBundle => ({
  profile: [
    { symbol, mktCap: 5_000_000_000, sector: "Technology", industry: "Software - Application", currency: "USD", exchange: "NASDAQ" },
  ],
  ratiosTtm: [{ symbol, dividendPayoutRatioTTM: 0.45, dividendYieldTTM: 0.03 }],
  ratiosQuarterly: Array.from({ length: 20 }, () => ({ priceToEarningsRatio: 22, interestCoverageRatio: 8, dividendPayoutRatio: 0.45 })),
  dividends: Array.from({ length: 4 }, (_, i) => ({ date: daysAgo(i * 90), adjDividend: 0.25, dividend: 0.25 })),
  incomeQuarterly: Array.from({ length: 8 }, () => ({ operatingIncome: 250, interestExpense: 50, netIncome: 200, period: "Q" })),
  cashflowQuarterly: Array.from({ length: 6 }, () => ({ freeCashFlow: 300, netDividendsPaid: -100, period: "Q" })),
  balanceQuarterly: Array.from({ length: 6 }, () => ({})),
  keyMetricsTtm: [{ netDebtToEBITDATTM: 1.5 }],
  keyMetricsQuarterly: Array.from({ length: 6 }, () => ({ netDebtToEBITDA: 1.2 })),
  analystEstimates: [{ date: daysAhead(200), epsAvg: 10 }],
  dcf: [{ symbol, dcf: 150, "Stock Price": 120 }],
  sma: [{ date: daysAgo(0), close: 130, high: 131, low: 129, sma: 110 }],
  rsi: [{ date: daysAgo(0), close: 130, high: 131, low: 129, rsi: 65 }],
  historicalEod: eodBars(symbol),
  priceTarget: [{ symbol, targetHigh: 180, targetLow: 120, targetConsensus: 150, targetMedian: 155 }],
  gradesHistorical: [
    { symbol, date: daysAgo(5), analystRatingsStrongBuy: 10, analystRatingsBuy: 8, analystRatingsHold: 4, analystRatingsSell: 1, analystRatingsStrongSell: 0 },
    { symbol, date: daysAgo(35), analystRatingsStrongBuy: 7, analystRatingsBuy: 7, analystRatingsHold: 5, analystRatingsSell: 2, analystRatingsStrongSell: 1 },
  ],
  insiderTrades: [
    { symbol, transactionType: "P-Purchase", securitiesTransacted: 1000, price: 120, transactionDate: daysAgo(10) },
  ],
  dividendsCalendar: [
    { symbol: "OTHER", date: daysAhead(5), adjDividend: 1, dividend: 1 },
    { symbol, date: daysAhead(20), adjDividend: 0.25, dividend: 0.25 },
  ],
  ...over,
});

describe("assembleScoreInputs", () => {
  it("detects US vs UK and classifies the sector", () => {
    const us = assembleScoreInputs("AAPL", bundle("AAPL"), emptyHistory, asOf);
    expect(us.meta.isUs).toBe(true);
    expect(us.meta.dataQualityUk).toBe(false);
    expect(us.meta.sector).toBe("technology");

    const uk = assembleScoreInputs("LGEN.L", bundle("LGEN.L"), emptyHistory, asOf);
    expect(uk.meta.isUs).toBe(false);
    expect(uk.meta.dataQualityUk).toBe(true);
    expect(uk.buy.a3.isUs).toBe(false);
  });

  it("maps DCF, SMA, RSI and price target into the right signal inputs", () => {
    const a = assembleScoreInputs("AAPL", bundle("AAPL"), emptyHistory, asOf);
    expect(a.buy.a3).toEqual({ intrinsic: 150, price: 120, isUs: true });
    expect(a.buy.b1.sma200).toBe(110);
    expect(a.buy.b3.rsi14).toBe(65);
    expect(a.buy.c1.targetMedian).toBe(155);
  });

  it("computes the 52-week high from the EOD high series", () => {
    const a = assembleScoreInputs("AAPL", bundle("AAPL"), emptyHistory, asOf);
    // Highest bar high = close at i=0-ish: 100 + 300*0.1 + 1 = 131
    expect(a.buy.b2.high52w).toBeCloseTo(131, 1);
  });

  it("sums TTM fundamentals for the quality gates", () => {
    const a = assembleScoreInputs("AAPL", bundle("AAPL"), emptyHistory, asOf);
    expect(a.buy.fcfTtm).toBe(1200); // 4 * 300
    expect(a.buy.dividendsPaidTtm).toBe(400); // |4 * -100|
    expect(a.buy.netIncomeTtm).toBe(800); // 4 * 200
    expect(a.buy.marketCapUsd).toBe(5_000_000_000);
  });

  it("marks gate fundamentals null (not 0) when FMP returns no rows", () => {
    // A UK name with an FMP fundamentals gap: no income / cashflow rows. These
    // must surface as null so the gates skip, not as 0 which reads as a loss.
    const gap = bundle("VOD.L", { incomeQuarterly: [], cashflowQuarterly: [] });
    const a = assembleScoreInputs("VOD.L", gap, emptyHistory, asOf);
    expect(a.buy.netIncomeTtm).toBeNull();
    expect(a.buy.fcfTtm).toBeNull();
    expect(a.buy.ebitTtm).toBeNull();
    expect(a.buy.interestExpenseTtm).toBeNull();
  });

  it("does not spuriously fail GATE_1/3/4 when fundamentals are unavailable", async () => {
    const { computeBuyScore } = await import("../compute-buy-score");
    const gap = bundle("VOD.L", { incomeQuarterly: [], cashflowQuarterly: [] });
    const a = assembleScoreInputs("VOD.L", gap, emptyHistory, asOf);
    const result = computeBuyScore(a.buy);
    expect(result.failedGates).not.toContain("GATE_1");
    expect(result.failedGates).not.toContain("GATE_3");
    expect(result.failedGates).not.toContain("GATE_4");
  });

  it("builds a daily yield series long enough for A1", () => {
    const a = assembleScoreInputs("AAPL", bundle("AAPL"), emptyHistory, asOf);
    expect(a.buy.a1.dailyYields.length).toBeGreaterThanOrEqual(250);
  });

  it("diffs grade-count snapshots into directional events (net upgrade here)", () => {
    const a = assembleScoreInputs("AAPL", bundle("AAPL"), emptyHistory, asOf);
    expect(a.buy.c2.events.length).toBeGreaterThan(0);
    expect(a.buy.c2.events.every((e) => e.action === "Upgrade")).toBe(true);
  });

  it("finds the symbol's next ex-dividend from the market calendar", () => {
    const a = assembleScoreInputs("AAPL", bundle("AAPL"), emptyHistory, asOf);
    expect(a.buy.d2.nextExDivDate).toBe(daysAhead(20));
  });

  it("passes sector median yield as null (no source) so D1 is N/A", () => {
    const a = assembleScoreInputs("AAPL", bundle("AAPL"), emptyHistory, asOf);
    expect(a.buy.d1.sectorMedianYield).toBeNull();
  });

  it("assembles Risk inputs incl. payout, leverage and insider trades", () => {
    const a = assembleScoreInputs("AAPL", bundle("AAPL"), emptyHistory, asOf);
    expect(a.risk.r3.payoutRatio).toBe(0.45);
    expect(a.risk.r5.currentNetDebtToEbitda).toBe(1.5);
    expect(a.risk.r7Trades.trades.length).toBe(1);
    expect(a.risk.r4.pastEpsHistory).toEqual([]); // cold-start until persisted
  });

  it("sums the trailing-12-month dividend per share (US quarterly)", () => {
    // default bundle: 4 payments of 0.25 at 0/90/180/270 days ago = all in window
    const a = assembleScoreInputs("AAPL", bundle("AAPL"), emptyHistory, asOf);
    expect(a.dividendPerShareTtm).toBeCloseTo(1.0, 6);
  });

  it("counts only payments within the trailing 12 months (UK semi-annual)", () => {
    // Sainsbury's-style: interim + final this year (in window), plus last
    // year's two (older than 365d). Only the recent pair should count.
    const sbry = bundle("SBRY.L", {
      dividends: [
        { date: daysAgo(60), adjDividend: 9.6, dividend: 9.6 }, // final, recent
        { date: daysAgo(240), adjDividend: 3.9, dividend: 3.9 }, // interim, recent
        { date: daysAgo(420), adjDividend: 9.2, dividend: 9.2 }, // last year, >365d
        { date: daysAgo(600), adjDividend: 3.6, dividend: 3.6 }, // last year, >365d
      ],
    });
    const a = assembleScoreInputs("SBRY.L", sbry, emptyHistory, asOf);
    expect(a.dividendPerShareTtm).toBeCloseTo(13.5, 6); // 9.6 + 3.9 only
  });

  it("produces a buy score result when fed through computeBuyScore", async () => {
    const { computeBuyScore } = await import("../compute-buy-score");
    const a = assembleScoreInputs("AAPL", bundle("AAPL"), emptyHistory, asOf);
    const result = computeBuyScore(a.buy);
    expect(result.qualityGatePassed).toBe(true);
    expect(result.score).not.toBeNull();
    expect(result.signals.length).toBe(11);
  });
});
