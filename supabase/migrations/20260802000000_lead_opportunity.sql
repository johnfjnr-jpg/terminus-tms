-- Terminus TMS: Lead and Opportunity
-- Adds: records.variant, stage_probability_defaults, opportunity_details

-- ─────────────────────────────────────────────────────────────
-- Extend records with a generic variant column.
-- For opportunities this holds 'R&D' or 'Commercial'.
-- For all other record types it is null.
-- Stored here (not in opportunity_details) so the transition engine
-- can read it in a single query without a type-specific join.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.records ADD COLUMN IF NOT EXISTS variant TEXT;

CREATE INDEX IF NOT EXISTS records_variant_idx ON public.records(variant);

-- ─────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.stage_probability_defaults (
  id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type             TEXT         NOT NULL,
  variant                 TEXT,
  stage                   TEXT         NOT NULL,
  default_probability_pct NUMERIC(5,2) NOT NULL
    CHECK (default_probability_pct >= 0 AND default_probability_pct <= 100),
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (record_type, variant, stage)
);
COMMENT ON TABLE public.stage_probability_defaults IS
  'Admin-editable stage defaults. When an opportunity advances to a new stage, '
  'probability_pct is reset to this value. Sales leadership can retune without a deploy.';

-- opportunity_details holds the promoted fields that pipeline reporting filters and
-- sums on constantly. The opportunity type (R&D / Commercial) lives in records.variant,
-- not here, so the transition engine has it without a join.
CREATE TABLE IF NOT EXISTS public.opportunity_details (
  record_id            UUID         PRIMARY KEY
    REFERENCES public.records(id) ON DELETE CASCADE,
  probability_pct      NUMERIC(5,2) CHECK (probability_pct >= 0 AND probability_pct <= 100),
  forecast_close_date  DATE,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.opportunity_details IS
  'Promoted fields on Opportunity records. probability_pct is indexed because pipeline '
  'forecast reports sum over it constantly. forecast_close_date likewise.';

-- Reuse the set_updated_at() function defined in the M1 migration.
CREATE TRIGGER opportunity_details_updated_at
  BEFORE UPDATE ON public.opportunity_details
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS stage_probability_defaults_lookup_idx
  ON public.stage_probability_defaults(record_type, variant, stage);

CREATE INDEX IF NOT EXISTS opportunity_details_probability_idx
  ON public.opportunity_details(probability_pct);

CREATE INDEX IF NOT EXISTS opportunity_details_close_date_idx
  ON public.opportunity_details(forecast_close_date);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.stage_probability_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_details         ENABLE ROW LEVEL SECURITY;

-- stage_probability_defaults: read-only config for all authenticated users
CREATE POLICY "stage_probability_defaults_select" ON public.stage_probability_defaults
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- opportunity_details: owner of the linked record can read and write.
-- M2: owner-only, same pattern as records. M3: expand SELECT to roles table.
CREATE POLICY "opportunity_details_select" ON public.opportunity_details
  FOR SELECT USING (
    auth.uid() = (SELECT owner_id FROM public.records WHERE id = record_id)
  );

CREATE POLICY "opportunity_details_insert" ON public.opportunity_details
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT owner_id FROM public.records WHERE id = record_id)
  );

-- UPDATE is used by the transition engine to reset probability_pct after a stage change.
-- The transition runs under the owner's JWT so this policy is satisfied.
CREATE POLICY "opportunity_details_update" ON public.opportunity_details
  FOR UPDATE USING (
    auth.uid() = (SELECT owner_id FROM public.records WHERE id = record_id)
  );

-- ─────────────────────────────────────────────────────────────
-- Seed: stage probability defaults (Commercial variant)
-- Kept in migration alongside the table, same rationale as approval_tracks in M1:
-- these are structural config that the system needs to function from day one.
-- ─────────────────────────────────────────────────────────────

INSERT INTO public.stage_probability_defaults
  (record_type, variant, stage, default_probability_pct)
VALUES
  ('opportunity', 'Commercial', 'Discovery',    10),
  ('opportunity', 'Commercial', 'Qualified',    20),
  ('opportunity', 'Commercial', 'Proposal',     50),
  ('opportunity', 'Commercial', 'Evaluation',   60),
  ('opportunity', 'Commercial', 'Negotiation',  90),
  ('opportunity', 'Commercial', 'Closing',     100)
ON CONFLICT (record_type, variant, stage) DO NOTHING;
