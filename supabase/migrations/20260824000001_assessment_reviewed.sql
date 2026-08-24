-- Terminus TMS: the exit criteria swap. Round 26 Phase 2, 2026-08-24.
--
-- Qualification's exit criteria were Budget, Timeline and Commitment to move
-- forward, configured in Round 20 before the assessment existed. The
-- assessment now carries Budget confirmed at Qualification with five levels, a
-- reason, an author and a history.
--
-- THOSE ARE THE SAME FACT IN TWO PLACES AND NOTHING KEEPS THEM IN STEP. A tick
-- can be set while the assessment reads Unknown, or the assessment can read
-- Verified while the transition is refused for want of a tick. Once
-- Organisational lands, Timeline and Commitment duplicate too.
--
-- The business chose a person recording that they READ the assessment over a
-- computed rollup. The reasoning, recorded because it will be re-litigated: a
-- computed rollup tightens silently as criteria are configured, and is
-- satisfiable by ticking through every criterion at Unknown. A named person
-- saying they reviewed it is one deliberate act, attributed and dated, that
-- does not tighten. It is also consistent with the settled decision that the
-- criteria inform and the approvals gate.
--
-- assessment_current is therefore built, exercised on a synthetic record type
-- in Round A, and NOT USED. Recorded as such rather than removed: it may be
-- wanted later.
--
-- ============================================================================
-- WHY A SERIES AND NOT A TIMESTAMP, which is how every other tick is stored
-- ============================================================================
--
-- One `assessmentReviewed` key across four stages, stored the usual way, would
-- be SATISFIED ONCE AND FOREVER. Every Opportunity rule today is a bare
-- presence check: 0 of 19 carry min_length and 0 carry
-- entry_stage_at_or_after, so a single ISO timestamp written at Qualification
-- would satisfy the identical rule at Solution Alignment, Proposal and
-- Negotiating with no further act, and four rows would be one row's worth of
-- obligation.
--
-- So the key holds an append-only SERIES of {at, by, stage}, and each rule
-- pairs min_length with entry_stage_at_or_after naming its own stage. Three
-- Test Bed rules use exactly this pairing today to require a re-score, so the
-- mechanism is proven rather than new. These four are the first Opportunity
-- rules to use either clause.
--
-- One key rather than four names for one concept, which also keeps
-- SALESPERSON_WRITABLE_KEYS to one addition.
--
-- ============================================================================
-- THE LIVE EFFECT, stated because it is the intent and not a side effect
-- ============================================================================
--
-- The three live Opportunities at Qualification hold NONE of the three keys
-- being removed, checked before writing this. They are blocked by all three
-- today, and after this migration they are blocked by one thing they can
-- actually do. **Three opportunities that cannot advance become advanceable
-- the moment someone reviews the assessment.** That is what the swap is for.
--
-- The one Closed Won record holds all three as ISO timestamps and keeps them
-- as orphaned payload keys. LEFT IN PLACE DELIBERATELY: Round 21 established
-- that a revision records what was true when it was written, and fifty
-- revisions still carry exitQualDataAndUseCase, retired in Round 11. Removing
-- a rule does not remove data, and rewriting history to match today's
-- configuration would be the larger mistake.
--
-- Written idempotently per Architecture rule 7.

-- ---------------------------------------------------------------------------
-- Remove Qualification's three, now duplicated by the assessment
-- ---------------------------------------------------------------------------
--
-- jsonb compared to jsonb, never through a ::text cast. Postgres normalises
-- key order on storage, so a text comparison would silently never match and
-- this delete would quietly do nothing.
delete from public.stage_gate_rules
where record_type = 'opportunity'
  and from_stage = 'Qualification'
  and to_stage = 'Solution Alignment'
  and requirement_type = 'payload_field_required'
  and requirement_detail->>'field' in ('exitQualBudget', 'exitQualTimeline', 'exitQualCommitment');

-- ---------------------------------------------------------------------------
-- Add Assessment reviewed at four stages
-- ---------------------------------------------------------------------------
insert into public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
select 'opportunity', null, v.from_stage, v.to_stage, 'payload_field_required', v.detail
from (values
  -- `verb` is empty because the label is already a past participle. Without
  -- it the blocking message reads "Requires Assessment reviewed SCORED at or
  -- after Qualification": the verb was hardcoded while this clause existed
  -- only for scores, and these are the first rules where it does not.
  ('Qualification', 'Solution Alignment',
   '{"field": "assessmentReviewed", "label": "Assessment reviewed", "min_length": 1, "entry_stage_at_or_after": "Qualification", "verb": ""}'::jsonb),
  ('Solution Alignment', 'Proposal',
   '{"field": "assessmentReviewed", "label": "Assessment reviewed", "min_length": 1, "entry_stage_at_or_after": "Solution Alignment", "verb": ""}'::jsonb),
  ('Proposal', 'Evaluation',
   '{"field": "assessmentReviewed", "label": "Assessment reviewed", "min_length": 1, "entry_stage_at_or_after": "Proposal", "verb": ""}'::jsonb),
  ('Negotiating', 'Closed Won',
   '{"field": "assessmentReviewed", "label": "Assessment reviewed", "min_length": 1, "entry_stage_at_or_after": "Negotiating", "verb": ""}'::jsonb)
) as v(from_stage, to_stage, detail)
where not exists (
  select 1 from public.stage_gate_rules r
  where r.record_type = 'opportunity'
    and r.from_stage = v.from_stage
    and r.requirement_type = 'payload_field_required'
    and r.requirement_detail = v.detail
);

-- The four rows above may already exist from an earlier run of this migration
-- without `verb`. Brought into line rather than deleted and reinserted, so a
-- replay converges on the same state either way.
update public.stage_gate_rules
set requirement_detail = requirement_detail || '{"verb": ""}'::jsonb
where record_type = 'opportunity'
  and requirement_type = 'payload_field_required'
  and requirement_detail->>'field' = 'assessmentReviewed'
  and requirement_detail->>'verb' is distinct from '';
