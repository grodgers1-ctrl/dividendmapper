-- Drop portfolio_income_history. The table was the backing store for the
-- dashboard hero card's RidgeSparkline (12-month income trend). PR #9 removed
-- the sparkline; the snapshot-portfolio-income cron has been writing rows
-- nobody reads ever since. Cleanup PR removes the cron + library code +
-- table in one shot.
--
-- Recovery, if needed: re-running migration 0015 recreates the schema
-- identically. Historical rows are not preserved.

drop policy if exists "user reads own income history" on public.portfolio_income_history;
drop index  if exists public.portfolio_income_history_user_snapshot_idx;
drop table  if exists public.portfolio_income_history;
