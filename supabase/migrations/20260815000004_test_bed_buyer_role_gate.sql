-- Terminus TMS: Milestone 3, relationship-based stage_gate_rules requirement type
--
-- New requirement_type: contact_role_linked. requirement_detail = {role}.
-- Checks that a record_contacts row exists for (record_id, role) - a
-- relationship check, not a payload-field-presence check, which is what
-- payload_field_required already does and cannot express (checked first,
-- confirmed no existing mechanism does this: no HTTP endpoint currently
-- writes to record_contacts at all besides one internal helper hardcoded
-- to role='commercial buyer' at Test Bed/Opportunity creation, so this is
-- genuinely new mechanism, not an extension of an existing pattern).
--
-- Same convention as when payload_field_required was added
-- (20260812000001_contact_account.sql): drop and re-add the check
-- constraint with the new value included.
alter table public.stage_gate_rules
  drop constraint stage_gate_rules_requirement_type_check;

alter table public.stage_gate_rules
  add constraint stage_gate_rules_requirement_type_check
  check (requirement_type in ('document_status', 'approval_obtained', 'child_record_status', 'payload_field_required', 'contact_role_linked'));

-- Qualification -> Pre-Site Assessment now also requires the three buyer
-- roles, in addition to the three payload_field_required rows already
-- inserted in 20260815000000_test_bed_flat_stages.sql (testBedDuration,
-- estimatedInstallationDate, estGoLiveDate). A gate transition requires
-- ALL of its rows satisfied (existing stage_gate_rules semantics,
-- DESIGN_PRINCIPLES.md Section 2), so this adds three more conditions to
-- an already-existing gate, not a new gate.
--
-- Role strings are deliberately title-case ('Client Commercial Buyer'),
-- distinct from the existing lowercase 'commercial buyer' default role
-- already used by the record_contacts backfill/creation-time helper, so
-- the two are never visually or query-wise confused - one is "some
-- contact was linked at creation, unverified", the other is "this
-- specific client-side sign-off role is filled, validated against the
-- Test Bed's Account at save time".
insert into public.stage_gate_rules (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail) values
  ('test_bed', null, 'Qualification', 'Pre-Site Assessment', 'contact_role_linked', '{"role":"Client Commercial Buyer"}'),
  ('test_bed', null, 'Qualification', 'Pre-Site Assessment', 'contact_role_linked', '{"role":"Client Technical Buyer"}'),
  ('test_bed', null, 'Qualification', 'Pre-Site Assessment', 'contact_role_linked', '{"role":"Client Legal Buyer"}');

-- ─────────────────────────────────────────────────────────────
-- Naming decision for Milestone 4 (screens) to build against, no code
-- change here - neither the old nor new field names exist anywhere in
-- the live codebase yet
-- ─────────────────────────────────────────────────────────────
--
-- PROTOTYPE_SPECIFICATION.md Section 6 describes renaming a prototype
-- "Contacts" section (Commercial/Technical/Legal Contact) to Terminus
-- Commercial/Technical/Legal Owner, on the basis that the prototype's
-- sample data showed those fields populated with Terminus staff names.
-- Checked directly (2026-08-15) before treating that as something to
-- migrate: no live test_bed payload, past or present, has ever
-- contained commercial_contact/technical_contact/legal_contact/
-- initial_lead under any key naming convention, and no frontend for
-- Test Bed exists yet at all. There is no live data to migrate and no
-- field in this codebase to literally rename this milestone - this is
-- a naming decision recorded here for whoever builds Milestone 4's
-- Reference tab: use "Terminus Commercial/Technical/Legal Owner" as the
-- payload field names/labels from the start, do not build
-- "Commercial/Technical/Legal Contact" and rename later. Initial Lead
-- stays a separate field, the client-side originator of the engagement,
-- not one of the three buyer roles above and not one of the three
-- Owner fields either - three distinct concepts, not to be conflated.
