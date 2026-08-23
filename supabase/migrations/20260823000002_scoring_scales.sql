-- Terminus TMS: scales, levels as data. Round 24 Phase 2, 2026-08-23.
--
-- A criterion is scored against an ORDERED SET OF LEVELS. Until now that set
-- was the literal [1,2,3,4,5], written twice in the frontend and once more as
-- a range check on the server, so a criterion with a different number of
-- levels could not be expressed at all.
--
-- WHY A SHARED SCALE rather than levels hanging off each criterion. The Deal
-- assessment's five-level scale is the SAME five levels for every criterion
-- that uses it, and there are more than twenty of them. Levels per criterion
-- would be that set copied twenty times, which is twenty places for the
-- wording to drift and no way to change it once. A scale is named, defined
-- once, and pointed at.
--
-- WHY scale_id IS NULLABLE, AND WHAT NULL MEANS. Null means the legacy 1 to 5.
--
-- This is the load-bearing decision of the phase and it is deliberately NOT
-- "migrate every existing row to point at a Test Bed scale". The requirement
-- is that the default holds BY CONSTRUCTION rather than by having visited
-- every row: a criterion created next year with no scale must behave exactly
-- as today's five do, and a migration that fixed up the rows existing on
-- 2026-08-23 would not give that. Null is the absence of an opinion, and the
-- default is resolved in ONE place, server-side, where the API builds its
-- response.
--
-- ANCHORS REMAIN 1 TO 5 AND THIS TABLE DOES NOT CONSTRAIN value TO MATCH.
-- scoring_anchors.score carries check (score between 1 and 5), so a scale
-- using values outside that range can exist here and cannot carry anchor
-- wording. That limit is recorded rather than encoded: adding a second 1..5
-- check here would make the constraint harder to lift later while pretending
-- it had been considered. Both scales seeded below sit inside 1..5.
--
-- Written idempotently per Architecture rule 7.

-- ---------------------------------------------------------------------------
-- scoring_scales
-- ---------------------------------------------------------------------------
create table if not exists public.scoring_scales (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null unique,
  created_at timestamptz not null default now()
);

comment on table public.scoring_scales is
  'A named, ordered set of levels a criterion is scored against. Referenced by '
  'scoring_criteria.scale_id, which is NULLABLE: null means the legacy 1 to 5 '
  'with the level number as its own label, resolved server-side so the default '
  'holds for any criterion without a scale, including ones created later. '
  'Levels are shared rather than per-criterion because the Deal assessment '
  'uses one set of five for every criterion that carries it.';

alter table public.scoring_scales enable row level security;

drop policy if exists "scoring_scales_select" on public.scoring_scales;
create policy "scoring_scales_select" on public.scoring_scales
  for select using (true);

-- ---------------------------------------------------------------------------
-- scoring_scale_levels
-- ---------------------------------------------------------------------------
create table if not exists public.scoring_scale_levels (
  id         uuid        primary key default gen_random_uuid(),
  scale_id   uuid        not null references public.scoring_scales(id) on delete restrict,
  value      int         not null,
  label      text        not null,
  created_at timestamptz not null default now(),
  unique (scale_id, value)
);

comment on table public.scoring_scale_levels is
  'One row per level of a scale. `value` is the number stored on a score '
  'entry and is what scoring_anchors.score joins to for wording. `label` is '
  'what the scorer reads. Ordered by value, which is meaningful: these scales '
  'are ordinal, and the order is the point.';

create index if not exists scoring_scale_levels_scale_idx
  on public.scoring_scale_levels (scale_id, value);

alter table public.scoring_scale_levels enable row level security;

drop policy if exists "scoring_scale_levels_select" on public.scoring_scale_levels;
create policy "scoring_scale_levels_select" on public.scoring_scale_levels
  for select using (true);

-- ---------------------------------------------------------------------------
-- scoring_criteria.scale_id
-- ---------------------------------------------------------------------------
alter table public.scoring_criteria
  add column if not exists scale_id uuid references public.scoring_scales(id) on delete restrict;

comment on column public.scoring_criteria.scale_id is
  'The scale this criterion is scored against. NULL means the legacy 1 to 5, '
  'which is every criterion that exists today and any created without one.';

create index if not exists scoring_criteria_scale_idx
  on public.scoring_criteria (scale_id);

-- ---------------------------------------------------------------------------
-- Seed: the two scales the Deal assessment needs
-- ---------------------------------------------------------------------------
--
-- Seeded here and pointed at by NOTHING yet. Round 24 Phase 2 builds the
-- mechanism; the criteria that use these arrive in a later round.
--
-- They are seeded now rather than later for one reason: Architecture rule 8.
-- A branch nothing exercises is where the fault hides, and "resolve the levels
-- from a scale" is a branch that would otherwise ship with every caller taking
-- the null path. With these rows present the non-null path is exercisable
-- today, against real data, rather than first being exercised by the round
-- that depends on it.
--
-- WORDING IS THE BUSINESS'S, from the design conversation, and every level
-- carries exactly one condition. That is the property the Test Bed anchors
-- lack, where a 5 averages several conditions joined by an implicit AND.
insert into public.scoring_scales (name)
select v.name
from (values
  ('Deal evidence, five level'),
  ('Binary confirmation')
) as v(name)
where not exists (
  select 1 from public.scoring_scales s where s.name = v.name
);

insert into public.scoring_scale_levels (scale_id, value, label)
select s.id, v.value, v.label
from (values
  ('Deal evidence, five level', 1, 'Not applicable'),
  ('Deal evidence, five level', 2, 'Unknown'),
  ('Deal evidence, five level', 3, 'Our hypothesis'),
  ('Deal evidence, five level', 4, 'Buyer confirmed'),
  ('Deal evidence, five level', 5, 'Verified'),
  ('Binary confirmation', 1, 'Not confirmed'),
  ('Binary confirmation', 2, 'Confirmed')
) as v(scale_name, value, label)
join public.scoring_scales s on s.name = v.scale_name
where not exists (
  select 1 from public.scoring_scale_levels l
  where l.scale_id = s.id and l.value = v.value
);
