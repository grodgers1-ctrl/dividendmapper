create table if not exists public.inspect_lookup_audit (
  id          uuid         primary key default gen_random_uuid(),
  ip_hash     text         not null,
  user_id     uuid         null references auth.users(id) on delete cascade,
  ticker      text         not null,
  cache_hit   boolean      not null,
  occurred_at timestamptz  not null default now()
);

create index if not exists inspect_lookup_audit_ip_recent_idx
  on public.inspect_lookup_audit (ip_hash, occurred_at desc);
create index if not exists inspect_lookup_audit_user_recent_idx
  on public.inspect_lookup_audit (user_id, occurred_at desc);
