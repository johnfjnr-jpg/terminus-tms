-- Terminus TMS: Test Bed core record type, Milestone 2
--
-- PROTOTYPE_SPECIFICATION.md Section 6 / TESTBED_BUILD_BRIEF.md Milestone 2
-- / DESIGN_PRINCIPLES.md's stage_definitions and stage_gate_rules sections.
--
-- This replaces a prior, superseded Test Bed stage model already live in
-- this database (9 rows: NDA, Site Assessment, Partnership and Test Bed
-- Agreement, Compliance and Data Protection, Installation and
-- Commissioning, Monitoring and Analysis, Close out Review,
-- Decommissioning, Closed - a two-level Planning/sub-stage shape, matching
-- neither the earlier 6-stage migration file (20260803000000_test_bed.sql)
-- nor the corrected flat model below). Confirmed safe before running:
-- every live (non-deleted) test_bed record's current status is either
-- 'Closed' or 'Installation and Commissioning', both of which survive
-- this correction unchanged, so no live record's status becomes an
-- orphaned value.
--
-- Flat, 8 stages, no sub-stage layer (business decision, corrected this
-- session per DESIGN_PRINCIPLES.md, superseding the two-level model the
-- prior migration built).
delete from public.stage_definitions where record_type = 'test_bed';

insert into public.stage_definitions (record_type, variant, stage_name, sort_order) values
  ('test_bed', null, 'Qualification',                   1),
  ('test_bed', null, 'Pre-Site Assessment',              2),
  ('test_bed', null, 'Site Assessment',                  3),
  ('test_bed', null, 'Installation and Commissioning',   4),
  ('test_bed', null, 'Monitoring and Analysis',          5),
  ('test_bed', null, 'Review and Completion',            6),
  ('test_bed', null, 'Decommissioning',                  7),
  ('test_bed', null, 'Closed',                           8);

-- Remove the stage_gate_rules rows that referenced the old model's now-
-- removed stage names (from_stage values that no longer exist in
-- stage_definitions at all) - orphaned data, not reachable by any real
-- transition once the stages above them are gone. The 4 rows for
-- Decommissioning -> Closed are deliberately NOT touched here: that pair
-- of stage names still exists in the corrected list, but see the comment
-- block below - those 4 rows have real, confirmed problems of their own,
-- left in place and logged rather than silently deleted or silently
-- "fixed" with something invented.
delete from public.stage_gate_rules
  where record_type = 'test_bed'
    and (from_stage, to_stage) in (
      ('NDA', 'Site Assessment'),
      ('Compliance and Data Protection', 'Installation and Commissioning')
    );

-- Qualification's exit gate - the only stage confirmed with real business
-- input this milestone. The remaining 6 transitions are deliberately left
-- with no gate rows at all, not invented.
insert into public.stage_gate_rules (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail) values
  ('test_bed', null, 'Qualification', 'Pre-Site Assessment', 'payload_field_required', '{"field":"testBedDuration"}'),
  ('test_bed', null, 'Qualification', 'Pre-Site Assessment', 'payload_field_required', '{"field":"estimatedInstallationDate"}'),
  ('test_bed', null, 'Qualification', 'Pre-Site Assessment', 'payload_field_required', '{"field":"estGoLiveDate"}');

-- ─────────────────────────────────────────────────────────────
-- Known gaps, logged rather than left uncommented (2026-08-15 audit)
-- ─────────────────────────────────────────────────────────────
--
-- (1) The 4 existing Decommissioning -> Closed stage_gate_rules rows
-- (1 approval_obtained: {track: "Senior"}, 3 child_record_status rows for
-- record_type nda/pdpa_assessment/dpia) are left exactly as they were,
-- not modified by this migration. Two confirmed, real problems with them,
-- neither invented here, neither fixed here:
--   - requirement_type = 'child_record_status' has NO implementation in
--     src/routes/transitions.js's gate-check loop (confirmed by reading
--     it directly - there's a bare comment, "child_record_status handled
--     in a future milestone", no code branch). A rule using it is a
--     silent no-op: it blocks nothing, despite looking like a real gate
--     in the data. DESIGN_PRINCIPLES.md describes this as "the same
--     mechanism already used elsewhere" - that line is incorrect against
--     the actual code as it stands today.
--   - Even setting that aside, which document variants should gate this
--     specific transition is a real content decision (this database
--     already has working document_status-backed document records with
--     variants NDA/DPIA/APD/Site Assessment/Partnership and Test Bed
--     Agreement, proving that mechanism itself works - but choosing which
--     of those, or a different set, belongs to this one gate is not
--     something to invent here).
--
-- (2) routing_rules is completely empty - not a Test Bed-specific gap,
-- no record type has a tier defined yet, including Opportunity's own
-- Commercial escalation that DESIGN_PRINCIPLES.md describes as already
-- using it. The 'Senior' approval_tracks row already exists (seeded by
-- the prior test_bed migration, 20260803000000), so approval_obtained:
-- {track: "Senior"} is genuinely functional today - it blocks until an
-- approved Senior-track decision exists - but nothing yet constrains WHO
-- may hold that track differently at different tiers, since routing_rules
-- (tiering) is only relevant to escalating tracks, and none has been
-- built for any record type.
--
-- Both are chart-of-authority / product decisions, not schema gaps this
-- migration should paper over by inventing an answer.
