-- Test Bed stage gate rules.
--
-- Scope note (2026-08-18, Round 7 Phase 0). This file previously held 10
-- INSERTs. Six were deleted here because they named stages that no longer
-- exist, and re-running this seed silently recreated rows a migration had
-- already removed:
--
--   * 1x  NDA -> Site Assessment                                   (document_status: NDA)
--   * 5x  Compliance and Data Protection
--           -> Installation and Commissioning                      (document_status:
--                                                                   NDA, Site Assessment,
--                                                                   Partnership and Test Bed
--                                                                   Agreement, DPIA, APD)
--
-- Migration 20260815000000_test_bed_flat_stages.sql hard-deletes both of
-- those (from_stage, to_stage) pairs as orphaned data: the flat 8-stage
-- model replaced the old 9-stage one, and neither "NDA" nor "Compliance
-- and Data Protection" survives as a stage. Because every INSERT here is
-- guarded by WHERE NOT EXISTS on its own exact row, the migration's delete
-- made those guards pass again, so `npm run db:seed` re-inserted all six
-- on any fresh environment. Live was 10 rules; a fresh seed produced 16.
--
-- They are deleted rather than commented out on purpose: git history is
-- the permanent record, the migration's own comment block already explains
-- the removal, and dead SQL left sitting inside a file that gets executed
-- is exactly how this happened.
--
-- Second removal (2026-08-18, Round 7 Phase 3.2). The three
-- child_record_status INSERTs that used to follow the rule below have
-- also been deleted, from this file and from the live database in the
-- same change, per the standing rule that a change deleting seeded data
-- must reconcile the seed file with it.
--
-- They asked for {"record_type":"nda"|"pdpa_assessment"|"dpia"} as a
-- CHILD RECORD TYPE. No such record type exists or can be created: this
-- system stores documents as record_type='document' discriminated by
-- records.variant, and the canonical vocabulary is
-- stage_reference_docs.document_name (NDA, Site Assessment Report,
-- Compliance and Data Protection, Partnership and Test Bed Agreement,
-- Site Installation Document, Test Bed Review Document) - which contains
-- no PDPA Assessment or DPIA at all. All three were therefore
-- unsatisfiable under every reading, and had been inert only because the
-- gate branch did not exist. Building that branch (Phase 3.2) without
-- removing them would have turned Decommissioning -> Closed into a
-- transition no Test Bed could ever complete.
--
-- Confirmed with the business: the three requirements are dropped as
-- redundant, since the earlier gates already prove those documents were
-- reviewed. Decommissioning -> Closed is now gated by the Senior
-- approval alone, pending Phase 4 adding a Decommissioning Report.
--
-- The one rule below is the only one this seed still owns. The other six
-- live test_bed rules come from migrations, not from here:
-- 3x payload_field_required (20260815000000) and 3x contact_role_linked
-- (20260815000004). Live total is now 7.
--
-- Second defect, found by running this seed as Phase 0's own evidence
-- (2026-08-18). Every guard here compared `requirement_detail::text` to a
-- string literal. `requirement_detail` is jsonb, and jsonb normalises key
-- order on storage, so a stored `{"record_type": "nda", "status": "approved"}`
-- comes back as `{"status": "approved", "record_type": "nda"}` and the text
-- comparison never matched. The NOT EXISTS guard therefore always passed and
-- every re-run duplicated all three child_record_status rows. Only the
-- single-key `{"track": "Senior"}` row matched by luck, its serialisation
-- being order-independent. Guards now compare jsonb to jsonb, which is
-- order- and whitespace-independent, matching what 001_smoke_test.sql
-- already did correctly. Never compare jsonb via ::text.
--
-- Standing rule, see DESIGN_PRINCIPLES.md "Deferred scope": a migration
-- that deletes or rewrites seeded data must reconcile the seed file in the
-- same change. Seeds re-run, and they win.

-- Decommissioning → Closed: gated more heavily than the rest of the lifecycle.

-- Senior-tier approval required (ACTIVE GATE)
INSERT INTO public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
SELECT 'test_bed', NULL, 'Decommissioning', 'Closed', 'approval_obtained',
       '{"track": "Senior"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.stage_gate_rules
  WHERE record_type = 'test_bed' AND variant IS NULL
    AND from_stage = 'Decommissioning' AND to_stage = 'Closed'
    AND requirement_type = 'approval_obtained'
    AND requirement_detail = '{"track": "Senior"}'::jsonb
);
