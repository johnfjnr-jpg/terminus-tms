-- Round 9 Phase 4, transition 4 of 4.
--
-- Installation and Commissioning -> Monitoring and Analysis: the Site
-- Installation Document, plus Commercial and Technical approvals. This
-- transition had no rules at all before now.
--
-- SUPERSEDES PROTOTYPE_SPECIFICATION.md Section 6, which lists Technical
-- alone as this transition's approver. Confirmed with the business:
-- Commercial and Technical. The prototype extraction is annotated rather
-- than rewritten, since that document records what the prototype does and
-- the prototype genuinely did carry the single track.
--
-- Site Installation Document was confirmed present as a
-- stage_reference_docs row for 'test_bed' at stage_name 'Installation and
-- Commissioning' by exact byte match before this was written. Note this
-- is the row Round 9 Phase 2 deliberately KEPT: the same document name
-- also sat on Decommissioning, and that second instance was replaced by
-- Site Decommissioning Report. Only this one gates a transition.
--
-- Idempotent per CLAUDE.md Architecture rule 7, guards compare jsonb to
-- jsonb.

insert into public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
select 'test_bed', null, 'Installation and Commissioning', 'Monitoring and Analysis',
       'document_status', '{"status": "approved", "document": "Site Installation Document"}'::jsonb
where not exists (
  select 1 from public.stage_gate_rules r
  where r.record_type = 'test_bed' and r.variant is null
    and r.from_stage = 'Installation and Commissioning' and r.to_stage = 'Monitoring and Analysis'
    and r.requirement_type = 'document_status'
    and r.requirement_detail = '{"status": "approved", "document": "Site Installation Document"}'::jsonb
);

insert into public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
select 'test_bed', null, 'Installation and Commissioning', 'Monitoring and Analysis',
       'approval_obtained', v.detail::jsonb
from (values
  ('{"track": "Commercial", "scope": "stage"}'),
  ('{"track": "Technical", "scope": "stage"}')
) as v(detail)
where not exists (
  select 1 from public.stage_gate_rules r
  where r.record_type = 'test_bed' and r.variant is null
    and r.from_stage = 'Installation and Commissioning' and r.to_stage = 'Monitoring and Analysis'
    and r.requirement_type = 'approval_obtained'
    and r.requirement_detail = v.detail::jsonb
);
