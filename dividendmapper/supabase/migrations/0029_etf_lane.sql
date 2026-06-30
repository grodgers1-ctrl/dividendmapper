-- 0029_etf_lane.sql
-- ETF lane foundation: master tickers dimension + asset_type enum + curated universe + caches.

-- Postgres has no `create type if not exists` — guard with a DO block.
do $$ begin
  if not exists (select 1 from pg_type where typname = 'asset_type' and typnamespace = 'public'::regnamespace) then
    create type public.asset_type as enum (
      'equity', 'etf', 'fund', 'reit', 'bdc', 'unknown'
    );
  end if;
end $$;

-- Master tickers dimension (was missing — created in Phase 2 of ETF Lane).
create table if not exists public.tickers (
  ticker text primary key,
  asset_type public.asset_type not null default 'unknown',
  added_at timestamptz not null default now()
);

create index if not exists tickers_asset_type_idx on public.tickers(asset_type);

-- Seed from existing source-of-truth tables. asset_type stays 'unknown' until
-- Task 2.4's FMP-driven backfill classifies them.
insert into public.tickers (ticker)
select distinct ticker from public.equity_scores
union
select distinct ticker from public.vehicle_universe
union
select distinct ticker from public.holdings where ticker is not null
on conflict (ticker) do nothing;

create table if not exists public.etf_universe (
  ticker text primary key references public.tickers(ticker) on delete cascade,
  isin text,
  name text not null,
  family text,
  distribution_policy text check (distribution_policy in ('Distributing','Accumulating','Unknown')),
  domicile text,
  hedged boolean default false,
  benchmark text,
  category text,
  manual_override boolean not null default false,
  added_at timestamptz not null default now()
);

create table if not exists public.etf_facts (
  ticker text primary key references public.tickers(ticker) on delete cascade,
  ter numeric,
  aum numeric,
  inception_date date,
  holdings_count integer,
  distribution_frequency text,
  isin text,
  domicile text,
  family text,
  nav_currency text,
  refreshed_at timestamptz not null default now()
);

create table if not exists public.etf_holdings_cache (
  ticker text not null references public.tickers(ticker) on delete cascade,
  source text not null check (source in ('alpha_vantage','yahoo','fmp')),
  holding_symbol text not null,
  holding_name text,
  weight_pct numeric not null,
  rank integer not null,
  refreshed_at timestamptz not null default now(),
  primary key (ticker, holding_symbol)
);

create index if not exists etf_holdings_cache_ticker_rank_idx
  on public.etf_holdings_cache(ticker, rank);

create table if not exists public.etf_sector_weights_cache (
  ticker text not null references public.tickers(ticker) on delete cascade,
  source text not null check (source in ('fmp','yahoo')),
  sector text not null,
  weight_pct numeric not null,
  refreshed_at timestamptz not null default now(),
  primary key (ticker, sector)
);

create table if not exists public.etf_country_weights_cache (
  ticker text not null references public.tickers(ticker) on delete cascade,
  country text not null,
  weight_pct numeric not null,
  refreshed_at timestamptz not null default now(),
  primary key (ticker, country)
);

-- RLS: read-only public on the dimension + all 5 ETF tables.
alter table public.tickers                       enable row level security;
alter table public.etf_universe                  enable row level security;
alter table public.etf_facts                     enable row level security;
alter table public.etf_holdings_cache            enable row level security;
alter table public.etf_sector_weights_cache      enable row level security;
alter table public.etf_country_weights_cache     enable row level security;

create policy "tickers read"               on public.tickers                       for select using (true);
create policy "etf_universe read"          on public.etf_universe                  for select using (true);
create policy "etf_facts read"             on public.etf_facts                     for select using (true);
create policy "etf_holdings_cache read"    on public.etf_holdings_cache            for select using (true);
create policy "etf_sector_cache read"      on public.etf_sector_weights_cache      for select using (true);
create policy "etf_country_cache read"     on public.etf_country_weights_cache     for select using (true);
