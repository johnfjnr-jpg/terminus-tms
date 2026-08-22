-- Terminus TMS: Closed Lost reason list, Round 21 Phase 6
--
-- Configuration only. Nothing writes to this table in this phase; the
-- lose-a-deal control that reads it arrives in Phase 7.
--
-- Same governance shape as industries, stage_definitions and
-- terminus_staff: a small curated list, admin-editable as rows, seeded by
-- migration, GET-only from the API, no admin UI, edited directly through
-- Supabase's own editor for now.
--
-- ONE FLAT LIST, NOT SCOPED BY STAGE. The stage a deal died at is recorded
-- separately, so reason against stage is a cross-tabulation rather than a
-- second configuration dimension. Scoping the list by stage would make the
-- same reason a different row at each stage and make "lost on price across
-- the whole pipeline" a query over six lists instead of one column.
--
-- NO "QUALIFIED OUT" ROW. OPPORTUNITY_DESIGN.md records that qualifying out
-- and losing are the same transition and different events, and that what
-- distinguishes them is the stage. A row saying "qualified out" would encode
-- the stage a second time, in the one field whose whole purpose is to say
-- something the stage does not.
--
-- ─────────────────────────────────────────────────────────────
-- HOW A STORED REASON WILL BE CONSTRAINED, decided here rather than when
-- the write path arrives.
-- ─────────────────────────────────────────────────────────────
--
-- A FOREIGN KEY, on a uuid, not a CHECK and not a text natural key.
--
-- Why constrained in the database at all: Phase 4 confirmed that
-- approvals.track is a foreign key to approval_tracks, so a track that does
-- not exist cannot be recorded by anything, and Round 20 put a CHECK on the
-- probability override for the same reason. A route-level check is correct
-- for every caller that exists and silent for the next one, which is the
-- failure this project has now recorded five times under one heading.
--
-- Why not a CHECK: a CHECK would write the ten reasons into the schema, so
-- adding an eleventh becomes a migration rather than a row. That contradicts
-- the standing rule that this kind of vocabulary lives as data, and it is
-- the reason Round 20 rejected a hardcoded terminal-stage exception in
-- favour of two columns.
--
-- Why a uuid rather than the label text: approvals.track references
-- approval_tracks(track_name) and that natural-key shape works, but a track
-- name is one word and a reason is a sentence the business will reword.
-- Round 19 found what a text reference costs when the referent is renamed:
-- the four staff fields hold a name, so a rename leaves every historical
-- record pointing at a string that resolves to nobody. A uuid lets the
-- wording change without touching a single closed deal.
--
-- `active` exists for the same reason. A reason that stops being offered
-- must not be deleted while closed deals still cite it, so retiring one is
-- a flag rather than a DELETE.

create table if not exists public.closed_lost_reasons (
  id          uuid        primary key default gen_random_uuid(),
  label       text        not null unique,
  sort_order  integer     not null,
  active      boolean     not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.closed_lost_reasons is
  'Curated reason list for Closed Lost. One flat list, not scoped by stage: '
  'the stage a deal died at is recorded separately, so reason against stage '
  'is a cross-tabulation rather than a second configuration dimension. '
  'Admin-managed as rows, same deferral as industries and stage_gate_rules.';

comment on column public.closed_lost_reasons.active is
  'False retires a reason from the picker without deleting it. A reason '
  'cited by a closed deal is never deleted: the deal would be left pointing '
  'at nothing.';

alter table public.closed_lost_reasons enable row level security;

create policy "closed_lost_reasons_select" on public.closed_lost_reasons
  for select using (auth.uid() is not null);

-- WHERE NOT EXISTS rather than ON CONFLICT, per Round 20 Phase 0. The unique
-- constraint on label would make ON CONFLICT work here, unlike the
-- stage_definitions case where every row has a null variant, but the guard
-- is written the same way throughout so that a replay is provably a no-op
-- rather than relying on which constraint happens to exist.
insert into public.closed_lost_reasons (label, sort_order)
select v.label, v.sort_order
from (values
  ('No bid, we chose not to pursue',  10),
  ('Lost on price',                   20),
  ('Lost on solution fit',            30),
  ('Lost to incumbent',               40),
  ('Not shortlisted',                 50),
  ('Client cancelled the project',    60),
  ('Budget not available',            70),
  ('Deferred by client',              80),
  ('No decision, went quiet',         90),
  ('Award withdrawn',                100)
) as v(label, sort_order)
where not exists (
  select 1 from public.closed_lost_reasons r where r.label = v.label
);
