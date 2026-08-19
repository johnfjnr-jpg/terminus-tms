-- Round 9 Phase 5, transition 5 of 7.
--
-- Monitoring and Analysis -> Review and Completion: two documents, three
-- approvals, and one judgement criterion. This transition had no rules at
-- all before now.
--
-- The two documents SUPERSEDE the single shared Test Bed Review Document
-- that Round 7 Phase 4 recorded for stages 5 and 6, with the gate placed
-- on transition 5 only. That reasoning is void and is recorded as
-- superseded in DESIGN_PRINCIPLES.md rather than deleted. Round 9 Phase 2
-- already removed both of its stage_reference_docs rows and added these.
--
-- Test Bed Performance and Review Meeting Minutes are LIVING documents,
-- updated across the life of the stage rather than one record per
-- meeting. The gate requires the document to be current and reviewed at
-- the point of transition, which is exactly what the existing mechanism
-- provides: one child document record per document name, its URL
-- updatable. No new mechanism is needed and none is built.
--
-- The criterion is an ordinary payload_field_required rule.
-- exitMonAllMeetingActionsCompleted is already a member of
-- TB_EXIT_CRITERION_KEYS in src/routes/test-beds.js, which is both the
-- PATCH allowlist and the set the tick control may offer. Its value is an
-- ISO timestamp and untick deletes the key: payload_field_required blocks
-- only on undefined, null and the empty string, so a stored boolean false
-- would read as present and open the gate.
--
-- All three approvals carry scope "stage".
--
-- Idempotent per CLAUDE.md Architecture rule 7, guards compare jsonb to
-- jsonb.

insert into public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
select 'test_bed', null, 'Monitoring and Analysis', 'Review and Completion',
       'document_status', v.detail::jsonb
from (values
  ('{"status": "approved", "document": "Test Bed Performance"}'),
  ('{"status": "approved", "document": "Review Meeting Minutes"}')
) as v(detail)
where not exists (
  select 1 from public.stage_gate_rules r
  where r.record_type = 'test_bed' and r.variant is null
    and r.from_stage = 'Monitoring and Analysis' and r.to_stage = 'Review and Completion'
    and r.requirement_type = 'document_status'
    and r.requirement_detail = v.detail::jsonb
);

insert into public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
select 'test_bed', null, 'Monitoring and Analysis', 'Review and Completion',
       'approval_obtained', v.detail::jsonb
from (values
  ('{"track": "Technical", "scope": "stage"}'),
  ('{"track": "Commercial", "scope": "stage"}'),
  ('{"track": "Legal", "scope": "stage"}')
) as v(detail)
where not exists (
  select 1 from public.stage_gate_rules r
  where r.record_type = 'test_bed' and r.variant is null
    and r.from_stage = 'Monitoring and Analysis' and r.to_stage = 'Review and Completion'
    and r.requirement_type = 'approval_obtained'
    and r.requirement_detail = v.detail::jsonb
);

insert into public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
select 'test_bed', null, 'Monitoring and Analysis', 'Review and Completion',
       'payload_field_required',
       '{"field": "exitMonAllMeetingActionsCompleted", "label": "All Meeting Actions Completed"}'::jsonb
where not exists (
  select 1 from public.stage_gate_rules r
  where r.record_type = 'test_bed' and r.variant is null
    and r.from_stage = 'Monitoring and Analysis' and r.to_stage = 'Review and Completion'
    and r.requirement_type = 'payload_field_required'
    and r.requirement_detail = '{"field": "exitMonAllMeetingActionsCompleted", "label": "All Meeting Actions Completed"}'::jsonb
);
