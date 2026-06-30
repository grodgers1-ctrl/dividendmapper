-- 0030_etf_quality.sql
-- Phase 4 Task 4.2: Add Income Quality scoring columns to etf_facts.
-- Populated by the refresh-etf-cache cron after computeEtfQuality runs.
alter table public.etf_facts
  add column if not exists quality_headline integer,
  add column if not exists quality_cost     integer,
  add column if not exists quality_process  integer,
  add column if not exists quality_income   integer;
