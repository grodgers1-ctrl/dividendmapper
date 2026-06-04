-- Phase 3 Segment 1 schema migration
-- Adds: user_dividends — per-user ACTUAL paid dividends ingested from a broker
--       (Trading 212 first; connection_id is nullable to leave room for CSV /
--       manual entry later). Becomes the PREFERRED income source over the FMP
--       per-ticker estimate. Shaped with Phase 6 tax reports in mind.
--
-- Apply via Supabase Dashboard > SQL Editor or `npx supabase db push --linked`.

create table public.user_dividends (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  connection_id           uuid references public.broker_connections(id) on delete set null,
  ticker                  text not null,            -- raw broker ticker, e.g. "VODl_EQ"
  ticker_scoring          text,                     -- our normalised ticker, e.g. "VOD.L"
  wrapper                 text not null
                            check (wrapper in ('isa','sipp','gia','401k','ira','roth_ira','brokerage')),
  amount                  numeric(18,4) not null,
  currency                text not null check (length(currency) = 3),
  gross_amount_per_share  numeric(18,6),
  paid_on                 date not null,
  -- Raw-ish payment type from the broker, app-normalised to lowercase. NOT
  -- check-constrained on purpose: the T212 type vocabulary is not yet fully
  -- enumerated (confirmed against the live API in Segment 2), and a strict
  -- CHECK would fail an otherwise-good sync on an unforeseen value. Phase 6 tax
  -- reports care about distinguishing 'dividend' from 'property_income_distribution'
  -- (UK REIT PIDs are taxed differently), so the value is preserved verbatim.
  type                    text not null default 'dividend',
  -- T212 reference if present, else a composite hash of
  -- ticker + paid_on + amount + gross_amount_per_share. unique(user_id, external_id)
  -- makes re-sync idempotent.
  external_id             text not null,
  source                  text not null default 'trading212'
                            check (source in ('trading212','csv','manual')),
  created_at              timestamptz not null default now(),
  unique (user_id, external_id)
);

create index user_dividends_user_id_idx on public.user_dividends(user_id);
-- Income view sums actuals per (ticker_scoring x wrapper) for a user.
create index user_dividends_user_ticker_idx
  on public.user_dividends(user_id, ticker_scoring, wrapper);

alter table public.user_dividends enable row level security;

create policy user_dividends_self_all
  on public.user_dividends for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
