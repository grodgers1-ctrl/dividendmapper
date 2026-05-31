-- Phase 2.75 Day 6B: persist each ticker's next upcoming ex-dividend so the
-- portfolio page can trigger the Reinvest Recommender card without a per-request
-- FMP call. Written by the nightly cron from the market-wide dividends-calendar.
-- Additive only: no score column changes, no compute change.
alter table public.equity_scores
  add column if not exists next_ex_div_date    date,
  add column if not exists next_ex_div_amount  numeric(18,4),  -- per share, native units (USD, or GBX pence for .L)
  add column if not exists next_ex_div_pay_date date;
-- equity_scores_public_read (using true) already covers the new columns; no RLS change.
