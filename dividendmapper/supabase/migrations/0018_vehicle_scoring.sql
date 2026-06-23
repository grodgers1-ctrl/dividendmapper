-- Phase 4 Sprint 1 Day 1 — Income Vehicle Scoring schema.
-- Six new tables for US REIT + US BDC + UK REIT scoring. Mirrors the equity
-- scoring tables but discriminated by vehicle_type ('us_reit','us_bdc','uk_reit').
-- All public-read (matches equity_scores RLS); only the service-role nightly
-- jobs write here.
--
-- Apply via:  cd dividendmapper && npx supabase db push --dry-run
--             cd dividendmapper && npx supabase db push --yes

-- =============================================================================
-- vehicle_universe — locked V1 universe (~100 tickers across the three families).
-- Populated by scripts/scoring/load-vehicle-universe.ts (Sprint 1 Day 1).
-- =============================================================================
create table public.vehicle_universe (
  ticker                 text primary key,
  vehicle_type           text not null check (vehicle_type in ('us_reit','us_bdc','uk_reit')),
  display_name           text not null,
  exchange               text not null,
  currency               text not null,
  sub_sector             text,
  cik                    text,
  market_cap_at_seed     numeric(20,2),
  last_filing_date       date,
  status                 text not null default 'active'
                         check (status in ('active','delisted','acquired')),
  successor_ticker       text,
  included_in_v1         boolean not null default true,
  added_at               timestamptz not null default now(),
  notes                  text
);
create index vehicle_universe_type_active_idx
  on public.vehicle_universe(vehicle_type)
  where included_in_v1 and status = 'active';

alter table public.vehicle_universe enable row level security;
create policy vehicle_universe_public_read on public.vehicle_universe
  for select using (true);

-- =============================================================================
-- vehicle_fundamentals — per-period snapshot (quarterly US, semi-annual UK).
-- Populated by the weekly fundamentals cron (Day 4).
-- =============================================================================
create table public.vehicle_fundamentals (
  id                          uuid primary key default gen_random_uuid(),
  ticker                      text not null references public.vehicle_universe(ticker) on delete cascade,
  period_end                  date not null,
  period_type                 text not null check (period_type in ('quarterly','semi_annual','annual')),
  ffo_per_share               numeric(18,4),
  affo_per_share              numeric(18,4),
  nii_per_share               numeric(18,4),
  nav_per_share               numeric(18,4),
  debt_total                  numeric(20,2),
  equity_total                numeric(20,2),
  ebitda                      numeric(20,2),
  interest_expense            numeric(20,2),
  ltv_pct                     numeric(6,2),
  property_segment_hhi        numeric(6,4),
  geo_segment_hhi             numeric(6,4),
  tenant_concentration_hhi    numeric(6,4),
  source                      text not null default 'fmp',
  source_url                  text,
  observed_at                 timestamptz not null default now(),
  unique (ticker, period_end, period_type)
);
create index vehicle_fundamentals_ticker_period_idx
  on public.vehicle_fundamentals(ticker, period_end desc);

alter table public.vehicle_fundamentals enable row level security;
create policy vehicle_fundamentals_public_read on public.vehicle_fundamentals
  for select using (true);

-- =============================================================================
-- vehicle_prices — daily close cache. Populated by the daily price cron (Day 3).
-- 10y backfill at first run; ~365k row equilibrium for ~100 tickers.
-- =============================================================================
create table public.vehicle_prices (
  id            uuid primary key default gen_random_uuid(),
  ticker        text not null references public.vehicle_universe(ticker) on delete cascade,
  observed_at   date not null,
  close_price   numeric(18,4) not null,
  source        text not null default 'fmp',
  unique (ticker, observed_at)
);
create index vehicle_prices_ticker_idx
  on public.vehicle_prices(ticker, observed_at desc);

alter table public.vehicle_prices enable row level security;
create policy vehicle_prices_public_read on public.vehicle_prices
  for select using (true);

-- =============================================================================
-- vehicle_scores — current snapshot, one row per ticker. Mirrors equity_scores.
-- Populated by the daily scoring cron (Sprint 2 Day 11).
-- =============================================================================
create table public.vehicle_scores (
  ticker                  text primary key references public.vehicle_universe(ticker) on delete cascade,
  vehicle_type            text not null check (vehicle_type in ('us_reit','us_bdc','uk_reit')),
  resilience_score        integer check (resilience_score between 0 and 100),
  quality_gate_passed     boolean not null default false,
  failed_gates            text[],
  data_quality            text not null default 'full'
                          check (data_quality in ('full','partial','sparse')),
  computed_at             timestamptz not null default now()
);
create index vehicle_scores_type_score_idx
  on public.vehicle_scores(vehicle_type, resilience_score desc nulls last);

alter table public.vehicle_scores enable row level security;
create policy vehicle_scores_public_read on public.vehicle_scores
  for select using (true);

-- =============================================================================
-- vehicle_score_signals — per-signal breakdown for the drawer/methodology UI.
-- Mirrors equity_score_signals shape.
-- =============================================================================
create table public.vehicle_score_signals (
  id            uuid primary key default gen_random_uuid(),
  ticker        text not null references public.vehicle_universe(ticker) on delete cascade,
  signal_code   text not null,
  raw_score     numeric(6,2),
  weight        numeric(4,2),
  contribution  numeric(6,2),
  human_label   text not null,
  observed_at   date not null,
  unique (ticker, signal_code, observed_at)
);
create index vehicle_score_signals_lookup_idx
  on public.vehicle_score_signals(ticker, observed_at desc);

alter table public.vehicle_score_signals enable row level security;
create policy vehicle_score_signals_public_read on public.vehicle_score_signals
  for select using (true);

-- =============================================================================
-- vehicle_score_history — daily snapshot. Mirrors equity_score_history.
-- =============================================================================
create table public.vehicle_score_history (
  id                  uuid primary key default gen_random_uuid(),
  ticker              text not null references public.vehicle_universe(ticker) on delete cascade,
  observed_at         date not null,
  resilience_score    integer,
  price_nav_ratio     numeric(8,4),
  unique (ticker, observed_at)
);
create index vehicle_score_history_ticker_idx
  on public.vehicle_score_history(ticker, observed_at desc);

alter table public.vehicle_score_history enable row level security;
create policy vehicle_score_history_public_read on public.vehicle_score_history
  for select using (true);
