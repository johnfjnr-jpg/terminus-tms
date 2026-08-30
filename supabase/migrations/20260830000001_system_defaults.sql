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
--
-- ── WHAT THE ABSENT WRITE POLICY DOES AND DOES NOT CONTROL ──────────────────
--
-- It controls AUTHENTICATED CLIENTS. It does not control the service role,
-- which bypasses RLS entirely, so a select-only policy is not an enforcement
-- against a server-side write.
--
-- What controls a server-side write today is that NO ROUTE PERFORMS ONE, and
-- that rests on a measured property of this codebase rather than on a policy:
-- `supabaseAdmin` is imported by ZERO routes, every route builds its client
-- through `createUserClient(request.jwt)` and runs as the authenticated user,
-- so a route written against this table gets 42501 rather than quietly working.
-- Re-measured 2026-08-30; the claim was first established in Round 36 Phase 2
-- and is recorded in DESIGN_PRINCIPLES.md, which also names the residual risk.
--
-- WHEN THE ADMIN SURFACE IS BUILT, ITS AUTHORIZATION LIVES IN THE ROUTE. Adding
-- a write policy here would not authorize anything the service role could not
-- already do, and reading this comment as "RLS protects the defaults" is the
-- fail-open this wording exists to prevent.
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
