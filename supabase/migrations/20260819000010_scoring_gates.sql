-- Terminus TMS: scores replace ticks, re-score gates, and the measurability
-- confirmation. Round 11 Phase 4, 2026-08-19.
--
-- Written idempotently throughout per Architecture rule 7: guarded data
-- writes, and deletes that are naturally idempotent. jsonb is compared to
-- jsonb and never via a ::text cast, because Postgres normalises jsonb key
-- order on storage so a text comparison silently never matches, which is the
-- fault that once duplicated rows on every seed run.
--
-- BASELINE: 53 stage_gate_rules total, 37 on test_bed, measured immediately
-- before this migration rather than taken from any figure in the brief.

-- ---------------------------------------------------------------------------
-- 4.1  Scores replace ticks on transition 1
-- ---------------------------------------------------------------------------
--
-- The three surviving labelled tick criteria retire. exitQualDataAndUseCase
-- already retired in Phase 1, when it split into two criteria rather than
-- being renamed.
--
-- These are DELETED rather than left alongside the scored rules. Leaving them
-- would mean a Test Bed had to satisfy both a tick and a score for the same
-- judgement, which is not what "scores replace ticks" means, and the tick
-- would be the easier of the two so the score would gate nothing in practice.
delete from public.stage_gate_rules
where record_type = 'test_bed'
  and from_stage = 'Qualification'
  and to_stage = 'Pre-Site Assessment'
  and requirement_type = 'payload_field_required'
  and requirement_detail in (
    '{"field": "exitQualTechnicalCommercialValue", "label": "Technical and Commercial Value"}'::jsonb,
    '{"field": "exitQualPartnerCommitment", "label": "Partner Commitment"}'::jsonb,
    '{"field": "exitQualPhysicalSuitability", "label": "Physical Suitability"}'::jsonb
  );

-- The five scored criteria. min_length 1 is what makes "a score exists" mean
-- a score exists: without it an empty array satisfies the rule, measured
-- directly against the real evaluator in Phase 0.
--
-- NO THRESHOLD ANYWHERE, confirmed with the business. The gate requires a
-- score to be RECORDED, never a particular value. Two completed Test Beds is
-- not evidence about which scores predict good outcomes, and a floor set
-- today would encode a guess as a rule.
insert into public.stage_gate_rules (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
select 'test_bed', null, 'Qualification', 'Pre-Site Assessment', 'payload_field_required', v.detail
from (values
  ('{"field": "scoreRolloutPath", "label": "Rollout Path", "min_length": 1}'::jsonb),
  ('{"field": "scoreClientCommitment", "label": "Client Commitment", "min_length": 1}'::jsonb),
  ('{"field": "scoreUseCaseRequirementsAndMetrics", "label": "Clear Use Case Requirements and Metrics", "min_length": 1}'::jsonb),
  ('{"field": "scorePhysicalSuitability", "label": "Physical Suitability", "min_length": 1}'::jsonb),
  ('{"field": "scoreDataRights", "label": "Data Rights", "min_length": 1}'::jsonb)
) as v(detail)
where not exists (
  select 1 from public.stage_gate_rules r
  where r.record_type = 'test_bed'
    and r.from_stage = 'Qualification'
    and r.to_stage = 'Pre-Site Assessment'
    and r.requirement_type = 'payload_field_required'
    and r.requirement_detail = v.detail
);

-- ---------------------------------------------------------------------------
-- 4.2  Re-score gates
-- ---------------------------------------------------------------------------
--
-- The re-score must be genuinely REQUIRED at the later gate, not merely
-- permitted. scoring_criteria.rescore_through_stage records where a re-score
-- is permitted; these rows are where one is required, and the two are
-- deliberately separate homes for genuinely different questions.
--
-- entry_stage_at_or_after is satisfied only by an entry whose own `stage`
-- sits at or after the named stage in sort_order position. A qualification
-- score therefore does NOT satisfy a Site Assessment gate, which is the whole
-- point: a stale qualification guess must not carry unchallenged into
-- installation, and Physical Suitability in particular exists to catch the
-- site problem that is invisible at qualification and fatal on install day.
insert into public.stage_gate_rules (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
select 'test_bed', null, v.from_stage, v.to_stage, 'payload_field_required', v.detail
from (values
  ('Site Assessment', 'Installation and Commissioning',
   '{"field": "scoreDataRights", "label": "Data Rights", "min_length": 1, "entry_stage_at_or_after": "Site Assessment"}'::jsonb),
  ('Site Assessment', 'Installation and Commissioning',
   '{"field": "scorePhysicalSuitability", "label": "Physical Suitability", "min_length": 1, "entry_stage_at_or_after": "Site Assessment"}'::jsonb),
  ('Monitoring and Analysis', 'Review and Completion',
   '{"field": "scoreUseCaseRequirementsAndMetrics", "label": "Clear Use Case Requirements and Metrics", "min_length": 1, "entry_stage_at_or_after": "Monitoring and Analysis"}'::jsonb)
) as v(from_stage, to_stage, detail)
where not exists (
  select 1 from public.stage_gate_rules r
  where r.record_type = 'test_bed'
    and r.from_stage = v.from_stage
    and r.to_stage = v.to_stage
    and r.requirement_type = 'payload_field_required'
    and r.requirement_detail = v.detail
);

-- ---------------------------------------------------------------------------
-- 4.3  The measurability confirmation
-- ---------------------------------------------------------------------------
--
-- Confirmed with the business as a SEPARATE plain yes or no, deliberately not
-- folded into the 1 to 5: can the proposed sensors capture what would be
-- measured? Either they can or they cannot, and a 3 is not a meaningful
-- answer, which is why it is not scored.
--
-- It is recorded with an author, because it is a technical judgement and it
-- is currently the ONLY technical judgement recorded anywhere before
-- commitment. Entitlement stays out of scope, consistent with everything
-- else: this proves who confirmed it, not that they were entitled to.
--
-- Stored as the same append-only entry shape a score uses, so the author and
-- timestamp are written server-side by the same helper rather than by a
-- second convention.
insert into public.stage_gate_rules (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
select 'test_bed', null, 'Qualification', 'Pre-Site Assessment', 'payload_field_required',
  '{"field": "measurabilityConfirmed", "label": "Sensors can capture what would be measured", "min_length": 1}'::jsonb
where not exists (
  select 1 from public.stage_gate_rules r
  where r.record_type = 'test_bed'
    and r.from_stage = 'Qualification'
    and r.to_stage = 'Pre-Site Assessment'
    and r.requirement_type = 'payload_field_required'
    and r.requirement_detail = '{"field": "measurabilityConfirmed", "label": "Sensors can capture what would be measured", "min_length": 1}'::jsonb
);
