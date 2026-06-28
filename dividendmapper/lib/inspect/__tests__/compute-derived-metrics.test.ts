import { describe, it, expect } from 'vitest';
import {
  computeFcfPayoutTtm,
  computeFcfGrowthYoy,
  computeMarginsTtm,
  computeMonthlyYieldSeries,
  computeMonthlyDgrSeries,
} from '../compute-derived-metrics';

// quarterly cash-flow rows ordered newest-first, FMP-style
const cashFlow = [
  { date: '2024-09-30', freeCashFlow: 12, dividendsPaid: -4 },
  { date: '2024-06-30', freeCashFlow: 11, dividendsPaid: -4 },
  { date: '2024-03-31', freeCashFlow: 10, dividendsPaid: -4 },
  { date: '2023-12-31', freeCashFlow: 9, dividendsPaid: -4 },
  { date: '2023-09-30', freeCashFlow: 10, dividendsPaid: -3 },
  { date: '2023-06-30', freeCashFlow: 9, dividendsPaid: -3 },
  { date: '2023-03-31', freeCashFlow: 8, dividendsPaid: -3 },
  { date: '2022-12-31', freeCashFlow: 7, dividendsPaid: -3 },
];

describe('computeFcfPayoutTtm', () => {
  it('returns 4-quarter rolling dividends-paid / FCF (abs) per quarter', () => {
    const out = computeFcfPayoutTtm(cashFlow);
    // Most recent (2024-09-30) TTM: divs = 4+4+4+4=16, fcf = 12+11+10+9=42 → 16/42 ≈ 0.381
    expect(out[0].at).toBe('2024-09-30');
    expect(out[0].raw).toBeCloseTo(16 / 42, 3);
  });
  it('returns null when there are fewer than 4 prior quarters', () => {
    const short = cashFlow.slice(0, 3);
    const out = computeFcfPayoutTtm(short);
    expect(out).toHaveLength(0);
  });
});

describe('computeFcfGrowthYoy', () => {
  it('computes TTM-vs-prior-year-TTM growth', () => {
    const out = computeFcfGrowthYoy(cashFlow);
    // 2024-09-30 TTM = 42; prior year (2023-09-30) TTM = 10+9+8+7 = 34. Growth = (42-34)/34 ≈ 0.235
    expect(out[0].at).toBe('2024-09-30');
    expect(out[0].raw).toBeCloseTo(8 / 34, 3);
  });
  it('returns null when prior-year window is missing', () => {
    const recent = cashFlow.slice(0, 4);
    const out = computeFcfGrowthYoy(recent);
    expect(out).toHaveLength(0);
  });
});

describe('computeMarginsTtm', () => {
  const income = [
    { date: '2024-09-30', revenue: 100, grossProfit: 60, operatingIncome: 30, netIncome: 20 },
    { date: '2024-06-30', revenue: 100, grossProfit: 60, operatingIncome: 30, netIncome: 20 },
    { date: '2024-03-31', revenue: 100, grossProfit: 60, operatingIncome: 30, netIncome: 20 },
    { date: '2023-12-31', revenue: 100, grossProfit: 60, operatingIncome: 30, netIncome: 20 },
  ];
  it('computes TTM gross / operating / net margins per quarter', () => {
    const out = computeMarginsTtm(income);
    expect(out[0].at).toBe('2024-09-30');
    expect(out[0].grossMargin).toBe(0.6);
    expect(out[0].operatingMargin).toBe(0.3);
    expect(out[0].netMargin).toBe(0.2);
  });
});

describe('computeMonthlyYieldSeries', () => {
  it('produces month-end points with rolling 365-day dividends ÷ price', () => {
    const closes = [
      { date: '2024-09-30', close: 100 },
      { date: '2024-08-30', close: 100 },
    ];
    const divs = Array.from({ length: 8 }, (_, i) => {
      // 8 quarterly payments from 2023-03 through 2024-12
      const monthIdx = i; // 0..7
      const year = 2023 + Math.floor(monthIdx / 4);
      const monthInYear = (monthIdx % 4) * 3 + 3; // 3, 6, 9, 12
      const month = String(monthInYear).padStart(2, '0');
      return { date: `${year}-${month}-15`, dividend: 1 };
    });
    const out = computeMonthlyYieldSeries({ closes, dividends: divs, fromMonth: '2024-08', toMonth: '2024-09' });
    expect(out).toHaveLength(2);
    expect(out[0].at).toBe('2024-08-31');
    expect(out[0].raw).toBeCloseTo(0.04, 3); // 4 / 100
  });
});

describe('computeMonthlyDgrSeries', () => {
  it('emits one DGR point per month-end with 3y and 5y values', () => {
    const stream: Array<{ date: string; dividend: number }> = [];
    for (let y = 2015; y <= 2024; y++) {
      for (let q = 0; q < 4; q++) {
        stream.push({ date: `${y}-${String(q * 3 + 1).padStart(2, '0')}-15`, dividend: 0.5 * Math.pow(1.1, y - 2015) });
      }
    }
    const out = computeMonthlyDgrSeries({ dividends: stream, fromMonth: '2023-01', toMonth: '2023-12' });
    expect(out).toHaveLength(12);
    expect(out[0].dgr5y).not.toBeNull();
    expect(out[0].dgr5y!).toBeGreaterThan(0.09);
    expect(out[0].dgr5y!).toBeLessThan(0.11);
  });
});
