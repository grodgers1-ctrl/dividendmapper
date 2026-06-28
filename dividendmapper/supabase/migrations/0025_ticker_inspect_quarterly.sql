create table if not exists public.ticker_inspect_quarterly (
  ticker            text          not null,
  observed_at       date          not null,
  pe                numeric(20,4),
  p_fcf             numeric(20,4),
  net_debt_ebitda   numeric(20,4),
  interest_coverage numeric(20,4),
  fcf_payout        numeric(10,6),
  fcf_growth_yoy    numeric(10,6),
  roic              numeric(10,6),
  gross_margin      numeric(10,6),
  operating_margin  numeric(10,6),
  net_margin        numeric(10,6),
  source            text          not null default 'fmp',
  refreshed_at      timestamptz   not null default now(),
  primary key (ticker, observed_at)
);

create index if not exists ticker_inspect_quarterly_refreshed_idx
  on public.ticker_inspect_quarterly (ticker, refreshed_at desc);
