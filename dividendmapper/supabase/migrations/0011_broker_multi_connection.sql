-- Phase 3.5 Sprint 2 schema migration
-- Relaxes broker_connections uniqueness so a user can connect more than one
-- account from the same provider — e.g. a Trading 212 ISA *and* Invest (GIA),
-- which have separate API keys. The per-connection `wrapper` column (migration
-- 0009) distinguishes them.
--
-- Before: unique (user_id, provider)            → one T212 account per user
-- After:  unique (user_id, provider, wrapper)    → one per (provider × wrapper)
--
-- The sync-brokers cron already iterates ALL active connections, and reconcile
-- keys synced holdings by (connection_id, external_ref), so two connections
-- coexist cleanly with no further schema change.
--
-- Note: Postgres treats NULLs as distinct in a unique constraint, but the
-- connect route always sets `wrapper`, so live rows are never null.
--
-- Apply via Supabase Dashboard > SQL Editor or `npx supabase db push --linked`.

alter table public.broker_connections
  drop constraint if exists broker_connections_user_id_provider_key;

alter table public.broker_connections
  add constraint broker_connections_user_provider_wrapper_key
    unique (user_id, provider, wrapper);
