-- Terminus TMS: the scoring model as data. Round 11 Phase 1, 2026-08-19.
--
-- This is the first mechanism in the system that captures JUDGEMENT rather
-- than fact. Everything built so far records what happened; a score records
-- what someone thought, why, and when they changed their mind.
--
-- WHY TWO NEW TABLES, checked against every existing table before creating
-- either, per the standing rule that a phase appearing to need a new table
-- stops and reports first:
--
--   * NOT stage_gate_rules.requirement_detail. That table's rows carry real
--     enforcement semantics, and the standing rule from stage_reference_docs
--     is explicit: informational, non-gating content gets its own table,
--     never layered onto stage_gate_rules "just for display". Anchor wording
--     is the purest informational content in this system.
--   * NOT records/record_revisions. A criterion is admin-managed vocabulary
--     with no lifecycle, the same category as industries and
--     approval_tracks. Six existing reference tables set that precedent. A
--     new record_type would also need real stage_definitions rows before its
--     transitions worked at all, which is forcing a lifecycle onto a list.
--   * NOT an existing reference table. Widening one to carry criteria makes
--     it two vocabularies in one table.
--
-- Governance follows industries / approval_tracks / stage_reference_docs:
-- RLS on, select-only for authenticated users, no write policy, admin-edited
-- directly for now. Rows live HERE and deliberately not in
-- supabase/seeds/003_test_bed.sql - Round 9 Phase 2 established that the
-- Test Bed document catalogue lives entirely in migrations, and a seed copy
-- would be a second home for the same data with a real chance of drift.
--
-- Written idempotently throughout per Architecture rule 7, whatever the
-- migration ledger is expected to guarantee: the ledger has been observed
-- drifting from the schema silently, and an unguarded INSERT duplicates rows
-- invisibly. Note that stage_reference_docs.sql, whose governance this
-- follows, is itself not idempotent; the current rule is followed here
-- rather than that file's precedent.

-- ---------------------------------------------------------------------------
-- scoring_criteria: the criterion vocabulary
-- ---------------------------------------------------------------------------
create table if not exists public.scoring_criteria (
  id                    uuid primary key default gen_random_uuid(),
  record_type           text not null,
  criterion_key         text not null,
  name                  text not null,
  asks                  text,
  sort_order            int  not null,
  rescore_through_stage text,
  created_at            timestamptz not null default now(),
  unique (record_type, criterion_key)
);

comment on table public.scoring_criteria is
  'The scoring framework vocabulary: one row per criterion, per record type. '
  'criterion_key is the payload key a score series is stored under, and is '
  'the join to stage_gate_rules.requirement_detail->>''field''. '
  'rescore_through_stage is null when a criterion is not re-scoreable, and '
  'otherwise names the last stage at which a re-score is PERMITTED. That is '
  'deliberately not the same question as whether a re-score is REQUIRED, '
  'which is a stage_gate_rules row and stays there - permitted and required '
  'are different concerns and must not have two homes.';

alter table public.scoring_criteria enable row level security;

drop policy if exists "scoring_criteria_select" on public.scoring_criteria;
create policy "scoring_criteria_select" on public.scoring_criteria
  for select using (true);

-- ---------------------------------------------------------------------------
-- scoring_anchors: the versioned wording
-- ---------------------------------------------------------------------------
--
-- ANCHOR VERSIONING IS THE PART THAT CANNOT BE RETROFITTED, and it is the
-- reason this is a second table rather than three columns on the first.
--
-- Without it, rewriting an anchor in six months silently changes the meaning
-- of every historical score, and comparison across time becomes worthless
-- without anyone noticing. With it, the business can say "under the current
-- definition that would have scored a 2."
--
-- Rows are APPEND-ONLY. A wording change inserts a new version's full set of
-- rows; nothing is ever updated in place. That is enforced by RLS rather than
-- by convention: this table has a select policy and NO update or delete
-- policy, so writes are refused deny-by-default - the identical construction
-- that makes record_revisions immutable (initial_schema.sql:188). It is the
-- same discipline as immutable approved snapshots, applied to judgement
-- rather than to money.
--
-- The current version is max(version) per criterion, COMPUTED and never
-- stored, per the rule that computed values are computed.
--
-- score is checked as 1..5 rather than as exactly (1,3,5). Anchors exist for
-- 1, 3 and 5 today and 2 and 4 are "between these", but anchor wording is
-- provisional and the business will review it - so giving 2 or 4 real wording
-- later must be a ROW, not a migration.
create table if not exists public.scoring_anchors (
  id           uuid primary key default gen_random_uuid(),
  criterion_id uuid not null references public.scoring_criteria(id) on delete restrict,
  version      int  not null,
  score        int  not null check (score between 1 and 5),
  wording      text not null,
  created_at   timestamptz not null default now(),
  unique (criterion_id, version, score)
);

comment on table public.scoring_anchors is
  'Anchored wording per criterion, per version, per score. APPEND ONLY: a '
  'wording change inserts a new version rather than updating a row, so a '
  'score recorded against version N always resolves to the wording it was '
  'actually made against. Immutability is enforced by the absence of update '
  'and delete policies, not by convention. Anchors describe what is '
  'observably true, never how the scorer feels.';

create index if not exists scoring_anchors_criterion_version_idx
  on public.scoring_anchors (criterion_id, version);

alter table public.scoring_anchors enable row level security;

drop policy if exists "scoring_anchors_select" on public.scoring_anchors;
create policy "scoring_anchors_select" on public.scoring_anchors
  for select using (true);

-- ---------------------------------------------------------------------------
-- Seed: the five criteria
-- ---------------------------------------------------------------------------
--
-- FOUR EXISTING CRITERIA BECOME FIVE. This is not four renamed to four:
--   * exitQualPartnerCommitment          -> Client Commitment        (rename)
--   * exitQualTechnicalCommercialValue   -> Rollout Path             (rename)
--   * exitQualDataAndUseCase             -> RETIRES, splitting into
--       Clear Use Case Requirements and Metrics, and Data Rights
--   * exitQualPhysicalSuitability        -> Physical Suitability     (same)
--
-- EVERY KEY IS NEW, including the unchanged criterion, because the STORED
-- TYPE changes. A tick stores an ISO timestamp; a score stores an append-only
-- series. Reusing exitQualPhysicalSuitability would leave four Closed records
-- holding a timestamp in a field now typed as an array. The exitQual prefix
-- is also wrong for three of the five, which are re-scored at later stages.
insert into public.scoring_criteria (record_type, criterion_key, name, asks, sort_order, rescore_through_stage)
select v.record_type, v.criterion_key, v.name, v.asks, v.sort_order, v.rescore_through_stage
from (values
  ('test_bed', 'scoreRolloutPath', 'Rollout Path',
   'Does a route to deployment exist', 1, null),
  ('test_bed', 'scoreClientCommitment', 'Client Commitment',
   'Will the client organisation genuinely engage', 2, null),
  ('test_bed', 'scoreUseCaseRequirementsAndMetrics', 'Clear Use Case Requirements and Metrics',
   'Can it be proven', 3, 'Monitoring and Analysis'),
  ('test_bed', 'scorePhysicalSuitability', 'Physical Suitability',
   'Can it be installed', 4, 'Site Assessment'),
  ('test_bed', 'scoreDataRights', 'Data Rights',
   'Is it worth doing for Terminus', 5, 'Site Assessment')
) as v(record_type, criterion_key, name, asks, sort_order, rescore_through_stage)
where not exists (
  select 1 from public.scoring_criteria c
  where c.record_type = v.record_type and c.criterion_key = v.criterion_key
);

-- ---------------------------------------------------------------------------
-- Seed: version 1 anchors, wording verbatim from the round brief's appendix
-- ---------------------------------------------------------------------------
--
-- PROVISIONAL, pending business review, and stored as DATA precisely so that
-- review changes rows rather than a build.
insert into public.scoring_anchors (criterion_id, version, score, wording)
select c.id, 1, v.score, v.wording
from (values
  -- Rollout Path
  ('scoreRolloutPath', 5, 'A specific rollout is defined in scope and approximate scale. A budget route for it is identified and its holder known. A timeframe or trigger exists. The client has stated the Test Bed is the step toward that decision.'),
  ('scoreRolloutPath', 3, 'A rollout is discussed in general terms with no defined scope or scale. Budget is assumed to exist but its route is not identified. No timeframe beyond general intent.'),
  ('scoreRolloutPath', 1, 'No rollout has been discussed. The client''s interest is exploratory or research-driven with no stated path to deployment.'),
  -- Client Commitment
  ('scoreClientCommitment', 5, 'A named executive sponsor with budget or site authority has personally attended a meeting. Site access dates are confirmed in writing. The client has named their own people and stated the time they will give. The Test Bed is known and supported beyond the sponsor within their organisation.'),
  ('scoreClientCommitment', 3, 'An engaged manager is driving it, but sponsorship above them is assumed rather than confirmed. Site access is agreed in principle with no dates in writing. Client resource is discussed but nobody is named.'),
  ('scoreClientCommitment', 1, 'One interested individual with no authority to commit site, people or data. No dates. No evidence anyone else in their organisation knows the Test Bed is proposed.'),
  -- Clear Use Case Requirements and Metrics
  ('scoreUseCaseRequirementsAndMetrics', 5, 'The client has stated a specific question in their own operational terms. Terminus has identified what would be measured to answer it and confirmed the proposed sensors can capture it. Where a before-and-after comparison is needed, a baseline exists or can be captured before go live.'),
  ('scoreUseCaseRequirementsAndMetrics', 3, 'The use case is stated at a general level. What would be measured is understood by Terminus but not agreed with the client, or the baseline position is unclear.'),
  ('scoreUseCaseRequirementsAndMetrics', 1, 'Interest in the technology with no stated operational question. Nothing identified that would be measured, or the client''s stated need cannot be answered by the sensors proposed.'),
  -- Physical Suitability
  ('scorePhysicalSuitability', 5, 'A Terminus technical person has assessed the site, in person or from client-supplied drawings and photographs. Mounting positions, power and connectivity are identified. Any access, permitting or safety requirements are known and confirmed achievable by the client.'),
  ('scorePhysicalSuitability', 3, 'The site is described and appears workable, but no Terminus technical assessment has taken place. Power or connectivity at the specific positions is assumed rather than confirmed. Access and permitting requirements are not yet established.'),
  ('scorePhysicalSuitability', 1, 'The site has not been described in any detail, or a known constraint exists that no proposed arrangement resolves.'),
  -- Data Rights
  ('scoreDataRights', 5, 'The client has confirmed Terminus may retain and use the data for product development, and the person confirming has authority to grant it. Any restrictions on use, retention or publication are stated and acceptable. Where personal data is involved, the client''s own basis for sharing it is identified.'),
  ('scoreDataRights', 3, 'Data access is assumed by both parties but has not been discussed explicitly, or has been agreed by someone without authority to grant it. Restrictions are not yet established.'),
  ('scoreDataRights', 1, 'No data-use discussion has taken place, or the client has stated a restriction that prevents Terminus using the data for development.')
) as v(criterion_key, score, wording)
join public.scoring_criteria c
  on c.record_type = 'test_bed' and c.criterion_key = v.criterion_key
where not exists (
  select 1 from public.scoring_anchors a
  where a.criterion_id = c.id and a.version = 1 and a.score = v.score
);

-- ---------------------------------------------------------------------------
-- Retire exitQualDataAndUseCase
-- ---------------------------------------------------------------------------
--
-- The criterion CEASES TO EXIST rather than changing form: it asked two
-- questions at once and the framework now asks them separately. The other
-- three Qualification criteria keep gating as ticks until Phase 4 swaps them
-- for scores; only this one retires here.
--
-- THE INTERMEDIATE STATE IS A REAL WEAKENING AND IS RECORDED RATHER THAN
-- GLOSSED. Transition 1 carries three labelled criteria from this migration
-- until Phase 4 restores five. Surveyed across all 151 Test Bed records
-- before choosing this sequencing:
--
--   LIVE at Qualification, criteria held:
--     TT-SGP-MANUFI-001   0 of 5
--     TT-SGP-SMARTC-004   0 of 5
--     TT-SGP-SMARTC-005   0 of 5
--
-- No live record holds a tick on any criterion, so nothing loses a tick it
-- was relying on, and the weakening cannot let any record through a gate it
-- was otherwise close to passing.
--
-- THE ALTERNATIVE SEQUENCING WAS REFUTED BY THAT SAME SURVEY. Removing the
-- key from TB_EXIT_CRITERION_KEYS while leaving this rule in place makes the
-- row computed rather than tickable: it still blocks, and nothing in the
-- product can satisfy it. That is the Round 7 Phase 3.2 shape, where building
-- a branch without removing its rules would have made a transition
-- impossible to complete, and it would have blocked all three live
-- Qualification records rather than none.
--
-- Four live and three soft-deleted Closed records keep exitQualDataAndUseCase
-- in their payloads, now unread. Same as the warrantyPct precedent: finding
-- it in history does not mean it is live.
delete from public.stage_gate_rules
where record_type = 'test_bed'
  and from_stage = 'Qualification'
  and to_stage = 'Pre-Site Assessment'
  and requirement_type = 'payload_field_required'
  and requirement_detail = '{"field": "exitQualDataAndUseCase", "label": "Data and Use Case"}'::jsonb;

-- jsonb compared to jsonb, never via a ::text cast. Postgres normalises key
-- order on storage, so a text comparison would silently never match and this
-- delete would quietly do nothing. That exact fault duplicated rows on every
-- seed run and is a standing rule.
