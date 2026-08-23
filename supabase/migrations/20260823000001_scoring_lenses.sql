-- Terminus TMS: the lens vocabulary. Round 24 Phase 1, 2026-08-23.
--
-- A lens is the grouping a Deal assessment criterion is read under:
-- Commercial, Organisational, Technical, Legal. It exists so criteria can be
-- organised for reading, and so "which criteria has this lens" is answerable
-- from data rather than from a list held in the frontend.
--
-- WHY THIS EXISTS AT ALL, since nothing consumes it yet. Round 24 Phase 0
-- searched for any representation of a lens and found none: zero matches in
-- migrations, src and frontend, against a calibration of `track`, which
-- appears in six src files. Two separate pieces of the design dead-end
-- without it. Criteria cannot be grouped for the four sub-tabs, and "approved
-- this lens with unanswered criteria" cannot be evaluated, because there is
-- nothing to resolve "this lens" against. A vocabulary introduced late is one
-- that gets encoded twice in the meantime.
--
-- WHY A DEDICATED TABLE rather than a text column on scoring_criteria. Same
-- category as approval_tracks and industries: admin-managed lookup data with
-- no lifecycle. A text column would let a typo create a fifth lens silently,
-- and the four sub-tabs would then render five.
--
-- LENSES AND APPROVAL TRACKS ARE NOT THE SAME VOCABULARY and this table does
-- not try to join them. Three of the four names coincide with three of the
-- six approval_tracks rows; Organisational has no approver and is not a track.
-- Confirmed with the business: all three approvers see all four lenses, so
-- the lens organises reading and never ownership. There is deliberately no
-- foreign key between the two, because a join would assert a correspondence
-- that does not exist.
--
-- Governance follows scoring_criteria, which is the table this attaches to:
-- RLS on, select-only for authenticated users, no write policy, admin-edited
-- directly for now. Rows live here rather than in supabase/seeds, matching
-- scoring_model.sql, which states that a seed copy is a second home for the
-- same data with a real chance of drift. No seed file references scoring at
-- all, checked before writing this.
--
-- Written idempotently per Architecture rule 7, following scoring_model.sql's
-- WHERE NOT EXISTS rather than industries' ON CONFLICT: the ledger has been
-- observed drifting from the schema, so a replayed migration must not
-- duplicate rows.

-- ---------------------------------------------------------------------------
-- scoring_lenses: the lens vocabulary
-- ---------------------------------------------------------------------------
create table if not exists public.scoring_lenses (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null unique,
  sort_order int         not null,
  created_at timestamptz not null default now()
);

comment on table public.scoring_lenses is
  'The lens vocabulary: the grouping a Deal assessment criterion is read '
  'under. Referenced by scoring_criteria.lens_id, which is NULLABLE because '
  'Test Bed''s five criteria are a different instrument and have no lens. '
  'sort_order is the order the lens sub-tabs render in. Deliberately NOT '
  'joined to approval_tracks: three of these four names coincide with three '
  'of that table''s six rows, Organisational has no approver, and all three '
  'approvers see all four lenses, so a lens organises reading and never '
  'ownership.';

alter table public.scoring_lenses enable row level security;

drop policy if exists "scoring_lenses_select" on public.scoring_lenses;
create policy "scoring_lenses_select" on public.scoring_lenses
  for select using (true);

insert into public.scoring_lenses (name, sort_order)
select v.name, v.sort_order
from (values
  ('Commercial', 10),
  ('Organisational', 20),
  ('Technical', 30),
  ('Legal', 40)
) as v(name, sort_order)
where not exists (
  select 1 from public.scoring_lenses l where l.name = v.name
);

-- ---------------------------------------------------------------------------
-- scoring_criteria.lens_id
-- ---------------------------------------------------------------------------
--
-- NULLABLE, and that is the load-bearing part of this phase.
--
-- Test Bed's five criteria belong to the Test Bed qualification instrument,
-- not to the Deal assessment, and they have no lens. A NOT NULL column would
-- have to invent one for each of them, which is inventing vocabulary to
-- satisfy a constraint. Round 24's hardest standing constraint is that Test
-- Bed behaviour must not change at all, and five rows silently acquiring a
-- grouping they do not have is a change even if nothing renders it yet.
--
-- on delete restrict, matching scoring_anchors' reference to
-- scoring_criteria: a lens with criteria pointing at it cannot be deleted out
-- from under them.
alter table public.scoring_criteria
  add column if not exists lens_id uuid references public.scoring_lenses(id) on delete restrict;

comment on column public.scoring_criteria.lens_id is
  'The lens this criterion is read under. NULL for Test Bed''s criteria, '
  'which are a different instrument and have no lens.';

create index if not exists scoring_criteria_lens_idx
  on public.scoring_criteria (lens_id);
