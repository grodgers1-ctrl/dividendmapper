-- 0021_equity_scores_projection.sql
-- Adds bidirectional projection caches to equity_scores. The nightly cron
-- writes both forward (next 12mo) and historical (past 12mo) per-ticker
-- projection arrays; the page layer combines historical with the user's
-- holdings (quantity × created_at floor) at render time.

alter table public.equity_scores
  add column if not exists projected_next_12m_payments       jsonb,
  add column if not exists projected_historical_12m_payments jsonb,
  add column if not exists projected_cadence                 text,
  add column if not exists projected_growth_rate             numeric,
  add column if not exists projected_at                      timestamptz;

comment on column public.equity_scores.projected_next_12m_payments is
  'JSONB array of { ex_date, pay_date, per_share_amount, currency, confidence }. Cron-written; consumed by the calendar page forward-projection.';
comment on column public.equity_scores.projected_historical_12m_payments is
  'JSONB array of { ex_date, pay_date, per_share_amount, currency, confidence }. Cron-written; consumed by the calendar page back-fill gated on holdings.created_at.';
comment on column public.equity_scores.projected_cadence is
  'monthly | quarterly | semi | annual | irregular | unknown';
comment on column public.equity_scores.projected_growth_rate is
  'Uncapped 3yr CAGR for diagnostics. Display layer applies the ±20% cap.';
comment on column public.equity_scores.projected_at is
  'Timestamp of the last projection-engine run.';
