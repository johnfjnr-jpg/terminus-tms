-- Terminus TMS: Planning sub-stage restructure
-- Changes from Section 8 of DESIGN_PRINCIPLES.md:
--   1. DPIA and APD collapse into one CaDP (Compliance and Data Protection) sub-stage,
--      gated by two simultaneous document requirements rather than two sequential stages.
--   2. "Review" renamed to "Close out Review" throughout.

-- ── Stage definitions ────────────────────────────────────────────────────────────

-- Remove the two separate sub-stages that CaDP replaces.
DELETE FROM stage_definitions WHERE record_type = 'test_bed' AND stage_name IN ('DPIA', 'APD');

-- Insert the new CaDP sub-stage at position 4 in the Planning phase.
INSERT INTO stage_definitions (record_type, variant, stage_name, sort_order, phase)
VALUES ('test_bed', NULL, 'Compliance and Data Protection', 4, 'Planning');

-- Reindex post-Planning stages now that Planning has 4 sub-stages instead of 5.
UPDATE stage_definitions SET sort_order = 5 WHERE record_type = 'test_bed' AND stage_name = 'Deployment';
UPDATE stage_definitions SET sort_order = 6 WHERE record_type = 'test_bed' AND stage_name = 'Monitoring and Analysis';
UPDATE stage_definitions SET stage_name = 'Close out Review', sort_order = 7 WHERE record_type = 'test_bed' AND stage_name = 'Review';
UPDATE stage_definitions SET sort_order = 8 WHERE record_type = 'test_bed' AND stage_name = 'Decommissioning';
UPDATE stage_definitions SET sort_order = 9 WHERE record_type = 'test_bed' AND stage_name = 'Closed';

-- ── Gate rules ───────────────────────────────────────────────────────────────────

-- Remove old Planning gate rules that reference DPIA or APD as stages.
-- Removed: Partnership and Test Bed Agreement → DPIA, DPIA → APD, APD → Deployment.
DELETE FROM stage_gate_rules
WHERE record_type = 'test_bed'
  AND (from_stage IN ('DPIA', 'APD') OR to_stage IN ('DPIA', 'APD'));

-- Add Partnership and Test Bed Agreement → CaDP gate rule.
INSERT INTO stage_gate_rules (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
VALUES ('test_bed', NULL,
        'Partnership and Test Bed Agreement', 'Compliance and Data Protection',
        'document_status', '{"document": "Partnership and Test Bed Agreement", "status": "signed"}');

-- CaDP → Deployment requires BOTH documents simultaneously, not sequentially.
-- Both rows must be satisfied before the transition is allowed.
INSERT INTO stage_gate_rules (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
VALUES
  ('test_bed', NULL, 'Compliance and Data Protection', 'Deployment', 'document_status', '{"document": "DPIA", "status": "complete"}'),
  ('test_bed', NULL, 'Compliance and Data Protection', 'Deployment', 'document_status', '{"document": "APD", "status": "complete"}');

-- Rename any gate rule references to 'Review' (none currently, but kept for safety).
UPDATE stage_gate_rules SET from_stage = 'Close out Review' WHERE record_type = 'test_bed' AND from_stage = 'Review';
UPDATE stage_gate_rules SET to_stage   = 'Close out Review' WHERE record_type = 'test_bed' AND to_stage   = 'Review';

-- ── Migrate existing records ──────────────────────────────────────────────────────

-- Any test bed stuck at DPIA or APD advances to CaDP (data recovery only).
UPDATE records SET status = 'Compliance and Data Protection'
WHERE record_type = 'test_bed' AND status IN ('DPIA', 'APD');

-- Any test bed at Review moves to Close out Review.
UPDATE records SET status = 'Close out Review'
WHERE record_type = 'test_bed' AND status = 'Review';
