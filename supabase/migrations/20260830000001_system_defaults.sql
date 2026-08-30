-- Admin-configurable defaults, applied at record creation. Round 41 item 1.
--
-- ── WHAT THIS IS AND IS NOT ─────────────────────────────────────────────────
--
-- CLAUDE.md Architecture 11: a default is an INITIAL VALUE, written into the
-- field when the deal is created and never consulted again. It is not a
-- fallback applied at read or at save.
--
-- So this table is the SOURCE of that initial value. It is read once, at
-- creation, and the value it supplies is written into the record's payload
-- where it becomes an ordinary recorded figure that a person can see, change,
-- or clear. Clearing it leaves the field empty and the sheet says the value is
-- not recorded; the default does not quietly reappear.
--
-- NUMERIC_DEFAULTS in src/lib/numeric-payload.js stays for now and is NOT this.
-- It is a read-time fallback that 340 to 574 existing records rely on per key,
-- measured. Removing it is a separate decision with its own blast radius and it
-- is reported rather than taken here.
--
-- ── WHY A TABLE RATHER THAN A CONSTANT ──────────────────────────────────────
--
-- "Admin-configured" is the requirement. A constant needs a deploy to change,
-- and this project has no deployment, so a constant would mean the business
-- cannot change a default at all. A row can be changed by an admin and carries
-- who changed it and when, which is what makes an override "recorded and
-- attributed" rather than merely different.
create table if not exists public.system_defaults (
  key           text primary key,
  value         numeric not null,
  -- Free text, not an enum: what a default is FOR is prose, and an enum here
  -- would be a second list to keep in step with the keys.
  note          text,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id)
);

comment on table public.system_defaults is
  'Initial values written into a deal at creation. Architecture 11: not a read-time fallback.';

alter table public.system_defaults enable row level security;

-- Readable by any authenticated user, because every deal creation reads it.
-- Writable by nobody through PostgREST: changing a default is an admin act and
-- there is no admin surface yet, so the absence of a write policy is the
-- control rather than an oversight.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'system_defaults' and policyname = 'system_defaults_select'
  ) then
    create policy system_defaults_select on public.system_defaults
      for select to authenticated using (true);
  end if;
end $$;

-- Seeded from the values NUMERIC_DEFAULTS already holds, so this change moves
-- WHERE a default is applied without moving WHAT it is. A deal created after
-- this migration prices identically to one created before it; the difference is
-- that the new one carries the numbers in its own payload and can clear them.
insert into public.system_defaults (key, value, note) values
  ('targetMargin',   30,  'Margin on price, seeded into every pricing line at creation.'),
  ('warrantyPct',     2,  'Replacement unit provision, applied across total units.'),
  ('duration',       36,  'Contract term in months.'),
  ('recoveryMonths', 12,  'Two-phase hardware recovery period, in months. Must be <= duration.'),
  ('factoringTermMonths', 12, 'Hybrid factoring term. Two-phase follows the recovery period.')
on conflict (key) do nothing;

-- ── THE LEDGER ROW, IN THE SAME FILE. Architecture 10 ───────────────────────
--
-- Applying SQL through the Supabase dashboard does not write to
-- supabase_migrations.schema_migrations, so by-hand application leaves the
-- schema and the ledger disagreeing. One paste, two statements. Safe under both
-- paths: by hand this records what the dashboard will not, and under
-- `supabase db push` the CLI writes the row itself and the ON CONFLICT makes
-- this a no-op.
insert into supabase_migrations.schema_migrations (version)
values ('20260830000001')
on conflict (version) do nothing;
