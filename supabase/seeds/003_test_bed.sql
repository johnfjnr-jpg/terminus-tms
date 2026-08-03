-- Test Bed stage gate rules.
-- Planning sub-stage document gates (document_status, not yet enforced by the engine on older
-- installs, but NOW enforced -- see transitions.js). Each WHERE NOT EXISTS guard uses
-- requirement_detail::text since JSONB equality with ON CONFLICT requires exact key ordering.

-- NDA → Site Assessment
INSERT INTO public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
SELECT 'test_bed', NULL, 'NDA', 'Site Assessment', 'document_status', '{"document": "NDA", "status": "signed"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.stage_gate_rules
  WHERE record_type = 'test_bed' AND variant IS NULL
    AND from_stage = 'NDA' AND to_stage = 'Site Assessment'
    AND requirement_type = 'document_status'
    AND requirement_detail::text = '{"document": "NDA", "status": "signed"}'
);

-- Site Assessment → Partnership and Test Bed Agreement
INSERT INTO public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
SELECT 'test_bed', NULL, 'Site Assessment', 'Partnership and Test Bed Agreement', 'document_status', '{"document": "Site Assessment", "status": "complete"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.stage_gate_rules
  WHERE record_type = 'test_bed' AND variant IS NULL
    AND from_stage = 'Site Assessment' AND to_stage = 'Partnership and Test Bed Agreement'
    AND requirement_type = 'document_status'
    AND requirement_detail::text = '{"document": "Site Assessment", "status": "complete"}'
);

-- Partnership and Test Bed Agreement → Compliance and Data Protection
INSERT INTO public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
SELECT 'test_bed', NULL, 'Partnership and Test Bed Agreement', 'Compliance and Data Protection', 'document_status', '{"document": "Partnership and Test Bed Agreement", "status": "signed"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.stage_gate_rules
  WHERE record_type = 'test_bed' AND variant IS NULL
    AND from_stage = 'Partnership and Test Bed Agreement' AND to_stage = 'Compliance and Data Protection'
    AND requirement_type = 'document_status'
    AND requirement_detail::text = '{"document": "Partnership and Test Bed Agreement", "status": "signed"}'
);

-- Compliance and Data Protection → Deployment: DPIA (both this row and the APD row below
-- must be satisfied simultaneously before the transition is allowed)
INSERT INTO public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
SELECT 'test_bed', NULL, 'Compliance and Data Protection', 'Deployment', 'document_status', '{"document": "DPIA", "status": "complete"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.stage_gate_rules
  WHERE record_type = 'test_bed' AND variant IS NULL
    AND from_stage = 'Compliance and Data Protection' AND to_stage = 'Deployment'
    AND requirement_type = 'document_status'
    AND requirement_detail::text = '{"document": "DPIA", "status": "complete"}'
);

-- Compliance and Data Protection → Deployment: APD
INSERT INTO public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
SELECT 'test_bed', NULL, 'Compliance and Data Protection', 'Deployment', 'document_status', '{"document": "APD", "status": "complete"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.stage_gate_rules
  WHERE record_type = 'test_bed' AND variant IS NULL
    AND from_stage = 'Compliance and Data Protection' AND to_stage = 'Deployment'
    AND requirement_type = 'document_status'
    AND requirement_detail::text = '{"document": "APD", "status": "complete"}'
);

-- Decommissioning → Closed: gated more heavily than the rest of the lifecycle.

-- Senior-tier approval required (ACTIVE GATE)
INSERT INTO public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
SELECT 'test_bed', NULL, 'Decommissioning', 'Closed', 'approval_obtained', '{"track": "Senior"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.stage_gate_rules
  WHERE record_type = 'test_bed' AND variant IS NULL
    AND from_stage = 'Decommissioning' AND to_stage = 'Closed'
    AND requirement_type = 'approval_obtained'
    AND requirement_detail::text = '{"track": "Senior"}'
);

-- NDA reviewed (placeholder, not yet enforced -- child_record_status not implemented)
INSERT INTO public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
SELECT 'test_bed', NULL, 'Decommissioning', 'Closed', 'child_record_status', '{"record_type": "nda", "status": "approved"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.stage_gate_rules
  WHERE record_type = 'test_bed' AND variant IS NULL
    AND from_stage = 'Decommissioning' AND to_stage = 'Closed'
    AND requirement_type = 'child_record_status'
    AND requirement_detail::text = '{"record_type": "nda", "status": "approved"}'
);

-- PDPA assessment reviewed (placeholder)
INSERT INTO public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
SELECT 'test_bed', NULL, 'Decommissioning', 'Closed', 'child_record_status', '{"record_type": "pdpa_assessment", "status": "approved"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.stage_gate_rules
  WHERE record_type = 'test_bed' AND variant IS NULL
    AND from_stage = 'Decommissioning' AND to_stage = 'Closed'
    AND requirement_type = 'child_record_status'
    AND requirement_detail::text = '{"record_type": "pdpa_assessment", "status": "approved"}'
);

-- Data Protection Impact Assessment reviewed (placeholder)
INSERT INTO public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
SELECT 'test_bed', NULL, 'Decommissioning', 'Closed', 'child_record_status', '{"record_type": "dpia", "status": "approved"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.stage_gate_rules
  WHERE record_type = 'test_bed' AND variant IS NULL
    AND from_stage = 'Decommissioning' AND to_stage = 'Closed'
    AND requirement_type = 'child_record_status'
    AND requirement_detail::text = '{"record_type": "dpia", "status": "approved"}'
);
