create table if not exists public.ticker_inspect_monthly (
  ticker         text          not null,
  observed_at    date          not null,
  dividend_yield numeric(10,6),
  dgr_3y         numeric(10,6),
  dgr_5y         numeric(10,6),
  source         text          not null default 'computed',
  refreshed_at   timestamptz   not null default now(),
  primary key (ticker, observed_at)
);

create index if not exists ticker_inspect_monthly_refreshed_idx
  on public.ticker_inspect_monthly (ticker, refreshed_at desc);
