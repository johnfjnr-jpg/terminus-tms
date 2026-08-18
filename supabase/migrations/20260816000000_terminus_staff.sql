-- Terminus TMS: Terminus staff reference table
--
-- Same category as industries/stage_definitions: a small, curated
-- reference list, not a business object with a lifecycle, so a real
-- dedicated table rather than a record_type. Follows that exact pattern -
-- dedicated table, migration-seeded, read-only from the API, no admin UI
-- (deferred the same way industries already documents).
--
-- Sources Terminus Lead, Commercial/Technical/Legal Authority on both
-- Test Bed and Opportunity (2026-08-16) - any of the 7 can be selected
-- for any of the 4 roles, no title-based restriction, a small team
-- doesn't map cleanly to one person per function.

create table if not exists public.terminus_staff (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null unique,
  title       text        not null,
  created_at  timestamptz not null default now()
);

comment on table public.terminus_staff is
  'Curated reference list of Terminus staff, sourced by Terminus Lead / '
  'Commercial / Technical / Legal Authority on Test Bed and Opportunity. '
  'Not a record_type - lookup data, same category as industries. Edited '
  'directly via Supabase''s own editor for now, same deferral as '
  'industries/stage_gate_rules admin config.';

alter table public.terminus_staff enable row level security;

create policy "terminus_staff_select" on public.terminus_staff
  for select using (auth.uid() is not null);

insert into public.terminus_staff (name, title) values
  ('Josh Ward', 'CEO'),
  ('Matous Kundrik', 'CTO'),
  ('John Fryatt', 'Head of Asia'),
  ('Neil Baynham', 'COS'),
  ('Brad Kerr', 'Head of Sales Asia'),
  ('Chris Diak', 'Head of Adjacent Markets'),
  ('Michael Quane', 'Head of Sales Americas')
on conflict (name) do nothing;
