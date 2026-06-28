import { describe, it, expect } from 'vitest';
import { synthesiseVerdicts } from '../synthesise-verdicts';

describe('synthesiseVerdicts', () => {
  it('returns 4 verdicts: value, safety, growth, profitability', () => {
    const v = synthesiseVerdicts({
      ticker: 'MSFT',
      current: {
        pe: 22.4, p_fcf: 28.1, dividend_yield: 0.028,
        fcf_payout: 0.45, net_debt_ebitda: 1.2, interest_coverage: 18,
        dgr_5y: 0.10, fcf_growth_yoy: 0.12, roic: 0.18,
        gross_margin: 0.68, operating_margin: 0.42, net_margin: 0.36,
      },
      percentiles: {
        pe: 0.78, p_fcf: 0.52, dividend_yield: 0.22,
        fcf_payout: 0.40, net_debt_ebitda: 0.35, interest_coverage: 0.80,
        dgr_5y: 0.60, fcf_growth_yoy: 0.55, roic: 0.70,
        gross_margin: 0.85, operating_margin: 0.80, net_margin: 0.78,
      },
    });
    expect(Object.keys(v)).toEqual(['value', 'safety', 'growth', 'profitability']);
    expect(v.value).toMatch(/MSFT/);
    expect(v.value).toMatch(/P78/);
  });

  it('uses an em-dash-free placeholder when a percentile is null', () => {
    const v = synthesiseVerdicts({
      ticker: 'KO',
      current: { pe: null, p_fcf: null, dividend_yield: 0.03, fcf_payout: null, net_debt_ebitda: null, interest_coverage: null, dgr_5y: null, fcf_growth_yoy: null, roic: null, gross_margin: null, operating_margin: null, net_margin: null },
      percentiles: { pe: null, p_fcf: null, dividend_yield: null, fcf_payout: null, net_debt_ebitda: null, interest_coverage: null, dgr_5y: null, fcf_growth_yoy: null, roic: null, gross_margin: null, operating_margin: null, net_margin: null },
    });
    expect(v.value).not.toMatch(/—/);    // no em dash
    expect(v.safety).not.toMatch(/—/);
    expect(v.growth).not.toMatch(/—/);
    expect(v.profitability).not.toMatch(/—/);
  });
});
