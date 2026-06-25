-- 0022_welcome_wizard_dismissals.sql
-- One row per user means "do not show the welcome wizard". Existence = done.
-- Writes happen only from the server action with the service role.

create table public.welcome_wizard_dismissals (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  recorded_at  timestamptz not null default now(),
  reason       text not null check (reason in ('completed','dismissed','backfilled'))
);

alter table public.welcome_wizard_dismissals enable row level security;

create policy "welcome_wizard_dismissals_select_own"
  on public.welcome_wizard_dismissals for select
  using (auth.uid() = user_id);

-- No insert/update/delete policies. The server action writes via the
-- service role so we control the reason value end-to-end.

-- Backfill every existing auth.users row so the wizard appears only for
-- genuinely new signups after this migration applies.
insert into public.welcome_wizard_dismissals (user_id, reason)
select id, 'backfilled' from auth.users
on conflict (user_id) do nothing;

comment on table public.welcome_wizard_dismissals is
  'Records that the welcome wizard has been completed or explicitly dismissed for a user. Existence = do not show. Absence = show on next /app/* visit.';
comment on column public.welcome_wizard_dismissals.reason is
  'completed = user reached step 5 finish or pricing. dismissed = user chose Skip the tour or Don''t show this again. backfilled = predates the wizard.';
