-- Phase 2.75 Day 1 schema migration.
-- Adds 9 tables for equity scoring + reinvest recommender + personalisation
-- wizard + notifications + watchlist. All tables have RLS enabled.
--
-- Apply via:  set -a && source dividendmapper/.env.local && set +a
--             cd dividendmapper && npx supabase db push --dry-run
--             cd dividendmapper && npx supabase db push --yes

-- =============================================================================
-- equity_scores — current snapshot, one row per ticker. Public-read.
-- =============================================================================
create table public.equity_scores (
  ticker                     text primary key,
  buy_score                  integer check (buy_score between 0 and 100),
  buy_quality_gate_passed    boolean not null default true,
  buy_failed_gates           text[],
  trim_score                 integer check (trim_score between 0 and 100),
  risk_score                 integer check (risk_score between 0 and 100),
  computed_at                timestamptz not null default now(),
  ticker_market              text,
  data_quality               text not null default 'full'
                             check (data_quality in ('full','degraded_uk','sparse')),
  updated_at                 timestamptz not null default now()
);
create index equity_scores_updated_at_idx on public.equity_scores(updated_at);

alter table public.equity_scores enable row level security;
create policy equity_scores_public_read on public.equity_scores
  for select using (true);
-- No write policy: only the service-role nightly job writes here.

-- =============================================================================
-- equity_score_history — daily per-ticker snapshot for trend + R1/R4 inputs.
-- =============================================================================
create table public.equity_score_history (
  id                       uuid primary key default gen_random_uuid(),
  ticker                   text not null,
  observed_at              date not null,
  buy_score                integer,
  trim_score               integer,
  risk_score               integer,
  current_price            numeric(18,4),
  current_yield            numeric(8,4),
  dividend_per_share       numeric(18,4),
  eps_avg                  numeric(18,4),
  net_debt_to_ebitda       numeric(8,2),
  interest_coverage        numeric(8,2),
  unique (ticker, observed_at)
);
create index equity_score_history_ticker_idx
  on public.equity_score_history(ticker, observed_at desc);

alter table public.equity_score_history enable row level security;
create policy equity_score_history_public_read on public.equity_score_history
  for select using (true);

-- =============================================================================
-- equity_score_signals — per-signal breakdown for the drawer UI.
-- =============================================================================
create table public.equity_score_signals (
  id              uuid primary key default gen_random_uuid(),
  ticker          text not null,
  score_type      text not null check (score_type in ('buy','trim','risk')),
  signal_code     text not null,
  raw_score       integer,
  raw_points      integer,
  weight          numeric(4,2),
  contribution    numeric(6,2),
  human_label     text not null,
  observed_at     date not null,
  unique (ticker, score_type, signal_code, observed_at)
);
create index equity_score_signals_lookup_idx
  on public.equity_score_signals(ticker, score_type, observed_at desc);

alter table public.equity_score_signals enable row level security;
create policy equity_score_signals_public_read on public.equity_score_signals
  for select using (true);

-- =============================================================================
-- score_overrides — user-level 90-day score-hide.
-- =============================================================================
create table public.score_overrides (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  ticker       text not null,
  score_type   text not null check (score_type in ('buy','trim','risk')),
  expires_at   timestamptz not null,
  reason       text,
  created_at   timestamptz not null default now(),
  unique (user_id, ticker, score_type)
);

alter table public.score_overrides enable row level security;
create policy score_overrides_self on public.score_overrides for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- reinvest_suggestions_log — outcome tracking for forward analysis.
-- =============================================================================
create table public.reinvest_suggestions_log (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  trigger_holding_id     uuid not null references public.holdings(id) on delete cascade,
  trigger_ex_div_date    date not null,
  suggested_tickers      text[] not null,
  user_action            text check (user_action in ('accepted','dismissed','shown_only')),
  user_action_ticker     text,
  created_at             timestamptz not null default now(),
  acted_at               timestamptz
);

alter table public.reinvest_suggestions_log enable row level security;
create policy reinvest_suggestions_self on public.reinvest_suggestions_log for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- user_preferences — personalisation wizard answers + future-features capture.
-- =============================================================================
create table public.user_preferences (
  user_id                       uuid primary key references auth.users(id) on delete cascade,
  primary_goal                  text check (primary_goal in
                                  ('income_now','total_return','safety_stability','undecided')),
  investing_horizon             text check (investing_horizon in
                                  ('lt_5y','5_10y','10y_plus','already_retired','undecided')),
  risk_appetite                 text check (risk_appetite in
                                  ('cautious','balanced','aggressive','undecided')),
  reinvest_default              text check (reinvest_default in
                                  ('always_drip','look_for_opportunities','withdraw_cash','undecided')),
  sectors_to_avoid              text[],
  annual_income_target_gbp      numeric(12,2),
  wizard_completed_at           timestamptz,
  wizard_skipped_at             timestamptz,
  wizard_last_reviewed_at       timestamptz,
  updated_at                    timestamptz not null default now()
);

alter table public.user_preferences enable row level security;
create policy user_preferences_self on public.user_preferences for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- notification_preferences — one row per (user, event_type) pair.
-- =============================================================================
create table public.notification_preferences (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  event_type          text not null check (event_type in (
                        'buy_threshold_crossed',
                        'risk_threshold_crossed',
                        'trim_threshold_crossed',
                        'reinvest_opportunity',
                        'weekly_digest',
                        'watchlist_alert'
                      )),
  enabled             boolean not null default false,
  threshold_value     integer check (threshold_value between 0 and 100),
  quiet_hours_start   time default '22:00',
  quiet_hours_end     time default '08:00',
  paused_until        timestamptz,
  last_sent_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, event_type)
);

alter table public.notification_preferences enable row level security;
create policy notification_preferences_self on public.notification_preferences for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- notification_overrides — per-ticker custom thresholds (progressive disclosure UI).
-- =============================================================================
create table public.notification_overrides (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  ticker              text not null,
  event_type          text not null check (event_type in (
                        'buy_threshold_crossed',
                        'risk_threshold_crossed',
                        'trim_threshold_crossed'
                      )),
  threshold_value     integer not null check (threshold_value between 0 and 100),
  created_at          timestamptz not null default now(),
  unique (user_id, ticker, event_type)
);

alter table public.notification_overrides enable row level security;
create policy notification_overrides_self on public.notification_overrides for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- tracked_tickers — watchlist. UI in polish backlog; schema ships now.
-- Pro tier capped at 5 rows (enforced at API write); Premium unlimited.
-- =============================================================================
create table public.tracked_tickers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  ticker      text not null,
  added_at    timestamptz not null default now(),
  source      text default 'manual' check (source in
                ('manual','scoring_lookup','reinvest_suggestion')),
  unique (user_id, ticker)
);

alter table public.tracked_tickers enable row level security;
create policy tracked_tickers_self on public.tracked_tickers for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
