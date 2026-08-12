-- Terminus TMS: correct Contact's mandatory-field split and qualify gate
--
-- Sourced precisely against Terminus Ops.dc.html this time, not the
-- earlier approximation from 20260812000001_contact_account.sql:
--   :7529 leadMandatoryFields (creation, 5 fields): name, company,
--     industry, email, mobile.
--   :5844 leadQualifyRequired (Unqualified -> Qualified, 14 fields): the
--     5 above plus jobRole, address, city, postcode, country, region,
--     linkedin, source, summary.
-- address2 (Address Line 2) and the Parked follow-up date are confirmed
-- absent from both sets - never mandatory anywhere.
--
-- jobRole/linkedin/address/address2/city/postcode/country/region are
-- plain record_revisions.payload keys, same as email/mobile/source/
-- summary already are - no new records columns, no DDL. company/
-- industry are still the real columns (parent_record_id/industry_id),
-- matching the existing RECORD_COLUMN_FIELDS handling in transitions.js.
--
-- No live Contact record exists at the time of this migration (checked
-- directly against the database - every record_type='contact' row
-- created during today's testing was soft-deleted along the way) and the
-- 8 backfilled Lead-to-Opportunity/Test-Bed record_contacts links are
-- record_type='lead', which this gate never applies to - so this is a
-- forward-looking change only, nothing live is affected.

delete from public.stage_gate_rules
  where record_type = 'contact' and from_stage = 'Unqualified' and to_stage = 'Qualified';

insert into public.stage_gate_rules (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail) values
  ('contact', null, 'Unqualified', 'Qualified', 'payload_field_required', '{"field":"name"}'),
  ('contact', null, 'Unqualified', 'Qualified', 'payload_field_required', '{"field":"parent_record_id"}'),
  ('contact', null, 'Unqualified', 'Qualified', 'payload_field_required', '{"field":"industry_id"}'),
  ('contact', null, 'Unqualified', 'Qualified', 'payload_field_required', '{"field":"email"}'),
  ('contact', null, 'Unqualified', 'Qualified', 'payload_field_required', '{"field":"mobile"}'),
  ('contact', null, 'Unqualified', 'Qualified', 'payload_field_required', '{"field":"jobRole"}'),
  ('contact', null, 'Unqualified', 'Qualified', 'payload_field_required', '{"field":"address"}'),
  ('contact', null, 'Unqualified', 'Qualified', 'payload_field_required', '{"field":"city"}'),
  ('contact', null, 'Unqualified', 'Qualified', 'payload_field_required', '{"field":"postcode"}'),
  ('contact', null, 'Unqualified', 'Qualified', 'payload_field_required', '{"field":"country"}'),
  ('contact', null, 'Unqualified', 'Qualified', 'payload_field_required', '{"field":"region"}'),
  ('contact', null, 'Unqualified', 'Qualified', 'payload_field_required', '{"field":"linkedin"}'),
  ('contact', null, 'Unqualified', 'Qualified', 'payload_field_required', '{"field":"source"}'),
  ('contact', null, 'Unqualified', 'Qualified', 'payload_field_required', '{"field":"summary"}');
