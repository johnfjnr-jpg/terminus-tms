-- Fix: Remove incorrectly seeded Opportunity gate rules using the Internal track.
-- The seed inserted variant='Commercial'; 20260803000000 migrated it to NULL.
-- If the seed was re-run after that migration, both variants may exist.
-- Section 5 defines no Internal-track gate requirement for Opportunity.
DELETE FROM stage_gate_rules
WHERE record_type = 'opportunity'
  AND requirement_detail->>'track' = 'Internal';

-- Add phase column to stage_definitions to support sub-stage grouping.
ALTER TABLE stage_definitions ADD COLUMN IF NOT EXISTS phase TEXT;

-- Replace the single 'Planning' test_bed stage with five sequential sub-stages.
DELETE FROM stage_definitions WHERE record_type = 'test_bed' AND stage_name = 'Planning';

-- Shift the existing post-Planning stages up to make room (new range: 6-10).
UPDATE stage_definitions SET sort_order = 6  WHERE record_type = 'test_bed' AND stage_name = 'Deployment';
UPDATE stage_definitions SET sort_order = 7  WHERE record_type = 'test_bed' AND stage_name = 'Monitoring and Analysis';
UPDATE stage_definitions SET sort_order = 8  WHERE record_type = 'test_bed' AND stage_name = 'Review';
UPDATE stage_definitions SET sort_order = 9  WHERE record_type = 'test_bed' AND stage_name = 'Decommissioning';
UPDATE stage_definitions SET sort_order = 10 WHERE record_type = 'test_bed' AND stage_name = 'Closed';

-- Insert the five Planning sub-stages (sort_order 1-5, phase = 'Planning').
INSERT INTO stage_definitions (record_type, variant, stage_name, sort_order, phase) VALUES
  ('test_bed', NULL, 'NDA',                               1, 'Planning'),
  ('test_bed', NULL, 'Site Assessment',                   2, 'Planning'),
  ('test_bed', NULL, 'Partnership and Test Bed Agreement', 3, 'Planning'),
  ('test_bed', NULL, 'DPIA',                              4, 'Planning'),
  ('test_bed', NULL, 'APD',                               5, 'Planning');

-- Gate rules for Planning sub-stage transitions.
-- requirement_type = 'document_status' is a placeholder: the engine currently only enforces
-- approval_obtained, so these do not block transitions yet but are present for future enforcement.
INSERT INTO stage_gate_rules (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail) VALUES
  ('test_bed', NULL, 'NDA',                               'Site Assessment',                   'document_status', '{"document": "NDA", "status": "signed"}'),
  ('test_bed', NULL, 'Site Assessment',                   'Partnership and Test Bed Agreement', 'document_status', '{"document": "Site Assessment", "status": "complete"}'),
  ('test_bed', NULL, 'Partnership and Test Bed Agreement', 'DPIA',                             'document_status', '{"document": "Partnership and Test Bed Agreement", "status": "signed"}'),
  ('test_bed', NULL, 'DPIA',                              'APD',                               'document_status', '{"document": "DPIA", "status": "complete"}'),
  ('test_bed', NULL, 'APD',                               'Deployment',                        'document_status', '{"document": "APD", "status": "complete"}');
