-- Round 9 Phase 4, transition 1 of 4.
--
-- Qualification -> Pre-Site Assessment: add the four Qualification
-- judgement criteria. The transition's existing 8 rules (3
-- payload_field_required for Duration/Est. Install Date/Est. Go Live, 3
-- contact_role_linked for the buyer roles, 2 approval_obtained for
-- Technical and Commercial) are untouched. These 4 are added alongside.
--
-- The criteria are ordinary payload_field_required rules, not a new
-- requirement type. No branch is added to transitions.js and the whole
-- checklist stays configurable as data for the eventual Admin module.
--
-- `label` is additive and the engine ignores it: the payload_field_required
-- branch reads `field` and nothing else, confirmed by direct reading in
-- Round 9 Phase 0 item 7. It supplies the wording for the tick list and
-- for a rejected transition's message.
--
-- THE TICK VALUE IS AN ISO TIMESTAMP, NEVER A BOOLEAN, and untick deletes
-- the key. payload_field_required blocks only on undefined, null and the
-- empty string, so a stored `false` reads as PRESENT and would satisfy
-- the gate with the box visibly unticked. Demonstrated on a live
-- evaluator in Round 9 Phase 3, not argued. The four `field` values below
-- are the same strings as TB_EXIT_CRITERION_KEYS in
-- src/routes/test-beds.js, which is both the writable-key allowlist and
-- the set the tick control is permitted to offer.
--
-- Idempotent per CLAUDE.md Architecture rule 7. Guards compare jsonb to
-- jsonb, never via a ::text cast, which once duplicated three rows on
-- every seed run.

insert into public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
select 'test_bed', null, 'Qualification', 'Pre-Site Assessment',
       'payload_field_required', v.detail::jsonb
from (values
  ('{"field": "exitQualTechnicalCommercialValue", "label": "Technical and Commercial Value"}'),
  ('{"field": "exitQualDataAndUseCase", "label": "Data and Use Case"}'),
  ('{"field": "exitQualPhysicalSuitability", "label": "Physical Suitability"}'),
  ('{"field": "exitQualPartnerCommitment", "label": "Partner Commitment"}')
) as v(detail)
where not exists (
  select 1 from public.stage_gate_rules r
  where r.record_type = 'test_bed' and r.variant is null
    and r.from_stage = 'Qualification' and r.to_stage = 'Pre-Site Assessment'
    and r.requirement_type = 'payload_field_required'
    and r.requirement_detail = v.detail::jsonb
);
