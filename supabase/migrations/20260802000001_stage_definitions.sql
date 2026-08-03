-- Terminus TMS: Stage Definitions
-- Adds: stage_definitions table so each record_type/variant has its own
-- ordered list of valid stages, replacing the hardcoded six-stage assumption.

CREATE TABLE IF NOT EXISTS public.stage_definitions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type TEXT        NOT NULL,
  variant     TEXT,
  stage_name  TEXT        NOT NULL,
  sort_order  INT         NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (record_type, variant, stage_name)
);

COMMENT ON TABLE public.stage_definitions IS
  'Ordered stage lists per record_type/variant. The transition engine validates '
  'to_stage against this table; stage_gate_rules controls what approvals are needed '
  'on specific transitions. Both tables must be consistent.';

CREATE INDEX IF NOT EXISTS stage_definitions_lookup_idx
  ON public.stage_definitions(record_type, variant, sort_order);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.stage_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stage_definitions_select" ON public.stage_definitions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ─────────────────────────────────────────────────────────────
-- Seed: stage lists for Commercial and R&D opportunity variants
-- Inline here for the same reason as stage_probability_defaults:
-- structural config the system needs to function from day one.
-- ─────────────────────────────────────────────────────────────

INSERT INTO public.stage_definitions (record_type, variant, stage_name, sort_order)
VALUES
  ('opportunity', 'Commercial', 'Discovery',               1),
  ('opportunity', 'Commercial', 'Qualified',               2),
  ('opportunity', 'Commercial', 'Proposal',                3),
  ('opportunity', 'Commercial', 'Evaluation',              4),
  ('opportunity', 'Commercial', 'Negotiation',             5),
  ('opportunity', 'Commercial', 'Closing',                 6),
  ('opportunity', 'R&D',        'Planning',                1),
  ('opportunity', 'R&D',        'Deployment',              2),
  ('opportunity', 'R&D',        'Monitoring and Analysis', 3),
  ('opportunity', 'R&D',        'Review',                  4),
  ('opportunity', 'R&D',        'Decommissioning',         5)
ON CONFLICT (record_type, variant, stage_name) DO NOTHING;
