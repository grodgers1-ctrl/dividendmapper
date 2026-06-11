-- Phase 3.5 Sprint 1: company name for the holdings table.
--
-- The holdings table shows only the ticker. Persist the FMP profile's
-- companyName alongside each score so the UI can render "Microsoft Corporation"
-- under MSFT. Populated by the nightly scoring cron; existing rows backfill on
-- the next run. Nullable — manual/unscored tickers fall back to the ticker.

alter table public.equity_scores add column if not exists name text;
