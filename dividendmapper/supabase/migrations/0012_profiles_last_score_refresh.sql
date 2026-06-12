-- On-demand score refresh: anchors the per-user 15-min cooldown. Nullable, no
-- backfill — a null value means "never refreshed", which always passes the gate.
alter table public.profiles
  add column if not exists last_score_refresh_at timestamptz;
