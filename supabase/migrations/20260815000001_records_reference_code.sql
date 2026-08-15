-- Terminus TMS: reference_code column on records
--
-- Generic column, same pattern as industry_id/deleted_at
-- (20260812000001_contact_account.sql) - not a Test-Bed-specific table,
-- since Opportunity needs the identical column (same shared counter,
-- DESIGN_PRINCIPLES.md Section 9) even though wiring Opportunity's own
-- creation path to call issue_reference_number() is deliberately not
-- done here - out of this milestone's scope, logged as a known gap, not
-- fixed.
--
-- unique: the counter guarantees no two calls for the same prefix ever
-- return the same number, so a real duplicate here would mean a real
-- bug upstream - worth failing loudly on, not silently allowing.
alter table public.records
  add column if not exists reference_code text unique;

comment on column public.records.reference_code is
  'TT-{country}-{industry}-{number}, issued once via issue_reference_number() '
  'at creation, never reassigned. Null until something calls that function - '
  'an unset reference_code means "not yet generated", not a fabricated '
  'placeholder (matches the Opportunity Reference tab''s existing "Not yet '
  'generated" empty state, DESIGN_PRINCIPLES.md Rule 8). Carries over '
  'unchanged on Test Bed to Opportunity conversion (Milestone 5) - not '
  'redrawn, same identity across the type change.';
