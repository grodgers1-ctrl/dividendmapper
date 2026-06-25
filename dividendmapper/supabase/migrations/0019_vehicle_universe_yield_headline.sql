-- Income vehicles hub Day 5 prep: add display fields populated post-scoring.
-- dividend_yield is decimal (e.g. 0.056 = 5.6%). leverage_headline is a
-- family-aware label like "FFO payout 81%", "NII covers regular dividend 1.05×"
-- or "LTV 33%". Both are populated by the existing
-- /api/internal/refresh-vehicle-scores cron, which now writes display fields
-- per-ticker after the score persist.

alter table public.vehicle_universe
  add column if not exists dividend_yield numeric,
  add column if not exists leverage_headline text;

comment on column public.vehicle_universe.dividend_yield is
  'Trailing 12-month dividend yield from FMP ratios-ttm. Decimal (0.056 = 5.6%). Populated daily by /api/internal/refresh-vehicle-scores after scoring runs.';
comment on column public.vehicle_universe.leverage_headline is
  'Short, family-specific leverage label sourced from the highest-weight leverage signal in compute-vehicle-score (Q_R1 for US REITs, Q_B1 for US BDCs, Q_U2 for UK REITs).';
