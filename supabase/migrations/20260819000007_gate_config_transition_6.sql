-- Round 9 Phase 5, transition 6 of 7.
--
-- Review and Completion -> Decommissioning: the Test Bed Close Out
-- Report, plus Commercial, Technical and Legal approvals. This transition
-- had no rules at all before now.
--
-- Round 7 Phase 4 recorded that transition 6 would be gated by its
-- approval ticks ALONE, on the reasoning that it shared a single living
-- Test Bed Review Document with transition 5 and a persistent document
-- could not carry the freshness a tick does. That is superseded: this
-- stage now produces its own document, so it gates on its own document
-- as well as its approvals. See DESIGN_PRINCIPLES.md, where the
-- superseded reasoning is kept visible.
--
-- Test Bed Close Out Report was confirmed present as a
-- stage_reference_docs row for 'test_bed' at stage_name 'Review and
-- Completion' by exact byte match before this was written.
--
-- All three approvals carry scope "stage".
--
-- Idempotent per CLAUDE.md Architecture rule 7, guards compare jsonb to
-- jsonb.

insert into public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
select 'test_bed', null, 'Review and Completion', 'Decommissioning',
       'document_status', '{"status": "approved", "document": "Test Bed Close Out Report"}'::jsonb
where not exists (
  select 1 from public.stage_gate_rules r
  where r.record_type = 'test_bed' and r.variant is null
    and r.from_stage = 'Review and Completion' and r.to_stage = 'Decommissioning'
    and r.requirement_type = 'document_status'
    and r.requirement_detail = '{"status": "approved", "document": "Test Bed Close Out Report"}'::jsonb
);

insert into public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
select 'test_bed', null, 'Review and Completion', 'Decommissioning',
       'approval_obtained', v.detail::jsonb
from (values
  ('{"track": "Commercial", "scope": "stage"}'),
  ('{"track": "Technical", "scope": "stage"}'),
  ('{"track": "Legal", "scope": "stage"}')
) as v(detail)
where not exists (
  select 1 from public.stage_gate_rules r
  where r.record_type = 'test_bed' and r.variant is null
    and r.from_stage = 'Review and Completion' and r.to_stage = 'Decommissioning'
    and r.requirement_type = 'approval_obtained'
    and r.requirement_detail = v.detail::jsonb
);
