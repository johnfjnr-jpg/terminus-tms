-- Terminus TMS: immutability that binds the service role. Round 37 Phase 4.
--
-- ─────────────────────────────────────────────────────────────
-- WHY RLS WAS NEVER GOING TO BE THE MECHANISM
-- ─────────────────────────────────────────────────────────────
--
-- Round 36 Phase 1 declined to add a blanket refusal policy to
-- base_cost_batches, on the grounds that a policy on a table nothing points at
-- proves nothing. Round 37 Phase 3 built the pointer and scoped the version
-- update policy to `using (status = 'draft')`, which refuses the application
-- correctly.
--
-- IT REFUSES NOTHING ELSE. Postgres exempts roles with BYPASSRLS from every
-- policy, and Supabase's service role has it. Measured in Phase 4 rather than
-- reasoned about, by attempting the write and watching it land:
--
--   update an issued version, as the application    0 rows, unchanged
--   update an issued version, as the service role   1 row, reason overwritten
--   edit a cited batch, as the service role         1 row, unit_cost 8000 -> 7777
--
-- So a USING (false) policy would have passed review and refused nothing. It is
-- the same sentence this project has now reached from three directions: a
-- declared policy is not an enforcement, a rationale written beside a call is
-- not a guard, and a recorded decision is not a record of what happened.
--
-- TRIGGERS FIRE FOR EVERY ROLE, BYPASSRLS INCLUDED. That is the whole reason
-- this migration exists, and it protects the batches and the issued versions
-- with one mechanism.

-- ─────────────────────────────────────────────────────────────
-- 1. AN ISSUED VERSION CANNOT BE ALTERED, AND ISSUING IS THE ONE TRANSITION
-- ─────────────────────────────────────────────────────────────
--
-- The hard part is that issuing is itself an UPDATE to the row it freezes. A
-- draft is mutable, an issued version is not, and the relabel changes status and
-- number in the same statement. So the trigger cannot simply refuse updates to
-- rows that end up issued: it has to allow EXACTLY that transition and nothing
-- else.
--
-- Legal: draft -> issued, major becomes major + 1, minor becomes 0, issued_by
-- and issued_at get set. Everything that makes the version a record of a price
-- (the inputs, the rates, the batch pointer, the sections, the reason, the
-- author, the creation time) must be identical on both sides.
--
-- jsonb is compared to jsonb with IS DISTINCT FROM, never through a ::text
-- cast, per the standing rule: a cast comparison once duplicated rows on every
-- seed run because two equal jsonb values can have different text forms.
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

  -- OLD is a draft from here. A draft that stays a draft is freely editable.
  if NEW.status = 'draft' then
    return NEW;
  end if;

  -- draft -> issued: the relabel, and only the relabel.
  if NEW.major is distinct from OLD.major + 1 or NEW.minor is distinct from 0 then
    raise exception
      'deal_sheet_versions: issuing V%.% must produce V%.0, not V%.%',
      OLD.major, OLD.minor, OLD.major + 1, NEW.major, NEW.minor
      using errcode = 'restrict_violation';
  end if;

  if NEW.record_id  is distinct from OLD.record_id
  or NEW.reason     is distinct from OLD.reason
  or NEW.inputs     is distinct from OLD.inputs
  or NEW.rates      is distinct from OLD.rates
  or NEW.sections   is distinct from OLD.sections
  or NEW.batch_id   is distinct from OLD.batch_id
  or NEW.created_by is distinct from OLD.created_by
  or NEW.created_at is distinct from OLD.created_at then
    raise exception
      'deal_sheet_versions: issuing may set the status, number and issuer only, and must not alter what the version records (id %)',
      OLD.id
      using errcode = 'restrict_violation';
  end if;

  return NEW;
end;
$$;

drop trigger if exists deal_sheet_versions_immutable_trg on public.deal_sheet_versions;
create trigger deal_sheet_versions_immutable_trg
  before update on public.deal_sheet_versions
  for each row execute function public.deal_sheet_versions_immutable();

-- NO DELETE TRIGGER, and this is a decision rather than an omission.
--
-- The application already cannot delete: the table carries no delete policy, so
-- deny-by-default refuses it, measured in Phase 3 at zero rows affected. What a
-- delete trigger would add is blocking the OWNER, and that is the wrong trade.
-- "Immutable once issued" is a rule about ALTERATION - a version that says one
-- thing must never quietly say another. Making issued rows undeletable by
-- anyone would also make a fixture, a duplicate or a genuine mistake permanent,
-- with no path to remove it short of dropping the trigger, which is a worse
-- position than the one it defends against.

-- ─────────────────────────────────────────────────────────────
-- 2. A CITED BATCH CANNOT BE ALTERED
-- ─────────────────────────────────────────────────────────────
--
-- Round 36 recorded that a superseded batch must survive unchanged once
-- anything points at it, and deferred the enforcement to the round where a
-- citation exists. This is that round.
--
-- The foreign key already stops a cited batch being DELETED, and binds the
-- owner while doing it (measured in Phase 3: 23503, zero rows). It does nothing
-- about an EDIT, which is the case that matters more: a deleted batch is
-- obvious, and a batch quietly changed from 8000 to 7777 leaves every version
-- citing it describing a price that was never quoted.
--
-- Scoped to CITED batches only. An uncited batch stays freely editable in the
-- Supabase editor, which is the only maintenance path this build has, so a typo
-- caught before any version points at the batch is still a typo that can be
-- fixed.
create or replace function public.base_cost_batches_cited_immutable()
returns trigger
language plpgsql
as $$
declare
  citations integer;
begin
  select count(*) into citations
  from public.deal_sheet_versions v
  where v.batch_id = OLD.id;

  if citations > 0 then
    raise exception
      'base_cost_batches: batch "%" effective % is cited by % deal sheet version(s) and cannot be changed',
      OLD.batch_label, OLD.effective_from, citations
      using errcode = 'restrict_violation';
  end if;

  return NEW;
end;
$$;

drop trigger if exists base_cost_batches_cited_immutable_trg on public.base_cost_batches;
create trigger base_cost_batches_cited_immutable_trg
  before update on public.base_cost_batches
  for each row execute function public.base_cost_batches_cited_immutable();

comment on function public.deal_sheet_versions_immutable() is
  'Refuses any change to an issued version, and constrains the draft-to-issued '
  'relabel to the status, number and issuer. Runs as a trigger rather than as '
  'an RLS policy because Postgres exempts BYPASSRLS roles from policies and the '
  'service role has it, so a policy would refuse the application and nothing '
  'else. Measured in Round 37 Phase 4.';

comment on function public.base_cost_batches_cited_immutable() is
  'Refuses an edit to a batch that a deal sheet version cites. The foreign key '
  'already refuses the delete; this is the edit, which is the worse case, '
  'because a deleted batch is obvious and a silently changed one leaves every '
  'version citing it describing a price that was never quoted.';
