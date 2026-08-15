-- Terminus TMS: drop the UNIQUE constraint on records.reference_code
--
-- Real bug found live while building Milestone 5's reference_code
-- carryover (2026-08-15): PROTOTYPE_SPECIFICATION.md Section 6 and
-- DESIGN_PRINCIPLES.md are both explicit that on Test Bed -> Opportunity
-- conversion, "the reference code carries over unchanged, it is not
-- redrawn" and "the Test Bed record itself is not mutated in place, it
-- stays as the historical record" - meaning the same reference_code
-- value is meant to identify BOTH rows simultaneously and permanently
-- (one historical, one live), by design, not a transient race condition.
--
-- records_reference_code_key (added 20260815000001, plain `unique`
-- column constraint) makes that structurally impossible - the first real
-- attempt to carry a code over failed with
-- "duplicate key value violates unique constraint records_reference_code_key".
--
-- Dropping it entirely, not narrowing it, is the correct fix, not a
-- loosening of real protection: uniqueness of newly-ISSUED codes is
-- already guaranteed by issue_reference_number()'s own atomic counter
-- (INSERT ... ON CONFLICT DO UPDATE ... RETURNING, Milestone 1) - that
-- mechanism is what actually prevents two different engagements from
-- ever being issued the same code, not this column constraint. The only
-- legitimate source of a real duplicate value is this exact, deliberate
-- carry-over path, which needs one to exist.
alter table public.records
  drop constraint records_reference_code_key;

comment on column public.records.reference_code is
  'TT-{country}-{industry}-{number}, issued once via issue_reference_number() '
  'at creation, never reassigned. Null until something calls that function - '
  'an unset reference_code means "not yet generated", not a fabricated '
  'placeholder. Deliberately NOT unique at the database level (see '
  '20260815000007) - Test Bed to Opportunity conversion carries a Test '
  'Bed''s reference_code unchanged onto the new Opportunity while the '
  'Test Bed itself is never mutated, so exactly two rows legitimately '
  'share one code by design. Uniqueness of freshly-issued codes is '
  'guaranteed by issue_reference_number()''s atomic counter instead.';
