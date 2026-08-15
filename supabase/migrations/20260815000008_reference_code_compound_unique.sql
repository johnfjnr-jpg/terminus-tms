-- Terminus TMS: compound UNIQUE on (reference_code, record_type)
--
-- 20260815000007 dropped the plain UNIQUE on reference_code entirely to
-- unblock Milestone 5's conversion carryover (a Test Bed and the
-- Opportunity converted from it deliberately share one code, by design -
-- the Test Bed is never mutated and keeps it, the new Opportunity
-- inherits it unchanged). That fix was correct but broader than it
-- needed to be: it also allowed two records of the SAME type to
-- collide, which is a real bug, not a deliberate case - nothing in this
-- system ever wants two Test Beds, or two Opportunities, sharing a code.
--
-- (reference_code, record_type) restores that protection precisely:
-- rejects two test_bed rows (or two opportunity rows) with the same
-- code, while still permitting the one legitimate case, a test_bed row
-- and the one opportunity row converted from it sharing a code, since
-- their record_type differs.
--
-- NULLs are unaffected either way - Postgres treats each NULL as
-- distinct for uniqueness purposes, so the many records with no
-- reference_code yet (the honest "not yet generated" state) never
-- collide with each other under either the old or new constraint.
alter table public.records
  add constraint records_reference_code_record_type_key unique (reference_code, record_type);

comment on column public.records.reference_code is
  'TT-{country}-{industry}-{number}, issued once via issue_reference_number() '
  'at creation, never reassigned. Null until something calls that function - '
  'an unset reference_code means "not yet generated", not a fabricated '
  'placeholder. Unique per (reference_code, record_type), not unique alone '
  '(20260815000008) - Test Bed to Opportunity conversion deliberately '
  'carries a Test Bed''s reference_code unchanged onto the new Opportunity '
  'while the Test Bed itself is never mutated, so exactly one test_bed row '
  'and one opportunity row may legitimately share a code. Two rows of the '
  'SAME record_type sharing a code is still rejected by the database, not '
  'just prevented by issue_reference_number()''s counter.';
