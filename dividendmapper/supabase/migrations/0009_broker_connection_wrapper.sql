-- Phase 3 Segment 3 schema migration
-- Adds: broker_connections.wrapper — the account type (ISA vs Invest) the user
--       picks at connect time. The Trading 212 API does NOT expose Invest-vs-ISA
--       (/equity/account/info returns only { id, currencyCode }), so the user
--       chooses it once and we persist it on the connection. Every synced
--       holding + dividend for this connection inherits this wrapper; the daily
--       sync cron reads it back (no user present to re-ask).
--
-- Same enum as holdings.wrapper / user_dividends.wrapper. Nullable so the column
-- can be added to the live table without a default backfill; the connect route
-- always sets it, so new rows are never null.
--
-- Apply via Supabase Dashboard > SQL Editor or `npx supabase db push --linked`.

alter table public.broker_connections
  add column wrapper text
    check (wrapper in ('isa','sipp','gia','401k','ira','roth_ira','brokerage'));
