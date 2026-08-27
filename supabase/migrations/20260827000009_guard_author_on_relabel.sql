-- Terminus TMS: the author is part of what a version records. Round 37 Phase 4.
--
-- 20260827000007 constrained the draft-to-issued relabel to the status, the
-- number and the issuer, listing every column that must be identical on both
-- sides. 20260827000008 then added created_by_email, AFTER that list was
-- written, so the relabel could rewrite the author without the trigger noticing.
--
-- That is the Architecture rule 9 shape in miniature: a guard that was complete
-- for the columns that existed when it was written, and silently incomplete one
-- migration later. Caught by re-reading the guard against the new column rather
-- than by anything failing, because nothing would have.
--
-- created_by stays guarded as the referential truth and created_by_email joins
-- it as the readable half. issued_by_email is deliberately NOT guarded: it is
-- null on a draft and set by the relabel, which is the transition itself.
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
