-- Phase 3 Segment 1 schema migration
-- Adds: broker_connections (user-visible sync status, RLS self)
--       broker_credentials (encrypted T212 key:secret, service-role only)
-- For Trading 212 Invest/ISA auto-sync. Two tables so the user-readable status
-- row never carries the secret. Designed with Phase 6 tax reports in mind.
--
-- Apply via Supabase Dashboard > SQL Editor or `npx supabase db push --linked`.

-- =============================================================================
-- broker_connections
--   One row per (user, provider) link. Holds the status the USER may see.
--   The credential itself lives in broker_credentials (service-role only).
-- =============================================================================
create table public.broker_connections (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  provider          text not null default 'trading212'
                      check (provider in ('trading212')),
  status            text not null default 'active'
                      check (status in ('active','error','revoked')),
  last_synced_at    timestamptz,
  last_sync_status  text,
  last_sync_error   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, provider)
);

create index broker_connections_user_id_idx on public.broker_connections(user_id);

alter table public.broker_connections enable row level security;

create policy broker_connections_self_all
  on public.broker_connections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger broker_connections_set_updated_at
  before update on public.broker_connections
  for each row execute function public.set_updated_at();

-- =============================================================================
-- broker_credentials
--   The SECRET. AES-256-GCM ciphertext of the T212 "key:secret" pair, one row
--   per connection. NO client RLS policy — service-role only (mirrors the
--   sent_emails precedent). The client never selects this table; the encryption
--   key (BROKER_ENCRYPTION_KEY) lives in app env, so the DB never sees plaintext.
-- =============================================================================
create table public.broker_credentials (
  connection_id  uuid primary key references public.broker_connections(id) on delete cascade,
  ciphertext     text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.broker_credentials enable row level security;

-- No client policies. Read/written via service-role only; never exposed to RLS.

create trigger broker_credentials_set_updated_at
  before update on public.broker_credentials
  for each row execute function public.set_updated_at();
