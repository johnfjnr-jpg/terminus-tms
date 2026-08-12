-- Terminus TMS: Industries reference table
--
-- Standalone table, not folded into Contact or Account payloads, since
-- Section 7's future Taxonomy extends it with classification and use_case
-- tables referencing industry_id. short_code is the 6-character segment
-- the Section 9 reference-code generator will use (not yet built).
--
-- This is lookup data, not a business object with a lifecycle, so it's a
-- real dedicated table rather than a record_type - same category as
-- approval_tracks, not the generic records/record_revisions pattern.

create table if not exists public.industries (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null unique,
  short_code  text        not null unique,
  created_at  timestamptz not null default now()
);

comment on table public.industries is
  'Admin-managed reference list of industries, referenced by records.industry_id '
  '(Account and Contact today). Not a record_type - lookup data, same category '
  'as approval_tracks, not a business object with a lifecycle.';

alter table public.industries enable row level security;

create policy "industries_select" on public.industries
  for select using (auth.uid() is not null);

insert into public.industries (name, short_code) values
  ('Smart City', 'SMARTC'),
  ('Education & Campus', 'EDUCAM'),
  ('Healthcare & Hospitals', 'HEALTH'),
  ('Logistics and Distribution', 'LOGIST'),
  ('Manufacturing and Industrial', 'MANUFI'),
  ('Stadiums, Venues and Events', 'VENUES'),
  ('Airports', 'AIRPRT'),
  ('Rail and Public Transport', 'RAILPT'),
  ('Ports and Maritime', 'PORTMA'),
  ('Retail and Shopping Centre', 'RETAIL'),
  ('Energy & Utilities', 'ENERGY'),
  ('Defence & Military', 'DEFENC'),
  ('Prisons and Secure Facilities', 'PRISON'),
  ('Environment Agency', 'ENVAGY')
on conflict (name) do nothing;
