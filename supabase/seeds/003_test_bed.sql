-- Test Bed stage gate rules.
-- Single gate within Planning (NDA must be signed before Site Assessment).
-- All other Planning documents can be worked on freely from Site Assessment.
-- Hard gate: ALL five planning documents must be approved before leaving Planning
-- (CaDP → Installation and Commissioning).

-- NDA → Site Assessment: NDA must be approved
INSERT INTO public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
SELECT 'test_bed', NULL, 'NDA', 'Site Assessment', 'document_status',
       '{"document": "NDA", "status": "approved"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.stage_gate_rules
  WHERE record_type = 'test_bed' AND variant IS NULL
    AND from_stage = 'NDA' AND to_stage = 'Site Assessment'
    AND requirement_type = 'document_status'
    AND requirement_detail::text = '{"document": "NDA", "status": "approved"}'
);

-- CaDP → Installation and Commissioning: all five planning documents required.
-- No order between them; all must be approved before this transition.

INSERT INTO public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
SELECT 'test_bed', NULL,
       'Compliance and Data Protection', 'Installation and Commissioning',
       'document_status', '{"document": "NDA", "status": "approved"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.stage_gate_rules
  WHERE record_type = 'test_bed' AND variant IS NULL
    AND from_stage = 'Compliance and Data Protection'
    AND to_stage = 'Installation and Commissioning'
    AND requirement_type = 'document_status'
    AND requirement_detail::text = '{"document": "NDA", "status": "approved"}'
);

INSERT INTO public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
SELECT 'test_bed', NULL,
       'Compliance and Data Protection', 'Installation and Commissioning',
       'document_status', '{"document": "Site Assessment", "status": "approved"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.stage_gate_rules
  WHERE record_type = 'test_bed' AND variant IS NULL
    AND from_stage = 'Compliance and Data Protection'
    AND to_stage = 'Installation and Commissioning'
    AND requirement_type = 'document_status'
    AND requirement_detail::text = '{"document": "Site Assessment", "status": "approved"}'
);

INSERT INTO public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
SELECT 'test_bed', NULL,
       'Compliance and Data Protection', 'Installation and Commissioning',
       'document_status',
       '{"document": "Partnership and Test Bed Agreement", "status": "approved"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.stage_gate_rules
  WHERE record_type = 'test_bed' AND variant IS NULL
    AND from_stage = 'Compliance and Data Protection'
    AND to_stage = 'Installation and Commissioning'
    AND requirement_type = 'document_status'
    AND requirement_detail::text =
        '{"document": "Partnership and Test Bed Agreement", "status": "approved"}'
);

INSERT INTO public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
SELECT 'test_bed', NULL,
       'Compliance and Data Protection', 'Installation and Commissioning',
       'document_status', '{"document": "DPIA", "status": "approved"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.stage_gate_rules
  WHERE record_type = 'test_bed' AND variant IS NULL
    AND from_stage = 'Compliance and Data Protection'
    AND to_stage = 'Installation and Commissioning'
    AND requirement_type = 'document_status'
    AND requirement_detail::text = '{"document": "DPIA", "status": "approved"}'
);

INSERT INTO public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
SELECT 'test_bed', NULL,
       'Compliance and Data Protection', 'Installation and Commissioning',
       'document_status', '{"document": "APD", "status": "approved"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.stage_gate_rules
  WHERE record_type = 'test_bed' AND variant IS NULL
    AND from_stage = 'Compliance and Data Protection'
    AND to_stage = 'Installation and Commissioning'
    AND requirement_type = 'document_status'
    AND requirement_detail::text = '{"document": "APD", "status": "approved"}'
);

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
    AND requirement_detail::text = '{"track": "Senior"}'
);

-- NDA reviewed (placeholder, child_record_status not yet enforced)
INSERT INTO public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
SELECT 'test_bed', NULL, 'Decommissioning', 'Closed', 'child_record_status',
       '{"record_type": "nda", "status": "approved"}'
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
SELECT 'test_bed', NULL, 'Decommissioning', 'Closed', 'child_record_status',
       '{"record_type": "pdpa_assessment", "status": "approved"}'
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
SELECT 'test_bed', NULL, 'Decommissioning', 'Closed', 'child_record_status',
       '{"record_type": "dpia", "status": "approved"}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.stage_gate_rules
  WHERE record_type = 'test_bed' AND variant IS NULL
    AND from_stage = 'Decommissioning' AND to_stage = 'Closed'
    AND requirement_type = 'child_record_status'
    AND requirement_detail::text = '{"record_type": "dpia", "status": "approved"}'
);
