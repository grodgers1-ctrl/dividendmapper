-- Fundamentals surfaced on the per-ticker FundamentalsCard. All five are
-- already computed by the scoring engine for use as signal inputs; persisting
-- them is additive — no signal logic changes. Existing rows backfill to NULL
-- and FundamentalsCard renders a — placeholder; values populate on the next
-- nightly scoring cron.

alter table public.equity_scores
  add column sector            text,
  add column forward_pe        numeric,
  add column payout_ratio      numeric,
  add column fcf_coverage      numeric,
  add column dividend_cagr_5y  numeric;
