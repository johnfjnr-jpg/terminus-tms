-- Terminus TMS: remove the Round 20 Phase 7 scaffold. Phase 8.
--
-- Removes the three disposable criteria added by 20260822000005. Deleted by
-- their exact requirement_detail, jsonb compared to jsonb and never through
-- a ::text cast, so this cannot match a real rule by accident.
--
-- Trap 2 in OPPORTUNITY_DESIGN.md's scaffold section: removal must be
-- verified FROM THE DATABASE. The delete's own result is not the evidence,
-- and neither is the row count afterwards. Thirty-one is the right total
-- and it is also what you get by deleting the wrong three, so Phase 8
-- asserts all 31 real rules present BY NAME and the 3 scaffold rules absent
-- BY NAME.
--
-- Not removed, deliberately, and this is a decision rather than an
-- oversight: the scaffold payload keys written during the walk. Seventeen
-- revisions across three keys, on ONE record, which is soft deleted and
-- owned by a test account. No live record carries any of them.
--
-- record_revisions is append only and immutable, and records carries
-- ON DELETE RESTRICT from it, so removing them is neither permitted nor
-- desirable: a revision records what was true when it was written,
-- including a criterion that existed then and does not now. That is history
-- rather than residue, and the project already works this way. Round 11
-- Phase 1 retired exitQualDataAndUseCase together with its gate rule, and
-- 50 revisions still carry that key today with no rule naming it.

delete from public.stage_gate_rules
where record_type = 'opportunity'
  and variant is null
  and from_stage = 'Qualification'
  and to_stage = 'Solution Alignment'
  and requirement_type = 'payload_field_required'
  and requirement_detail in (
    '{"field":"scaffoldOne","label":"SCAFFOLD one, delete me"}'::jsonb,
    '{"field":"scaffoldTwo","label":"SCAFFOLD two, delete me"}'::jsonb,
    '{"field":"scaffoldThree","label":"SCAFFOLD three, delete me"}'::jsonb
  );
