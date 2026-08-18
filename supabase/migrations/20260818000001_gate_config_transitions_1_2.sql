-- Round 7 Phase 4: gate configuration for Test Bed transitions 1 and 2 only.
--
-- Deliberately not all seven. DESIGN_PRINCIPLES.md Section 8 and
-- TESTBED_BUILD_BRIEF.md Milestone 2 both say the undefined stages stay open
-- until real Test Beds have run through them, and Milestone 2 says explicitly
-- not to invent requirements for them. The business is working through the
-- stages by review pass; this configures what has been reviewed. Transitions
-- 3 to 7 are left with no rows on purpose - an empty gate is an honest
-- "not yet defined", an invented one is a fabricated business rule.
--
-- Data, not code. Both transitions are configured entirely by the rows below;
-- no branch in transitions.js knows anything about Test Beds specifically.
--
-- Guards compare jsonb to jsonb, never requirement_detail::text. Casting to
-- text was the Phase 0 fault: jsonb normalises key order on storage, so a
-- text comparison never matched and every re-run duplicated the rows.

-- ── Transition 1: Qualification -> Pre-Site Assessment ───────────────────────
-- Fields and buyer roles are already live (3 payload_field_required from
-- 20260815000000, 3 contact_role_linked from 20260815000004). Only the two
-- approval tracks are new.
--
-- scope: "stage" (Round 7 Phase 3.1). These gates sit on a record that stays
-- under edit for weeks, so a revision-scoped approval would be silently voided
-- by any field edit - the exact fault 3.1 was built to fix. Deal Sheet and
-- Opportunity commercial approvals keep the revision default; this is a stage
-- gate and takes stage scope explicitly.

insert into public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
select 'test_bed', null, 'Qualification', 'Pre-Site Assessment',
       'approval_obtained', '{"track": "Technical", "scope": "stage"}'::jsonb
where not exists (
  select 1 from public.stage_gate_rules
  where record_type = 'test_bed' and variant is null
    and from_stage = 'Qualification' and to_stage = 'Pre-Site Assessment'
    and requirement_type = 'approval_obtained'
    and requirement_detail = '{"track": "Technical", "scope": "stage"}'::jsonb
);

insert into public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
select 'test_bed', null, 'Qualification', 'Pre-Site Assessment',
       'approval_obtained', '{"track": "Commercial", "scope": "stage"}'::jsonb
where not exists (
  select 1 from public.stage_gate_rules
  where record_type = 'test_bed' and variant is null
    and from_stage = 'Qualification' and to_stage = 'Pre-Site Assessment'
    and requirement_type = 'approval_obtained'
    and requirement_detail = '{"track": "Commercial", "scope": "stage"}'::jsonb
);

-- ── Transition 2: Pre-Site Assessment -> Site Assessment ────────────────────
-- The NDA gates the EXIT from Pre-Site Assessment, not entry to it. Confirmed
-- convention, and it governs the remaining five gates: a stage's documents are
-- produced during that stage and gate the exit from it. The template arrives
-- on entry, the completed document releases the exit.
--
-- requirement_type is document_status, NOT child_record_status, and the
-- distinction is load-bearing rather than stylistic. The two are not
-- interchangeable for documents: GET /test-beds/:id/document-requirements
-- builds completable_documents - the list that renders the operator's
-- "Confirm" button - by filtering on requirement_type = 'document_status'
-- specifically (test-beds.js, both call sites). A child_record_status rule
-- would block this transition correctly and then offer the operator no way
-- to satisfy it from within the product. child_record_status is the generic
-- mechanism for children with no UI affordance of their own; document_status
-- is the operator-completable one.
--
-- "NDA" is the exact string from stage_reference_docs.document_name. No case
-- folding anywhere in the matching path, so the vocabulary has to line up.

insert into public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
select 'test_bed', null, 'Pre-Site Assessment', 'Site Assessment',
       'document_status', '{"document": "NDA", "status": "approved"}'::jsonb
where not exists (
  select 1 from public.stage_gate_rules
  where record_type = 'test_bed' and variant is null
    and from_stage = 'Pre-Site Assessment' and to_stage = 'Site Assessment'
    and requirement_type = 'document_status'
    and requirement_detail = '{"document": "NDA", "status": "approved"}'::jsonb
);
