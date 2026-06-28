export type CachedQuarterlyRow = {
  ticker: string;
  observed_at: string;
  pe: number | null;
  p_fcf: number | null;
  net_debt_ebitda: number | null;
  interest_coverage: number | null;
  fcf_payout: number | null;
  fcf_growth_yoy: number | null;
  roic: number | null;
  gross_margin: number | null;
  operating_margin: number | null;
  net_margin: number | null;
};

export type CachedMonthlyRow = {
  ticker: string;
  observed_at: string;
  dividend_yield: number | null;
  dgr_3y: number | null;
  dgr_5y: number | null;
};

export type InspectMetricKey =
  | 'pe' | 'p_fcf' | 'dividend_yield'
  | 'fcf_payout' | 'net_debt_ebitda' | 'interest_coverage'
  | 'dgr_5y' | 'fcf_growth_yoy' | 'roic'
  | 'gross_margin' | 'operating_margin' | 'net_margin';

export type InspectBundle = {
  ticker: string;
  quarterly: CachedQuarterlyRow[];   // newest-first
  monthly: CachedMonthlyRow[];       // newest-first
  rangeYearsQuarterly: number;
  rangeYearsMonthly: number;
};

export type InspectLoadResult =
  | { status: 'ok'; bundle: InspectBundle; cacheHit: boolean }
  | { status: 'uncoverable' };
