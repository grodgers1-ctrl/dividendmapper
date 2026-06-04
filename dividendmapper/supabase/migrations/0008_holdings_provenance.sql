-- Phase 3 Segment 1 schema migration
-- Alters holdings for broker provenance + supersede reconciliation:
--   source        where the row came from (manual default; trading212/csv synced)
--   external_ref  broker-side id (T212 ticker / position id) for re-sync matching
--   connection_id the broker connection that owns a synced row (null for manual)
--   archived_at   soft-delete: a manual row superseded by a synced one, or a
--                 synced row whose position was sold/closed. Never hard-deleted.
--
-- IMPORTANT: income aggregation and the free-tier holding count MUST exclude
-- rows where archived_at is not null (wired in Segment 3).
--
-- Apply via Supabase Dashboard > SQL Editor or `npx supabase db push --linked`.

alter table public.holdings
  add column source text not null default 'manual'
    check (source in ('manual','trading212','csv')),
  add column external_ref text,
  add column connection_id uuid references public.broker_connections(id) on delete set null,
  add column archived_at timestamptz;

-- Most holdings reads are "this user's active rows"; a partial index keeps that
-- path tight as archived rows accumulate.
create index holdings_active_idx on public.holdings(user_id) where archived_at is null;
