-- Terminus TMS: a version carries the revision it was taken from. Round 38.
--
-- ─────────────────────────────────────────────────────────────
-- WHY, AND WHAT IT SETTLES
-- ─────────────────────────────────────────────────────────────
--
-- APPROVAL IS OF A VERSION. A revision is a save, and thirty saves can mean
-- nothing. A version is the commercial object: self-sufficient, reproducible,
-- carrying its own catalog rates and a mandatory reason, and it is what goes to
-- the customer and what an approver expects to sign.
--
-- The engine is not forked to say so. `approvals` stays keyed to a record
-- revision, which is deliberate and record-type agnostic: Test Beds, Contacts
-- and Opportunities all approve the same way, and a second approvals table
-- keyed to a Commercials-only concept would be exactly the fork the
-- architecture rules forbid. Instead the VERSION gains the link, and approving
-- V1.2 means approving the revision V1.2 names.
--
-- ─────────────────────────────────────────────────────────────
-- NULLABLE, AND NOT BACKFILLED
-- ─────────────────────────────────────────────────────────────
--
-- One version row exists that predates this column, and it is `issued`, which
-- deal_sheet_versions_immutable() refuses to change at all. Backfilling it would
-- mean either rewriting an immutable record or guessing which revision it came
-- from, and both are worse than a null that says "taken before versions recorded
-- this".
--
-- The variance is absorbed at the READ boundary, the same principle the numeric
-- payload work settled: a version with a null revision_number cannot be
-- approved, and the screen says why rather than the store being corrected.

alter table public.deal_sheet_versions
  add column if not exists revision_number integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'deal_sheet_versions_revision_positive'
  ) then
    alter table public.deal_sheet_versions
      add constraint deal_sheet_versions_revision_positive
      check (revision_number is null or revision_number > 0);
  end if;
end $$;

comment on column public.deal_sheet_versions.revision_number is
  'The record revision this version was taken from. Meaningful only because '
  'taking a version SAVES THE RECORD FIRST (Round 38 Phase 1), so the version '
  'holds the payload of the revision it names. Null on versions taken before '
  'this column existed; those cannot be approved.';

-- ─────────────────────────────────────────────────────────────
-- AND THE GUARD, IN THE SAME MIGRATION
-- ─────────────────────────────────────────────────────────────
--
-- 20260827000009 exists because 20260827000008 added created_by_email AFTER the
-- relabel guard listed the columns it protects, so the draft-to-issued relabel
-- could rewrite the author and nothing would have failed. That file's own
-- comment names the shape: "a guard that was complete for the columns that
-- existed when it was written, and silently incomplete one migration later".
--
-- This column is worth more to an attacker of the invariant than the author was:
-- a relabel that could move revision_number could point an approval at a
-- revision whose payload the version does not hold, which is the entire
-- guarantee. So the guard is extended in the same change that adds the column,
-- and scripts/tests/version-guard.test.mjs now fails if any future column is
-- added without being accounted for either way.
create or replace function public.deal_sheet_versions_immutable()
returns trigger
language plpgsql
as $$
begin
  if OLD.status = 'issued' then
    raise exception
      'deal_sheet_versions: V%.% is issued and cannot be changed (id %)',
      OLD.major, OLD.minor, OLD.id
      using errcode = 'restrict_violation';
  end if;

  if NEW.status = 'draft' then
    return NEW;
  end if;

  if NEW.major is distinct from OLD.major + 1 or NEW.minor is distinct from 0 then
    raise exception
      'deal_sheet_versions: issuing V%.% must produce V%.0, not V%.%',
      OLD.major, OLD.minor, OLD.major + 1, NEW.major, NEW.minor
      using errcode = 'restrict_violation';
  end if;

  if NEW.record_id        is distinct from OLD.record_id
  or NEW.reason           is distinct from OLD.reason
  or NEW.inputs           is distinct from OLD.inputs
  or NEW.rates            is distinct from OLD.rates
  or NEW.sections         is distinct from OLD.sections
  or NEW.batch_id         is distinct from OLD.batch_id
  or NEW.revision_number  is distinct from OLD.revision_number
  or NEW.created_by       is distinct from OLD.created_by
  or NEW.created_by_email is distinct from OLD.created_by_email
  or NEW.created_at       is distinct from OLD.created_at then
    raise exception
      'deal_sheet_versions: issuing may set the status, number and issuer only, and must not alter what the version records (id %)',
      OLD.id
      using errcode = 'restrict_violation';
  end if;

  return NEW;
end;
$$;
