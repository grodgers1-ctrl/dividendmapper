-- Referral trials — generic grant-code system
-- Foundation migration for the no-card 7-day Pro trial that existing Pro
-- users can hand to a friend via a referral code. Deliberately generic
-- (see the `kind` discriminator on grant_codes) so future marketing trial
-- campaigns can reuse the same tables instead of forking a new schema.
--
-- Two tables, not one — unlike founding_member_codes (strictly 1-code-1-
-- redemption, redeemer columns live on the code row itself), grant_codes
-- supports max_redemptions > 1 for future campaign codes, so a redemption
-- needs its own table to allow many rows per code.
--
-- Apply via Supabase Dashboard > SQL Editor or `npx supabase db push --linked`.

-- =============================================================================
-- 1. grant_codes
--    One row per issued code. issuer_user_id is the Pro/Premium user who
--    generated a referral code to hand to a friend; null means the code was
--    issued by an admin/marketing campaign rather than a user referral.
--    kind discriminates the campaign type — extend the check list below as
--    new trial campaigns are added ('pro_referral' is the only kind at
--    launch).
-- =============================================================================
create table public.grant_codes (
  id                uuid primary key default gen_random_uuid(),
  kind              text not null check (kind in ('pro_referral')),
  code              text unique not null,              -- e.g. "GLENN-3K7QPA"
  issuer_user_id    uuid references auth.users(id) on delete set null,
  grants_tier       text not null check (grants_tier in ('pro','premium')),
  grants_days       integer not null check (grants_days > 0),
  max_redemptions   integer not null default 1 check (max_redemptions > 0),
  redemption_count  integer not null default 0 check (redemption_count >= 0),
  code_expires_at   timestamptz,
  created_at        timestamptz not null default now()
);

create index grant_codes_issuer_idx on public.grant_codes(issuer_user_id);

alter table public.grant_codes enable row level security;

create policy grant_codes_issuer_select
  on public.grant_codes for select
  using (auth.uid() = issuer_user_id);

-- No insert/update/delete client policies — service-role only, mirrors
-- founding_member_codes. Redemption itself goes through the
-- redeem_grant_code() security definer function below, not direct writes.

-- =============================================================================
-- 2. grant_redemptions
--    One row per successful redemption. Split out from grant_codes (rather
--    than a single redeemed_by_user_id column, as founding_member_codes
--    does) because a single grant_code can have max_redemptions > 1 for
--    future campaign codes — many users can redeem the same code.
-- =============================================================================
create table public.grant_redemptions (
  id                  uuid primary key default gen_random_uuid(),
  grant_code_id       uuid not null references public.grant_codes(id) on delete cascade,
  redeemed_by_user_id uuid not null references auth.users(id) on delete cascade,
  redeemed_at         timestamptz not null default now(),
  tier_expires_at     timestamptz not null
);

-- A single user can only redeem a given code once (even if max_redemptions
-- would otherwise allow the same code to be reused by others).
create unique index grant_redemptions_code_user_uniq
  on public.grant_redemptions(grant_code_id, redeemed_by_user_id);

-- Single-column index on the user FK (mirrors founding_member_codes indexing
-- member_user_id). The composite unique index above leads with grant_code_id,
-- so it can't serve per-user lookups — the app's one-trial-per-user guard and
-- the founder digest's "new trials" count both filter on redeemed_by_user_id.
create index grant_redemptions_user_idx
  on public.grant_redemptions(redeemed_by_user_id);

alter table public.grant_redemptions enable row level security;

create policy grant_redemptions_self_select
  on public.grant_redemptions for select
  using (auth.uid() = redeemed_by_user_id);

create policy grant_redemptions_issuer_select
  on public.grant_redemptions for select
  using (
    exists (
      select 1 from public.grant_codes gc
      where gc.id = grant_redemptions.grant_code_id
        and gc.issuer_user_id = auth.uid()
    )
  );

-- No client insert/update/delete policies — writes only happen inside
-- redeem_grant_code() below (security definer, bypasses RLS).

-- =============================================================================
-- 3. profiles.tier_source — allow 'trial'
--    The check constraint was defined inline (unnamed column-level check) in
--    0001_phase2_schema.sql line 20-21: `tier_source text not null default
--    'free' check (tier_source in ('free','stripe','founding_member'))`.
--    Postgres auto-names inline column checks as <table>_<column>_check, and
--    no later migration (0002-0030) touches, renames, or recreates this
--    constraint — confirmed by reading every migration file in order — so
--    profiles_tier_source_check is the correct live name.
--
--    NOTE FOR GLENN: this is destructive DDL (drop then re-add a CHECK
--    constraint). Please double-check the constraint name against the live
--    schema before running this migration, e.g.:
--      select conname from pg_constraint
--      where conrelid = 'public.profiles'::regclass and contype = 'c';
--    or via the Supabase dashboard (Database > Tables > profiles >
--    constraints). `drop constraint if exists` below is a no-op-safe guard
--    if the name is somehow already gone, but it will NOT save you if the
--    constraint exists under a different name — the add below would then
--    layer a second, redundant check rather than replacing the original.
-- =============================================================================
alter table public.profiles
  drop constraint if exists profiles_tier_source_check;

alter table public.profiles
  add constraint profiles_tier_source_check
    check (tier_source in ('free','stripe','founding_member','trial'));

-- =============================================================================
-- 4. redeem_grant_code(p_code, p_user_id) — security definer RPC
--    Called by the app layer (service-role or via RPC with the caller's own
--    uid as p_user_id) when a user submits a referral/campaign code. Uses
--    `select ... for update` to lock the grant_codes row for the duration of
--    the transaction, so two concurrent redemptions against a
--    near-exhausted code can't both pass the redemption_count check before
--    either commits (classic check-then-increment race).
--
--    Raises a distinct exception message per failure reason so the calling
--    code (app layer) can pattern-match on SQLERRM and return the right
--    user-facing copy:
--      grant_code_not_found  — no row for this code (case-insensitive)
--      grant_code_expired    — code_expires_at has passed
--      grant_code_exhausted  — redemption_count already at max_redemptions
--      grant_code_already_redeemed — this user already redeemed this code
--      profile_not_found     — no profiles row for p_user_id
--      profile_ineligible_tier — user is already stripe/founding_member; a
--                                trial would flip them to tier_source='trial'
--                                and the expire-trials cron would later
--                                downgrade a genuine paying customer
--
--    SECURITY: this function is security definer (runs as definer, bypasses
--    RLS) and takes a caller-supplied p_user_id, so it MUST NOT be callable
--    by anon/authenticated — otherwise any signed-in user could flip another
--    account to trial. EXECUTE is revoked from those roles at the end of this
--    file; it is only reachable via the service-role redemption route.
--
--    On success: inserts the grant_redemptions row, increments
--    grant_codes.redemption_count, upgrades the redeemer's profile
--    (tier/tier_source/tier_expires_at), and returns the computed
--    tier_expires_at.
-- =============================================================================
create or replace function public.redeem_grant_code(p_code text, p_user_id uuid)
returns table(tier_expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant_code   public.grant_codes%rowtype;
  v_tier_source  text;
  v_expires_at   timestamptz;
begin
  -- Lock the row for the duration of this transaction so concurrent
  -- redemptions against the same near-exhausted code can't race past the
  -- redemption_count check below.
  select *
    into v_grant_code
    from public.grant_codes
   where upper(code) = upper(p_code)
   for update;

  if not found then
    raise exception 'grant_code_not_found';
  end if;

  if v_grant_code.code_expires_at is not null
     and v_grant_code.code_expires_at <= now() then
    raise exception 'grant_code_expired';
  end if;

  if v_grant_code.redemption_count >= v_grant_code.max_redemptions then
    raise exception 'grant_code_exhausted';
  end if;

  if exists (
    select 1 from public.grant_redemptions
    where grant_code_id = v_grant_code.id
      and redeemed_by_user_id = p_user_id
  ) then
    raise exception 'grant_code_already_redeemed';
  end if;

  -- Guard the profile tier flip BEFORE any write, so an ineligible redemption
  -- wastes nothing (no grant_redemptions row, no redemption_count increment).
  -- A paying (stripe) or founding_member user must never be flipped to
  -- tier_source='trial' — the expire-trials cron would later downgrade a
  -- genuine paying customer. tier_source='trial' is deliberately NOT blocked
  -- here: repeat-trial is already prevented by the per-user unique index and
  -- the app-layer one-trial-ever check.
  select tier_source into v_tier_source
    from public.profiles
   where id = p_user_id;

  if v_tier_source is null then
    raise exception 'profile_not_found';
  end if;

  if v_tier_source in ('stripe','founding_member') then
    raise exception 'profile_ineligible_tier';
  end if;

  v_expires_at := now() + (v_grant_code.grants_days || ' days')::interval;

  insert into public.grant_redemptions (grant_code_id, redeemed_by_user_id, tier_expires_at)
  values (v_grant_code.id, p_user_id, v_expires_at);

  update public.grant_codes
     set redemption_count = redemption_count + 1
   where id = v_grant_code.id;

  update public.profiles
     set tier            = v_grant_code.grants_tier,
         tier_source      = 'trial',
         tier_expires_at  = v_expires_at
   where id = p_user_id;

  return query select v_expires_at;
end;
$$;

-- Service-role only. This function is security definer + takes a
-- caller-supplied p_user_id, so leaving it callable by anon/authenticated
-- (Supabase's default grant) would let any signed-in user flip an arbitrary
-- account to trial. Same intent as the "no client write policies" on the
-- tables above: redemption is reachable only via the service-role route.
--
-- MUST revoke from PUBLIC, not just anon/authenticated: CREATE FUNCTION grants
-- EXECUTE to PUBLIC by default, and anon/authenticated inherit it via PUBLIC
-- rather than a direct grant, so `revoke ... from anon, authenticated` alone is
-- a no-op (verified against the live proacl). Revoking PUBLIC removes it for
-- every client role while service_role keeps its own explicit Supabase grant.
revoke execute on function public.redeem_grant_code(text, uuid) from public;
revoke execute on function public.redeem_grant_code(text, uuid) from anon, authenticated;
