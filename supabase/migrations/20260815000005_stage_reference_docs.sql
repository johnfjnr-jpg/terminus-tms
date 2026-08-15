-- Terminus TMS: stage_reference_docs, Milestone 4 close-out
--
-- Real gap found and confirmed by tracing the actual code, not inferred:
-- GET /test-beds/:id/document-requirements had exactly one data source,
-- stage_gate_rules rows with requirement_type='document_status'. Milestone
-- 2 deliberately left 6 of Test Bed's 7 transitions with zero gate rows
-- (documented, not invented), and the phase-grouping fallback is
-- permanently dead (phase is null on every stage_definitions row since
-- Milestone 2's flattening). Net effect: the endpoint returned [] for
-- every stage of every Test Bed, not just an "informational, correctly
-- empty" case - PROTOTYPE_SPECIFICATION.md Section 6's own per-stage
-- docs list ("Pre-Site Assessment: NDA", etc.) was never actually
-- surfaced anywhere, because informational display and gating had been
-- conflated into the same mechanism.
--
-- This table is the fix: purely informational, no gating logic anywhere
-- reads it (checked - only the endpoint built in this same migration's
-- companion code change queries it, nothing in transitions.js does).
-- Distinct from stage_gate_rules on purpose - a stage's reference
-- material and what blocks leaving it are two different concerns, and
-- Section 6 is explicit that these docs "do not block stage transition."
create table public.stage_reference_docs (
  id            uuid primary key default gen_random_uuid(),
  record_type   text not null,
  stage_name    text not null,
  document_name text not null,
  created_at    timestamptz not null default now()
);

comment on table public.stage_reference_docs is
  'Read-only, per-stage reference material (e.g. "while at Pre-Site '
  'Assessment, go get the NDA"), keyed by the CURRENT stage a record is '
  'in - not from_stage/to_stage like stage_gate_rules, since this has '
  'nothing to do with gating a transition. Purely informational, '
  'PROTOTYPE_SPECIFICATION.md Section 6: "They do not block stage '
  'transition." No code path reads this table for any gating decision.';

alter table public.stage_reference_docs enable row level security;

create policy "stage_reference_docs_select" on public.stage_reference_docs
  for select using (true);

-- Seed: the 6 stages with real doc content from PROTOTYPE_SPECIFICATION.md
-- Section 6's table (Qualification and Closed both list "none", so they
-- get no rows - an empty result for those stages is the honest answer,
-- not a gap). 8 rows total, Site Assessment has 3 real documents.
insert into public.stage_reference_docs (record_type, stage_name, document_name) values
  ('test_bed', 'Pre-Site Assessment', 'NDA'),
  ('test_bed', 'Site Assessment', 'Site Assessment Report'),
  ('test_bed', 'Site Assessment', 'Compliance and Data Protection'),
  ('test_bed', 'Site Assessment', 'Partnership and Test Bed Agreement'),
  ('test_bed', 'Installation and Commissioning', 'Site Installation Document'),
  ('test_bed', 'Monitoring and Analysis', 'Test Bed Review Document'),
  ('test_bed', 'Review and Completion', 'Test Bed Review Document'),
  ('test_bed', 'Decommissioning', 'Site Installation Document');
