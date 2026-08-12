-- Terminus TMS: smoke_test stage_definitions
--
-- supabase/seeds/001_smoke_test.sql seeds a stage_gate_rules row for
-- smoke_test (draft -> active, requires an approved Internal-track
-- approval) but never seeded matching stage_definitions rows - it relied
-- on transitions.js's old "no stage list = skip validation" behavior.
-- That behavior was closed this session (POST /api/records/:id/transition
-- now rejects any to_stage when zero stage_definitions rows exist, rather
-- than treating an empty list as "anything goes" - see
-- src/routes/transitions.js), which would otherwise have silently broken
-- this smoke test's draft -> active demo for whoever runs it next.
--
-- Checked before writing: zero stage_definitions rows exist for
-- smoke_test today, so this is a plain insert, no conflict possible.
insert into public.stage_definitions (record_type, variant, stage_name, sort_order) values
  ('smoke_test', null, 'draft', 1),
  ('smoke_test', null, 'active', 2);
