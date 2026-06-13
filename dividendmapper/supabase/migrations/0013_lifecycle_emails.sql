-- Lifecycle email program: per-user unsubscribe flag for non-transactional sends.
-- Transactional emails (welcome_free, activation_nudge) ignore this flag.
-- Marketing emails (score_explainer, pro_pitch_1, monthly_recap, pro_pitch_final)
-- honour it. The unsubscribe route flips this column to true.

alter table public.profiles
  add column lifecycle_emails_unsubscribed boolean not null default false;
