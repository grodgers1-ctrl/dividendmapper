-- 0024_ticker_price_history.sql
-- Per-ticker daily close-price history backing the row sparklines on /app/portfolio.
-- Populated by the one-time backfill script (FMP historical-price-full) and the
-- nightly cron (append today's close per ticker). Retention is bounded by a daily
-- prune to keep ~5Y per ticker (1300 trading days).

create table if not exists public.ticker_price_history (
  ticker      text          not null,
  trade_date  date          not null,
  close       numeric(20,6) not null,
  currency    text          not null,
  primary key (ticker, trade_date)
);

create index if not exists ticker_price_history_recent_idx
  on public.ticker_price_history (ticker, trade_date desc);

-- Public read; service role only writes. Holds no user data.
alter table public.ticker_price_history enable row level security;

drop policy if exists "ticker_price_history read public"
  on public.ticker_price_history;
create policy "ticker_price_history read public"
  on public.ticker_price_history for select
  using (true);

comment on table public.ticker_price_history is
  'Per-ticker daily close prices in display units (USD for US, GBp for .L). '
  'Server-rendered sparklines on /app/portfolio. Public read; backfilled from '
  'FMP historical-price-full and appended by the nightly cron.';
