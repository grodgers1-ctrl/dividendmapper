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
    // bracketed actual value alongside the percentile callout
    expect(v.value).toMatch(/P78 \(22\.4x\)/);
    expect(v.value).toMatch(/yield at P22 \(2\.8%\)/);
    expect(v.safety).toMatch(/P40 \(45%\)/);          // fcf_payout (pct format)
    expect(v.safety).toMatch(/P35 \(1\.20\)/);        // net_debt_ebitda (ratio)
    expect(v.safety).toMatch(/P80 \(18\.00\)/);       // interest_coverage (ratio)
    expect(v.growth).toMatch(/P60 \(10%\)/);          // dgr_5y (pct)
    expect(v.growth).toMatch(/ROIC P70 \(18%\)/);     // roic (pct)
    expect(v.profitability).toMatch(/P85 \(68%\)/);   // gross_margin (pct)
  });

  it('omits the bracketed value when the raw is null but the percentile is not', () => {
    const v = synthesiseVerdicts({
      ticker: 'X',
      current: {
        pe: null, p_fcf: null, dividend_yield: null, fcf_payout: null, net_debt_ebitda: null,
        interest_coverage: null, dgr_5y: null, fcf_growth_yoy: null, roic: null,
        gross_margin: null, operating_margin: null, net_margin: null,
      },
      percentiles: {
        pe: 0.5, p_fcf: 0.5, dividend_yield: 0.5, fcf_payout: 0.5, net_debt_ebitda: 0.5,
        interest_coverage: 0.5, dgr_5y: 0.5, fcf_growth_yoy: 0.5, roic: 0.5,
        gross_margin: 0.5, operating_margin: 0.5, net_margin: 0.5,
      },
    });
    expect(v.value).toMatch(/P50/);
    expect(v.value).not.toMatch(/\(/);                // no opening bracket → no value rendered
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
