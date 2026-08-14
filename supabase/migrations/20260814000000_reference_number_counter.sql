-- Terminus TMS: Reference number generator, atomic counter
--
-- DESIGN_PRINCIPLES.md Section 9 / PROTOTYPE_SPECIFICATION.md Section 2b /
-- TESTBED_BUILD_BRIEF.md Milestone 1. Format TT-{country}-{industry}-{number},
-- e.g. TT-GBR-SMARTC-001. One counter per country+industry prefix, shared by
-- Test Bed and Opportunity records (both draw from the same sequence), never
-- reused even after a record is deleted.
--
-- The prototype's own nextRecordRef() scans every existing Test Bed/
-- Opportunity record on every call to find the current max and returns
-- max + 1 - correct for a single-user, single-tab prototype, unsafe here:
-- two concurrent requests for the same prefix could both scan, both see the
-- same current max, and both get issued the same number. This migration
-- replaces that with a real atomic counter, a highwater table incremented
-- via INSERT ... ON CONFLICT DO UPDATE ... RETURNING, which Postgres
-- serializes at the row level - two concurrent callers for the same prefix
-- can never both walk away with the same returned value, the second caller
-- genuinely blocks on the row lock until the first commits, unlike a
-- read-then-write counter where both could read before either writes.
--
-- This table stores only the running highwater mark per prefix, not a log
-- of every issued number - "never reused, even after deletion" falls out
-- naturally from that: deleting a records row doesn't touch this table at
-- all, so the counter has no way to know a number is "free" again.
create table if not exists public.reference_number_counters (
  prefix        text        primary key,
  current_value integer     not null default 0,
  updated_at    timestamptz not null default now()
);

comment on table public.reference_number_counters is
  'Atomic highwater counter per country+industry prefix (e.g. GBR-SMARTC), '
  'feeding the TT-{country}-{industry}-{number} reference format shared by '
  'Test Bed and Opportunity records. Not a log of issued numbers - deleting '
  'a record never frees its number back up, matching the "never reused" '
  'rule in DESIGN_PRINCIPLES.md Section 9 / PROTOTYPE_SPECIFICATION.md '
  'Section 2b. Written only through issue_reference_number() below, never '
  'directly - see that function''s own comment for why.';

-- Deny-by-default, deliberately no policies at all: this table is only
-- ever touched through issue_reference_number() (security definer, so it
-- runs with the table owner's privileges regardless of RLS), never
-- through a direct insert/update/select from application code. Matches
-- this project's existing pattern of RLS-enabled-with-no-policies for
-- tables meant to be reached only through a controlled path, not
-- browsable/writable directly (record_revisions, audit_log).
alter table public.reference_number_counters enable row level security;

-- Explicit, distinct call - "issue a new reference number" - not a
-- trigger on any table's insert. Deliberate (TESTBED_BUILD_BRIEF.md
-- Milestone 1, PROTOTYPE_SPECIFICATION.md Section 2b): a future Test Bed
-- to Opportunity conversion must create the new Opportunity record
-- carrying the source Test Bed's existing reference number unchanged, not
-- draw a fresh one - if this were wired to fire automatically on every
-- records insert, that conversion could never create its row without
-- also consuming a counter value it doesn't want. Callers that DO want a
-- new number call this function explicitly at creation time; a
-- conversion path simply never calls it, no bypass flag or special case
-- needed on this side.
--
-- security definer: application code calls this as an authenticated
-- user, who has no direct grants on reference_number_counters at all
-- (see the table's own RLS comment above) - the function needs to run
-- with the definer's (table owner's) privileges to reach the table
-- regardless of who's calling it, the same reason set_updated_at()'s
-- trigger doesn't need this (triggers already run with the underlying
-- statement's privileges on the table being written) but a function
-- reaching a *different*, deliberately locked-down table does.
--
-- lpad(..., 3, '0') is what gives 001 through 999 the fixed 3-digit
-- form and then naturally stops padding once the number is already
-- longer than 3 digits (1000 stays "1000", never truncated or wrapped),
-- matching "never resets, grows past 999 by adding digits" - no special
-- case needed for the rollover point, lpad already does the right thing
-- on both sides of it.
create or replace function public.issue_reference_number(p_country_code text, p_industry_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text := p_country_code || '-' || p_industry_code;
  v_next   integer;
begin
  if p_country_code is null or p_country_code = '' then
    raise exception 'issue_reference_number: p_country_code is required';
  end if;
  if p_industry_code is null or p_industry_code = '' then
    raise exception 'issue_reference_number: p_industry_code is required';
  end if;

  insert into public.reference_number_counters (prefix, current_value)
  values (v_prefix, 1)
  on conflict (prefix) do update
    set current_value = reference_number_counters.current_value + 1,
        updated_at = now()
  returning current_value into v_next;

  return 'TT-' || v_prefix || '-' || lpad(v_next::text, 3, '0');
end;
$$;

comment on function public.issue_reference_number(text, text) is
  'Atomically issues the next TT-{country}-{industry}-{number} reference '
  'for the given country+industry prefix. Explicit call only, never fired '
  'implicitly by a records insert - a future Test Bed to Opportunity '
  'conversion must not call this, it carries the source record''s existing '
  'reference over unchanged instead.';

revoke all on public.reference_number_counters from authenticated, anon;
grant execute on function public.issue_reference_number(text, text) to authenticated;
