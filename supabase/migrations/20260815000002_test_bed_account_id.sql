-- Terminus TMS: Test Bed Account precondition, Milestone 3 (step 1 of 2)
--
-- account_id is a real, dedicated column, not a reuse of parent_record_id.
-- Checked before writing this: 2 of the 8 live, non-deleted test_bed
-- records already have parent_record_id set, pointing to old
-- record_type='lead' rows from a pre-record_contacts conversion mechanism
-- (contacts.js's own comment confirms this was superseded: "Both replace
-- the old parent_record_id link with a record_contacts row instead").
-- Reusing parent_record_id for the new Account link would silently
-- misread those 2 records' legacy Lead pointer as an Account. Both
-- PROTOTYPE_SPECIFICATION.md and TESTBED_BUILD_BRIEF.md already name this
-- field account_id, a distinct column - this migration follows that,
-- not parent_record_id.
--
-- Generic column on records, same pattern as industry_id
-- (20260812000001_contact_account.sql) - not a test_bed-specific table,
-- since a future record type (Opportunity, eventually) could plausibly
-- want the same link. Only test_bed gets a hard requirement today.
alter table public.records
  add column if not exists account_id uuid references public.records(id);

comment on column public.records.account_id is
  'Linked Account (record_type=account). Hard precondition at creation '
  'for test_bed (see the CHECK constraint below) - not enforced at the '
  'database level for any other record_type yet. References records(id) '
  'generically, same as parent_record_id; the app enforces that the '
  'target is actually record_type=''account'', the same convention '
  'parent_record_id already uses for Contact -> Account.';

-- record_type-conditioned requirement: account_id must be set for
-- test_bed rows, but every other record_type is free to leave it null.
-- A plain "not null" column default would have broken every existing
-- non-test_bed row (and every other record_type going forward); a
-- blanket CHECK requiring account_id universally would have done the
-- same. This is deliberately narrower - only test_bed is constrained -
-- so it can be relied on directly by the database, not just by
-- application-layer validation in the route handlers built next.
--
-- NOT VALID: there are 8 live, non-deleted test_bed records already in
-- the database (19 total including soft-deleted), all created before
-- this column existed, so all currently null. A validating ADD
-- CONSTRAINT would refuse to apply at all until every one of those was
-- given a real account_id - and there is no real Account to assign them
-- to without fabricating one, which is worse than leaving them as
-- honestly-grandfathered historical rows. NOT VALID skips checking
-- existing rows, and enforces strictly for every INSERT and UPDATE from
-- this point forward, same treatment already given to other
-- pre-existing-data gaps this build (child_record_status,
-- routing_rules) - logged and left alone, not silently patched over.
alter table public.records
  add constraint records_test_bed_requires_account_id
  check (record_type <> 'test_bed' or account_id is not null)
  not valid;

comment on constraint records_test_bed_requires_account_id on public.records is
  'Test Bed Milestone 3: account_id is a hard precondition at creation '
  'for test_bed records specifically, not a Qualification exit-gate '
  'field (PROTOTYPE_SPECIFICATION.md Section 6, "Account link"). '
  'Every other record_type is unaffected - the condition only bites '
  'when record_type = ''test_bed''.';
