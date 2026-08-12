-- Terminus TMS: Contact and Account record types
--
-- Contact and Account are plain records (record_type = 'contact' /
-- 'account'), no new bespoke tables - per DESIGN_PRINCIPLES Section 2's
-- Lead/Contact/Account model. "Lead" is business language for the
-- Unqualified stage on the same Contact record, not a separate record_type
-- or a conversion - there is no structural change here from that decision,
-- Contact throughout.
--
-- record_contacts (the Contact <-> Opportunity/Test Bed many-to-many) is
-- deliberately not part of this migration - Contact -> Account below is an
-- ordinary single-parent relationship (parent_record_id), a different,
-- simpler thing than the reusable many-to-many link, which is its own
-- later piece of work.

-- industry_id and deleted_at are generic columns on records, not
-- Contact/Account-specific ones, matching how parent_record_id already
-- generalizes across record types rather than forking per type.
alter table public.records
  add column if not exists industry_id uuid references public.industries(id),
  add column if not exists deleted_at timestamptz;

create index if not exists records_industry_id_idx on public.records(industry_id);

comment on column public.records.deleted_at is
  'Soft delete. Set by Contact''s DELETE endpoint for genuinely time-wasting '
  'entries, distinct from the Parked stage (real interest, not viable yet). '
  'No cascading, record_revisions and audit_log are untouched, no new DELETE '
  'RLS policy - deleted_at is filtered at the application query level.';

-- Contact stage list: Unqualified -> Qualified -> Parked, a branch, not a
-- line - Parked can return to Unqualified or go straight to Qualified. The
-- transition engine imposes no forward/backward sequence of its own, so no
-- changes to transitions.js's stage validation are needed for this shape,
-- only the new payload_field_required gate check below.
--
-- No ON CONFLICT here: stage_definitions has no unique constraint on
-- (record_type, variant, stage_name) (confirmed against the schema - only
-- an index on (record_type, variant, sort_order)), matching the same plain
-- INSERT already used for test_bed's stages, safe since this migration
-- runs once and no prior 'contact' rows exist.
insert into public.stage_definitions (record_type, variant, stage_name, sort_order) values
  ('contact', null, 'Unqualified', 1),
  ('contact', null, 'Qualified', 2),
  ('contact', null, 'Parked', 3);

-- payload_field_required: a new stage_gate_rules requirement_type, checked
-- generically inside POST /api/records/:id/transition alongside the
-- existing approval_obtained/document_status checks (see transitions.js).
-- requirement_detail = {field}. Two fields, parent_record_id (the Account
-- link, "Company" in the UI) and industry_id, are real columns on records
-- rather than payload keys - the transition endpoint reads the record row
-- for those two specifically and the current revision's payload for
-- everything else.
--
-- requirement_type's check constraint only allowed the original three
-- values (document_status, approval_obtained, child_record_status) -
-- payload_field_required must be added to it before the insert below, or
-- every row here is rejected with a check-constraint violation
-- (stage_gate_rules_requirement_type_check).
alter table public.stage_gate_rules
  drop constraint stage_gate_rules_requirement_type_check;

alter table public.stage_gate_rules
  add constraint stage_gate_rules_requirement_type_check
  check (requirement_type in ('document_status', 'approval_obtained', 'child_record_status', 'payload_field_required'));

-- Two independent uses of the same mechanism:
--   Unqualified -> Parked requires followUpDate (must already be saved via
--     PATCH /api/contacts/:id before the transition is attempted).
--   Unqualified -> Qualified requires every mandatory field from creation
--     to still be complete, the safety net for the case where one gets
--     cleared by a later edit (creation itself already validates all of
--     these up front, so this gate is a backstop, not the primary check).
insert into public.stage_gate_rules (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail) values
  ('contact', null, 'Unqualified', 'Parked',    'payload_field_required', '{"field":"followUpDate"}'),
  ('contact', null, 'Unqualified', 'Qualified', 'payload_field_required', '{"field":"name"}'),
  ('contact', null, 'Unqualified', 'Qualified', 'payload_field_required', '{"field":"parent_record_id"}'),
  ('contact', null, 'Unqualified', 'Qualified', 'payload_field_required', '{"field":"email"}'),
  ('contact', null, 'Unqualified', 'Qualified', 'payload_field_required', '{"field":"mobile"}'),
  ('contact', null, 'Unqualified', 'Qualified', 'payload_field_required', '{"field":"industry_id"}'),
  ('contact', null, 'Unqualified', 'Qualified', 'payload_field_required', '{"field":"source"}'),
  ('contact', null, 'Unqualified', 'Qualified', 'payload_field_required', '{"field":"summary"}');
