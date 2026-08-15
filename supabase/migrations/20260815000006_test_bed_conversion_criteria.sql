-- Terminus TMS: Milestone 5, Test Bed -> Opportunity conversion_criteria
--
-- Real gap confirmed by direct code inspection (2026-08-15): conversion_
-- criteria has existed as a table since the initial schema but is never
-- queried anywhere in this codebase, not by Test Bed's /convert, not by
-- Contact's create-opportunity/create-test-bed either. Real data showed
-- one Test Bed converted six separate times before this fix.
--
-- Business decision, confirmed: a Test Bed converts only once.
-- Data-driven per DESIGN_PRINCIPLES.md rule 3 (chart-of-authority-style
-- limits live in data, not hardcoded) - max_conversions lives in
-- condition, not a hardcoded "1" in /convert's application code, same
-- reasoning stage_gate_rules already uses for approval/document
-- thresholds. No row for a given from/to pair means that conversion path
-- isn't defined at all, same invariant already established for
-- stage_definitions (empty list rejects every transition, not "anything
-- goes") - /convert checks for a row's existence before checking the
-- count.
insert into public.conversion_criteria (from_record_type, to_record_type, condition) values
  ('test_bed', 'opportunity', '{"max_conversions": 1}');
