-- Phase 2 Day 1 schema migration
-- Adds: profiles, holdings, subscriptions, founding_member_codes,
--       founding_member_emails (lookup), + RLS policies + auto-provisioning
--       trigger on auth.users insert + updated_at triggers.
--
-- Apply via Supabase Dashboard > SQL Editor (or psql with the project URI).
-- All statements are idempotent-friendly within a single transaction; re-running
-- on a clean schema is fine, re-running on an applied schema will fail loudly
-- on the first duplicate-object error (intentional — don't silently re-run).

-- =============================================================================
-- 1. profiles
--    Mirrors auth.users. Owns tier + billing state.
-- =============================================================================
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text not null,
  tier                text not null default 'free'
                        check (tier in ('free','pro','premium')),
  tier_source         text not null default 'free'
                        check (tier_source in ('free','stripe','founding_member')),
  tier_expires_at     timestamptz,
  stripe_customer_id  text unique,
  founding_member     boolean not null default false,
  created_at          timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy profiles_self_select
  on public.profiles for select
  using (auth.uid() = id);

create policy profiles_self_update
  on public.profiles for update
  using (auth.uid() = id);

-- No INSERT policy: profile rows are created by handle_new_user() trigger only.

-- =============================================================================
-- 2. holdings
--    One holding = one row. Wrapper is part of the row, so the same ticker
--    held in two wrappers is two rows.
-- =============================================================================
create table public.holdings (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  ticker          text not null,                       -- raw, e.g. "ULVR.L"
  ticker_market   text,                                -- normalised, nullable while we resolve
  quantity        numeric(18,6) not null check (quantity > 0),
  avg_cost        numeric(18,4) not null check (avg_cost >= 0),
  cost_currency   text not null check (length(cost_currency) = 3),
  wrapper         text not null
                    check (wrapper in ('isa','sipp','gia','401k','ira','roth_ira','brokerage')),
  broker_label    text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index holdings_user_id_idx on public.holdings(user_id);

alter table public.holdings enable row level security;

create policy holdings_self_all
  on public.holdings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================================
-- 3. subscriptions
--    Stripe-side state mirrored locally. The webhook is the only writer
--    (via service-role key, bypassing RLS). Users read their own row.
-- =============================================================================
create table public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null unique references auth.users(id) on delete cascade,
  stripe_subscription_id text unique not null,
  stripe_price_id        text not null,
  tier                   text not null check (tier in ('pro','premium')),
  billing_period         text not null check (billing_period in ('monthly','annual')),
  status                 text not null,
  current_period_end     timestamptz not null,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy subscriptions_self_select
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- No client INSERT/UPDATE/DELETE policies: writes go via service-role.

-- =============================================================================
-- 4. founding_member_codes
--    Three rows per founding member at provision time. Mirrors Stripe
--    promotion codes generated against the founding_member_50_off_pro_6mo
--    coupon. redeemed_by_user_id is set when someone redeems the code.
-- =============================================================================
create table public.founding_member_codes (
  id                       uuid primary key default gen_random_uuid(),
  member_user_id           uuid not null references auth.users(id) on delete cascade,
  stripe_promotion_code_id text unique not null,
  code                     text unique not null,              -- e.g. "GLENN-3K7QPA"
  redeemed_by_user_id      uuid references auth.users(id) on delete set null,
  redeemed_at              timestamptz,
  created_at               timestamptz not null default now()
);

create index founding_member_codes_member_idx
  on public.founding_member_codes(member_user_id);

alter table public.founding_member_codes enable row level security;

create policy founding_member_codes_self_select
  on public.founding_member_codes for select
  using (auth.uid() = member_user_id);

-- =============================================================================
-- 5. founding_member_emails
--    Curated list of ~16 confirmed founding members. handle_new_user() checks
--    this table on auth.users insert and upgrades matching profiles.
--    Populated manually (Day 11) via the Supabase SQL editor or service-role.
-- =============================================================================
create table public.founding_member_emails (
  email     text primary key,                  -- lowercased on insert
  added_at  timestamptz not null default now()
);

alter table public.founding_member_emails enable row level security;

-- No client policies: staff-managed via service-role only.

-- =============================================================================
-- 6. handle_new_user() — auto-provisioning trigger
--    Fires after every auth.users insert. Creates the corresponding profiles
--    row. If the email matches a curated founding member, sets tier='pro',
--    tier_source='founding_member', founding_member=true. tier_expires_at is
--    intentionally left NULL — the launch-day script sets it for all founding
--    members in one shot, so we can change the launch date without editing
--    this trigger.
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_founder boolean;
begin
  select exists (
    select 1 from public.founding_member_emails
    where email = lower(NEW.email)
  ) into is_founder;

  if is_founder then
    insert into public.profiles (id, email, tier, tier_source, founding_member)
    values (NEW.id, NEW.email, 'pro', 'founding_member', true);
  else
    insert into public.profiles (id, email)
    values (NEW.id, NEW.email);
  end if;

  return NEW;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- 7. set_updated_at() — generic before-update trigger
-- =============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

create trigger holdings_set_updated_at
  before update on public.holdings
  for each row execute function public.set_updated_at();

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();
