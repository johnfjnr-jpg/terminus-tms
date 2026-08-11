-- Migration 20260803000003_document_details.sql
--
-- 1. Creates document_details table (stores optional Google Drive URL per document record)
-- 2. Renames Deployment → Installation and Commissioning
-- 3. Removes within-Planning sub-stage gate rules (only NDA→Site Assessment kept)
-- 4. Standardises all document gate status values to "approved"
-- 5. Adds the full CaDP → Installation and Commissioning document gate set
-- 6. Migrates existing document records to "approved" status

-- ── document_details ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.document_details (
  record_id         UUID PRIMARY KEY REFERENCES public.records(id) ON DELETE CASCADE,
  document_location TEXT
);

ALTER TABLE public.document_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rls_document_details" ON public.document_details
  FOR ALL
  USING (record_id IN (SELECT id FROM public.records))
  WITH CHECK (record_id IN (SELECT id FROM public.records));

-- ── Rename Deployment → Installation and Commissioning ────────────────────────
UPDATE public.stage_definitions
  SET stage_name = 'Installation and Commissioning'
  WHERE record_type = 'test_bed' AND stage_name = 'Deployment';

UPDATE public.stage_gate_rules
  SET from_stage = 'Installation and Commissioning'
  WHERE record_type = 'test_bed' AND from_stage = 'Deployment';

UPDATE public.stage_gate_rules
  SET to_stage = 'Installation and Commissioning'
  WHERE record_type = 'test_bed' AND to_stage = 'Deployment';

UPDATE public.records
  SET status = 'Installation and Commissioning'
  WHERE record_type = 'test_bed' AND status = 'Deployment';

-- ── Remove within-Planning sub-stage gates (Site Assessment → PaTBA, PaTBA → CaDP) ──
DELETE FROM public.stage_gate_rules
  WHERE record_type = 'test_bed'
    AND requirement_type = 'document_status'
    AND (
      (from_stage = 'Site Assessment'
        AND to_stage = 'Partnership and Test Bed Agreement')
      OR (from_stage = 'Partnership and Test Bed Agreement'
        AND to_stage = 'Compliance and Data Protection')
    );

-- ── Standardise gate rule document status values → "approved" ─────────────────
UPDATE public.stage_gate_rules
  SET requirement_detail = jsonb_set(requirement_detail, '{status}', '"approved"')
  WHERE record_type = 'test_bed'
    AND requirement_type = 'document_status'
    AND requirement_detail->>'status' IN ('signed', 'complete');

-- ── Add NDA, Site Assessment, PaTBA gates for CaDP → Installation and Commissioning ──
-- DPIA and APD gates already exist (renamed from → Deployment above)
INSERT INTO public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
VALUES
  ('test_bed', NULL,
   'Compliance and Data Protection', 'Installation and Commissioning',
   'document_status', '{"document": "NDA", "status": "approved"}'),
  ('test_bed', NULL,
   'Compliance and Data Protection', 'Installation and Commissioning',
   'document_status', '{"document": "Site Assessment", "status": "approved"}'),
  ('test_bed', NULL,
   'Compliance and Data Protection', 'Installation and Commissioning',
   'document_status',
   '{"document": "Partnership and Test Bed Agreement", "status": "approved"}');

-- ── Migrate existing document records ─────────────────────────────────────────
UPDATE public.records
  SET status = 'approved'
  WHERE record_type = 'document'
    AND status IN ('signed', 'complete');
