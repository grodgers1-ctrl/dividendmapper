-- Daily per-user snapshot of total forward-annual dividend income, bucketed by
-- currency. Feeds the dashboard's RidgeSparkline so the 12-month trend is
-- real history rather than a synthetic ramp. Per-currency rows (rather than a
-- single GBP figure) preserve the breakdown so the read path can FX-convert
-- using current rates — keeps income-trend and FX-drift visually separable.
--
-- Written exclusively by the snapshot-portfolio-income cron with the service
-- role; no INSERT/UPDATE policy below means user clients cannot mutate it.

create table public.portfolio_income_history (
  user_id                 uuid    not null references auth.users(id) on delete cascade,
  snapshot_at             date    not null,
  currency                text    not null,
  total_annual_run_rate   numeric not null,
  primary key (user_id, snapshot_at, currency)
);

create index portfolio_income_history_user_snapshot_idx
  on public.portfolio_income_history (user_id, snapshot_at);

alter table public.portfolio_income_history enable row level security;

create policy "user reads own income history" on public.portfolio_income_history
  for select using (auth.uid() = user_id);
