-- 0023_scoring_lookup_audit.sql
-- Persistent counter for anonymous on-demand resilience scoring lookups. Each
-- successful anon compute writes a row; the rate-limit check counts rows in
-- the last 24h per IP. Signed-in users do not write here (their counter is
-- in-memory). Persistent so that cold starts don't reset the gate.
--
-- See app/api/scoring/[ticker]/compute/route.ts for the read/write callers and
-- planning/specs/2026-06-27-free-user-experience-glow-up-design.md section
-- "Tiered rate-limits" for the gating policy.

create table public.scoring_lookup_audit (
  id         uuid primary key default gen_random_uuid(),
  ip         text not null,
  ticker     text not null,
  scored_at  timestamptz not null default now()
);

create index idx_scoring_lookup_audit_ip_time
  on public.scoring_lookup_audit (ip, scored_at desc);

create index idx_scoring_lookup_audit_recent
  on public.scoring_lookup_audit (scored_at desc);

-- Insert via service role only; no policies => clients cannot read or write.
alter table public.scoring_lookup_audit enable row level security;

comment on table public.scoring_lookup_audit is
  'Per-IP audit of anonymous on-demand resilience score requests. Used by /api/scoring/[ticker]/compute to enforce the 2/IP/24h anon gate.';
