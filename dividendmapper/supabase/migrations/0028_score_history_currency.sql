-- 0028a_score_history_currency.sql
-- Adds currency awareness to score history so scoringPrice() can normalise correctly.
alter table public.equity_score_history
  add column if not exists current_price_currency text;

comment on column public.equity_score_history.current_price_currency is
  'ISO 4217 currency of current_price as reported by FMP profile (GBP, USD, GBp, etc). NULL on rows from before this migration.';

-- Backfill from FMP profile via the next refresh-equity-scores run; do not
-- attempt to infer from ticker suffix here — that's exactly the bug we are fixing.
