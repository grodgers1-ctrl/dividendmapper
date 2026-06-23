-- Persisted trailing-TTM P/E from FMP /ratios-ttm. The FundamentalsCard
-- previously derived "P/E" client-side as current_price / eps_avg, but
-- eps_avg holds FORWARD EPS (the R4 signal input), so the derivation
-- collapsed to forward P/E on US tickers and mixed pence/£ units on .L
-- tickers. Existing rows backfill to NULL — the card renders a — placeholder
-- until the next nightly scoring cron populates the column.

alter table public.equity_scores
  add column trailing_pe numeric;
