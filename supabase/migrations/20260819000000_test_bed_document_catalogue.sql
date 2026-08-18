-- Round 9 Phase 2: rebuild the Test Bed document catalogue.
--
-- Target state, all 8 stages, confirmed with the business:
--
--   Qualification                    none
--   Pre-Site Assessment              NDA
--   Site Assessment                  Site Assessment Report,
--                                    Compliance and Data Protection,
--                                    Partnership and Test Bed Agreement
--   Installation and Commissioning   Site Installation Document
--   Monitoring and Analysis          Test Bed Performance,
--                                    Review Meeting Minutes
--   Review and Completion            Test Bed Close Out Report
--   Decommissioning                  Site Decommissioning Report
--   Closed                           none
--
-- 9 rows. Migration 20260815000005_stage_reference_docs.sql seeded the
-- original 8 from PROTOTYPE_SPECIFICATION.md Section 6; this migration
-- removes 3 of those and adds 4, and every gate rule Phases 4 and 5 write
-- references a document name from the list above.
--
-- WHY EACH REMOVAL, recorded here rather than only in git, matching how
-- 003_test_bed.sql keeps its own removals visible in the file.
--
-- 1. ('Monitoring and Analysis', 'Test Bed Review Document') and
--    ('Review and Completion', 'Test Bed Review Document').
--
--    These two rows are the same living document, deliberately shared by
--    stages 5 and 6, with the gate placed on transition 5 only so that
--    transition 6 was released by its approval ticks rather than by a
--    document that had not changed (Round 7 Phase 4).
--
--    SUPERSEDED by a business decision: stage 5 produces two distinct
--    documents (Test Bed Performance and Review Meeting Minutes) and
--    stage 6 produces its own (Test Bed Close Out Report). Both stages now
--    gate on their own documents. That is simpler, and it removes a real
--    subtlety a future reader would otherwise have had to reconstruct.
--    The superseded reasoning is recorded in DESIGN_PRINCIPLES.md rather
--    than deleted.
--
--    Note that Test Bed Performance and Review Meeting Minutes are still
--    LIVING documents, updated across the life of the stage rather than
--    one record per meeting. The existing mechanism already supports that:
--    one child document record per document name, its URL updatable. No
--    new mechanism is needed and none is built.
--
-- 2. ('Decommissioning', 'Site Installation Document').
--
--    This row put the installation document on the decommissioning stage,
--    where the catalogue's own convention (a stage's documents are
--    produced during that stage and gate the exit from it) says the
--    decommissioning artefact belongs. The same artefact has now been
--    named three times across the project's history: Decommissioning
--    Report (Round 7 Phase 4), Site Installation Document on
--    Decommissioning (PROTOTYPE_SPECIFICATION.md Section 6), and now
--    Site Decommissioning Report. This third name is authoritative.
--
--    Site Installation Document is NOT removed from Installation and
--    Commissioning, which is its correct home and which gates transition
--    4. Only the Decommissioning instance goes.
--
-- The exit convention this catalogue has to satisfy: a document_status
-- rule gates the exit FROM a stage, so every document a rule names must
-- exist here against that rule's own from_stage. Checked against the
-- Phase 4 and Phase 5 gate tables before this migration was written, all
-- 9 document gates align with 0 mismatches, which is exactly what the new
-- invariant in Round 9 Phase 7.4 asserts.
--
-- Nothing is added to supabase/seeds/003_test_bed.sql by this change, and
-- that is deliberate rather than an omission. That seed contains no
-- stage_reference_docs rows at all: the entire catalogue lives in
-- migrations. The standing rule that a migration changing seeded data must
-- reconcile the seed in the same change exists because seeds re-run and
-- win; here there is no seed row to re-run, and adding one would create a
-- second home for the same data and a genuine chance of the two drifting.

delete from public.stage_reference_docs
where record_type = 'test_bed'
  and (stage_name, document_name) in (
    ('Monitoring and Analysis', 'Test Bed Review Document'),
    ('Review and Completion',   'Test Bed Review Document'),
    ('Decommissioning',         'Site Installation Document')
  );

-- Guarded per row so this migration is idempotent if it is ever re-run
-- against a database that already carries the new rows.
insert into public.stage_reference_docs (record_type, stage_name, document_name)
select 'test_bed', v.stage_name, v.document_name
from (values
  ('Monitoring and Analysis', 'Test Bed Performance'),
  ('Monitoring and Analysis', 'Review Meeting Minutes'),
  ('Review and Completion',   'Test Bed Close Out Report'),
  ('Decommissioning',         'Site Decommissioning Report')
) as v(stage_name, document_name)
where not exists (
  select 1 from public.stage_reference_docs d
  where d.record_type   = 'test_bed'
    and d.stage_name    = v.stage_name
    and d.document_name = v.document_name
);
