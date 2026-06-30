import { describe, it, expect } from 'vitest';
import { scoringPrice } from '../row-value';

describe('scoringPrice currency awareness', () => {
  it('keeps GBP price unchanged for LSE ticker (the FMP /stable case)', () => {
    expect(scoringPrice({ price: 137.65, currency: 'GBP', ticker: 'VWRL.L' })).toBeCloseTo(137.65, 2);
  });

  it('converts GBp pence to pounds for LSE ticker', () => {
    expect(scoringPrice({ price: 13765, currency: 'GBp', ticker: 'VWRL.L' })).toBeCloseTo(137.65, 2);
  });

  it('converts GBX pence to pounds for LSE ticker', () => {
    expect(scoringPrice({ price: 103, currency: 'GBX', ticker: 'UKW.L' })).toBeCloseTo(1.03, 2);
  });

  it('keeps USD price unchanged for US ticker', () => {
    expect(scoringPrice({ price: 76.32, currency: 'USD', ticker: 'SCHD' })).toBeCloseTo(76.32, 2);
  });

  it('falls back to ticker-suffix heuristic when currency is null (legacy rows)', () => {
    // Legacy behaviour: treat .L tickers as pence so existing broker-synced
    // rows (where prices were stored in pence) keep displaying correctly.
    expect(scoringPrice({ price: 13765, currency: null, ticker: 'VWRL.L' })).toBeCloseTo(137.65, 2);
  });
});
