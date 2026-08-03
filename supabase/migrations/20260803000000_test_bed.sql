-- Terminus TMS: Test Bed
-- Architecture change: Opportunity drops the `type` field entirely.
-- Test Bed becomes its own top-level record type, not an Opportunity variant.

-- ─────────────────────────────────────────────────────────────
-- Clean up Opportunity variant data
-- Opportunity is always commercial; no `type` field, no variant.
-- ─────────────────────────────────────────────────────────────

-- Remove the R&D stage list (R&D is now Test Bed, not an Opportunity variant)
DELETE FROM public.stage_definitions
  WHERE record_type = 'opportunity' AND variant = 'R&D';

-- Opportunity stage definitions: clear variant ('Commercial' → NULL)
-- Safe: no (opportunity, NULL, stage_name) rows exist before this runs.
UPDATE public.stage_definitions
  SET variant = NULL
  WHERE record_type = 'opportunity' AND variant = 'Commercial';

-- Probability defaults: clear variant
UPDATE public.stage_probability_defaults
  SET variant = NULL
  WHERE record_type = 'opportunity' AND variant = 'Commercial';

-- Gate rules: clear variant (the Qualified → Proposal rule seeded in 002)
UPDATE public.stage_gate_rules
  SET variant = NULL
  WHERE record_type = 'opportunity' AND variant = 'Commercial';

-- Clear variant on any existing Opportunity records (test data from old model)
UPDATE public.records
  SET variant = NULL
  WHERE record_type = 'opportunity' AND variant IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- Test Bed stage definitions
-- ─────────────────────────────────────────────────────────────

INSERT INTO public.stage_definitions (record_type, variant, stage_name, sort_order)
VALUES
  ('test_bed', NULL, 'Planning',                1),
  ('test_bed', NULL, 'Deployment',              2),
  ('test_bed', NULL, 'Monitoring and Analysis', 3),
  ('test_bed', NULL, 'Review',                  4),
  ('test_bed', NULL, 'Decommissioning',         5),
  ('test_bed', NULL, 'Closed',                  6);
-- Note: ON CONFLICT (record_type, variant, stage_name) will not fire for NULL-variant rows
-- because PostgreSQL treats NULL != NULL in unique constraint checks.
-- These inserts are safe because this migration runs once and no prior test_bed rows exist.

-- ─────────────────────────────────────────────────────────────
-- Opportunity: add Test Bed conversion columns
-- An Opportunity created from a Test Bed carries the accumulated cost as a
-- starting cost input for the eventual Deal Sheet (same treatment as Pilot cost).
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.opportunity_details
  ADD COLUMN IF NOT EXISTS converted_from_test_bed_id UUID
    REFERENCES public.records(id) ON DELETE SET NULL;

ALTER TABLE public.opportunity_details
  ADD COLUMN IF NOT EXISTS test_bed_cost NUMERIC(12,2);

-- ─────────────────────────────────────────────────────────────
-- Senior approval track
-- Placeholder for the chart-of-authority tier that gates Test Bed
-- Decommissioning to Closed. Real tier assignment comes when routing_rules is built.
-- ─────────────────────────────────────────────────────────────

INSERT INTO public.approval_tracks (track_name, description)
  VALUES ('Senior', 'Senior-tier sign-off, required for Test Bed closure. Tier to be defined when routing_rules is built.')
  ON CONFLICT (track_name) DO NOTHING;
