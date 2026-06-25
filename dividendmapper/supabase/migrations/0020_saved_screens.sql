-- Income vehicles hub Day 5: saved-screen storage.
-- Pro members save filter combinations and a name; the in-app hub renders
-- the list in a left rail. One row per saved screen. RLS keeps each user's
-- screens private to their own auth.uid().

create table public.saved_screens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 80),
  filter_state jsonb not null,
  created_at   timestamptz not null default now()
);

create index saved_screens_user_id_idx on public.saved_screens (user_id, created_at desc);

alter table public.saved_screens enable row level security;

create policy "saved_screens_select_own"
  on public.saved_screens for select
  using (auth.uid() = user_id);

create policy "saved_screens_insert_own"
  on public.saved_screens for insert
  with check (auth.uid() = user_id);

create policy "saved_screens_delete_own"
  on public.saved_screens for delete
  using (auth.uid() = user_id);
