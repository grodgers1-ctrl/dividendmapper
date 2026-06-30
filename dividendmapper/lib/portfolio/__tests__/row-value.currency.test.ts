import { describe, it, expect } from 'vitest';
import { scoringPrice, displayCurrency } from '../row-value';

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

describe('displayCurrency', () => {
  it('normalises GBp / GBX / GBP to GBP', () => {
    expect(displayCurrency({ currency: 'GBp', ticker: 'VWRL.L' })).toBe('GBP');
    expect(displayCurrency({ currency: 'GBX', ticker: 'UKW.L' })).toBe('GBP');
    expect(displayCurrency({ currency: 'GBP', ticker: 'VWRL.L' })).toBe('GBP');
  });

  it('passes through USD and EUR verbatim', () => {
    expect(displayCurrency({ currency: 'USD', ticker: 'SCHD' })).toBe('USD');
    expect(displayCurrency({ currency: 'EUR', ticker: 'CSPX.AS' })).toBe('EUR');
  });

  it('falls back to "GBP" for legacy null currency on .L ticker', () => {
    expect(displayCurrency({ currency: null, ticker: 'VWRL.L' })).toBe('GBP');
  });

  it('returns the input currency verbatim for other codes (e.g. AUD, CAD)', () => {
    expect(displayCurrency({ currency: 'AUD', ticker: 'CBA.AX' })).toBe('AUD');
    expect(displayCurrency({ currency: 'CAD', ticker: 'TD.TO' })).toBe('CAD');
  });

  it('falls back to "USD" when currency is null and ticker is not .L', () => {
    expect(displayCurrency({ currency: null, ticker: 'AAPL' })).toBe('USD');
  });
});
