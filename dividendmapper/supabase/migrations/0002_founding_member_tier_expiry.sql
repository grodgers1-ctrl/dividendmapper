-- Phase 2 Day 6 — founding-member tier expiry backfill
--
-- handle_new_user() in 0001 leaves tier_expires_at NULL at provision time.
-- The schema comment said "the launch-day script sets it for all founding
-- members in one shot" — this is that script.
--
-- Anchor date: 2026-11-25T00:00:00Z (public launch 2026-05-25 + 6 months,
-- per the founding-member offer in planning/05-phase2-sprint.md L68).
--
-- Idempotent: re-running on already-populated rows is a no-op (the
-- IS NULL guard skips them).

update public.profiles
set    tier_expires_at = '2026-11-25T00:00:00Z'
where  founding_member = true
  and  tier_expires_at is null;
