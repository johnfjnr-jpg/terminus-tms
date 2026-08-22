-- Terminus TMS: DISPOSABLE scaffold criteria, Round 20 Phase 7.
--
-- ═══════════════════════════════════════════════════════════════
-- THIS MIGRATION IS REMOVED BY 20260822000006 IN PHASE 8.
-- Nothing should ever be built against these three rows.
-- ═══════════════════════════════════════════════════════════════
--
-- OPPORTUNITY_DESIGN.md, "The scaffold approach". They stand in for the
-- Deal and Risk assessment criteria, which are undecided and deliberately
-- out of this round. Their only job is to prove the gate mechanism carries
-- criteria that were added after the stage was configured, and to prove the
-- removal path, which is the half nobody exercises.
--
-- THREE, NOT ONE. Trap 3 in that section: one criterion proves the gate,
-- not the panel. A single row cannot show that the count, the summary line
-- and the partial-satisfaction states are right, and those are exactly what
-- a real criteria set will exercise on day one.
--
-- Trap 1, a copied criterion becomes a real one. Every name below is
-- prefixed scaffold and reads as throwaway in the UI, so a row that
-- survives its removal is obvious on sight rather than plausible.
--
-- Placed on Qualification -> Solution Alignment because that transition
-- carries no approvals, so a blocked result there is unambiguously the
-- criteria rather than a missing signature.

insert into public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
select 'opportunity', null, 'Qualification', 'Solution Alignment', 'payload_field_required', v.detail::jsonb
from (values
  ('{"field":"scaffoldOne","label":"SCAFFOLD one, delete me"}'),
  ('{"field":"scaffoldTwo","label":"SCAFFOLD two, delete me"}'),
  ('{"field":"scaffoldThree","label":"SCAFFOLD three, delete me"}')
) as v(detail)
where not exists (
  select 1 from public.stage_gate_rules r
  where r.record_type = 'opportunity' and r.variant is null
    and r.from_stage = 'Qualification' and r.to_stage = 'Solution Alignment'
    and r.requirement_type = 'payload_field_required'
    and r.requirement_detail = v.detail::jsonb
);
