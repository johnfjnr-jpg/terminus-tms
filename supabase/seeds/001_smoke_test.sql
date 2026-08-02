-- Smoke test stage gate rules
-- Proves the engine end-to-end: draft → active is blocked until an approved
-- Internal-track approval is recorded against the current revision.
--
-- Apply after the migration:
--   npx supabase db seed
-- Or paste into the Supabase Dashboard SQL editor.
-- Run once only — there is no unique constraint preventing duplicates.

insert into public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
select
  'smoke_test', null, 'draft', 'active', 'approval_obtained', '{"track": "Internal"}'
where not exists (
  select 1 from public.stage_gate_rules
  where record_type        = 'smoke_test'
    and variant            is null
    and from_stage         = 'draft'
    and to_stage           = 'active'
    and requirement_type   = 'approval_obtained'
    and requirement_detail = '{"track": "Internal"}'
);
