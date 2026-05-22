-- Phase 2 Day 11 schema migration
-- Adds: sent_emails (audit table for idempotent transactional sends)
--       founding_member_codes.redeemed_by_email (column captured at redemption
--       time so the account page can render "Redeemed by j****@..." without
--       a service-role JOIN against auth.users).
--
-- Apply via Supabase Dashboard > SQL Editor or `npx supabase db push --linked`.

-- =============================================================================
-- sent_emails
--   One row per successfully-delivered transactional email. send_key is the
--   idempotency token (e.g. welcome_paid_<subscription_id>); a unique index
--   means a retry with the same key fails fast and we don't double-send.
-- =============================================================================
create table public.sent_emails (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  send_key    text not null unique,
  template    text not null,
  sent_at     timestamptz not null default now()
);

create index sent_emails_user_id_idx on public.sent_emails(user_id);

alter table public.sent_emails enable row level security;

-- No client policies. Writes via service-role only; the table is audit-only.

-- =============================================================================
-- founding_member_codes.redeemed_by_email
--   Set by the webhook when a non-member redeems a founding-member code at
--   Stripe Checkout. Storing it at write time avoids a service-role JOIN at
--   render time (which would require bypassing RLS to read auth.users.email
--   for the redeemer).
-- =============================================================================
alter table public.founding_member_codes
  add column redeemed_by_email text;
