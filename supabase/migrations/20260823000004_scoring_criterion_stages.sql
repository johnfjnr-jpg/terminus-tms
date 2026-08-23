-- Terminus TMS: visibility, separated from requirement. Round 24 Phase 5.
--
-- Until now a criterion appeared on a stage IF AND ONLY IF a gate rule there
-- named it. Visibility and requirement were the same fact, which is why the
-- Deal assessment cannot be expressed: its criteria must display and be
-- scoreable at stages they do not block.
--
-- This table is the visibility source. Gating is UNCHANGED and stays in
-- stage_gate_rules: Test Bed's per-criterion payload_field_required rows are
-- not touched by this migration, so nothing that gates today stops gating.
--
-- WHY NOT record_type ON THIS TABLE, which the Phase 0 sizing proposed. It is
-- functionally dependent on criterion_id: scoring_criteria is UNIQUE on
-- (record_type, criterion_key), so a criterion belongs to exactly one record
-- type. Carrying it again would allow a row whose record_type disagreed with
-- its own criterion's, which is a class of bug that cannot exist if the column
-- does not.
--
-- WHY A `required` FLAG, settled with the rows in front of us rather than
-- assumed. Two facts make visible and required different:
--
--   * A criterion required at Qualification must still be VISIBLE at Solution
--     Alignment, because the rollup gate there wants an entry dated at or
--     after entry to Solution Alignment, so it has to be re-scoreable at a
--     stage where it is not itself introduced.
--   * Qualification carries seven Deal criteria and no assessment exit
--     criterion above them, so being required at a stage is not the same as
--     blocking exit from it.
--
-- So `required` marks the stage a criterion is answerable FOR, and visibility
-- marks the stages it can be answered AT. Phase 6's rollup reads the first;
-- the panel reads the second.
--
-- EXPLICIT PAIRS RATHER THAN "FROM THIS STAGE ONWARD", which would be fewer
-- rows and cannot represent Test Bed. scorePhysicalSuitability shows at
-- Qualification and at Site Assessment and NOT at Pre-Site Assessment between
-- them, so visibility is a set of stages and not a threshold.
--
-- Written idempotently per Architecture rule 7.

create table if not exists public.scoring_criterion_stages (
  id           uuid        primary key default gen_random_uuid(),
  criterion_id uuid        not null references public.scoring_criteria(id) on delete restrict,
  stage        text        not null,
  required     boolean     not null default true,
  created_at   timestamptz not null default now(),
  unique (criterion_id, stage)
);

comment on table public.scoring_criterion_stages is
  'Which stages a criterion is shown and scoreable at. The visibility source '
  'for the scoring panel, replacing "a gate rule at this stage names it". '
  'Gating itself is unchanged and stays in stage_gate_rules. `required` marks '
  'the stage a criterion is answerable FOR, which is not the same as the '
  'stages it can be answered AT: a Qualification criterion stays visible at '
  'later stages so it can be re-scored for their completeness gates. No '
  'record_type column: it is functionally dependent on criterion_id.';

create index if not exists scoring_criterion_stages_stage_idx
  on public.scoring_criterion_stages (stage);

alter table public.scoring_criterion_stages enable row level security;

drop policy if exists "scoring_criterion_stages_select" on public.scoring_criterion_stages;
create policy "scoring_criterion_stages_select" on public.scoring_criterion_stages
  for select using (true);

-- ---------------------------------------------------------------------------
-- Populate from the rules that drive visibility today
-- ---------------------------------------------------------------------------
--
-- DERIVED FROM stage_gate_rules RATHER THAN LISTED BY HAND, so the new source
-- provably carries the same set the old one did. A hand-written list would be
-- my reading of the nine pairs; this is the pairs themselves.
--
-- required defaults to true and is correct for every one of these: they are
-- all gate rules today, so each is a criterion the record genuinely must
-- answer at that stage.
--
-- measurabilityConfirmed is deliberately absent. It is not a scoring_criteria
-- row, so it has no criterion_id to reference, and its visibility keeps coming
-- from its gate rule exactly as before.
insert into public.scoring_criterion_stages (criterion_id, stage, required)
select distinct c.id, r.from_stage, true
from public.stage_gate_rules r
join public.scoring_criteria c
  on c.record_type = r.record_type
 and c.criterion_key = r.requirement_detail->>'field'
where r.requirement_type = 'payload_field_required'
  and not exists (
    select 1 from public.scoring_criterion_stages s
    where s.criterion_id = c.id and s.stage = r.from_stage
  );
