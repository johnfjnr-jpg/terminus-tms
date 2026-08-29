-- Terminus TMS: a record-level freshness precondition. Round 38, condition 6a.
--
-- ─────────────────────────────────────────────────────────────
-- WHAT EXISTED, AND WHY IT IS NOT ENOUGH
-- ─────────────────────────────────────────────────────────────
--
-- Three per-FIELD freshness checks exist, all the same shape and all in the
-- browser: Contract Duration on Commercials, Customer Lead on the Opportunity
-- Reference tab, and Initial Lead on Test Bed. Each one GETs the record, compares
-- one field against the value it held at page load, and refuses the whole save
-- if it moved.
--
-- Two properties follow, and both are why a record-level guard is needed:
--
--   THEY ARE READ-THEN-WRITE, NOT COMPARE-AND-SWAP. The GET and the PATCH are
--   separate round trips, so a write landing between them is invisible. The
--   window is small and it is not zero.
--
--   THEY COVER ONE FIELD EACH. Every other key on the payload merges
--   last-writer-wins with nothing checked, which append_record_revision's own
--   comment already names as a separate concern deferred to "Phase 2".
--
-- ─────────────────────────────────────────────────────────────
-- WHY revision_number, AND WHY HERE
-- ─────────────────────────────────────────────────────────────
--
-- record_revisions.revision_number is a monotonic integer allocated INSIDE the
-- advisory transaction lock this function already takes. records.updated_at was
-- the alternative and is worse for this: it is a timestamp, it is maintained by
-- a trigger on a different table from the one being merged, and comparing
-- clocks introduces a precision question that an integer does not have.
--
-- The check goes inside the existing pg_advisory_xact_lock, which is what makes
-- it a genuine compare-and-swap rather than a fourth read-then-write. Between
-- the caller's expectation being tested and the new revision being written,
-- nothing else can write to this record.
--
-- OPTIONAL, DELIBERATELY. p_expected_revision defaults to null, meaning "do not
-- check", so every existing caller keeps its current behaviour and this
-- migration changes no path that does not opt in. A guard that forced every
-- caller to be rewritten in the same change would have been reverted under the
-- first thing it broke.

create or replace function public.append_record_revision(
  p_record_id         uuid,
  p_patch             jsonb,
  p_created_by        uuid,
  p_remove            text[] default '{}'::text[],
  p_expected_revision integer default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_next    integer;
  v_payload jsonb;
  v_current integer;
begin
  if p_record_id is null then
    raise exception 'append_record_revision: p_record_id is required';
  end if;
  if p_created_by is null then
    raise exception 'append_record_revision: p_created_by is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_record_id::text, 0));

  select r.revision_number + 1,
         (coalesce(r.payload, '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb))
           - coalesce(p_remove, '{}'::text[])
    into v_next, v_payload
    from public.record_revisions r
   where r.record_id = p_record_id
   order by r.revision_number desc
   limit 1;

  if v_next is null then
    v_next := 1;
    v_payload := coalesce(p_patch, '{}'::jsonb) - coalesce(p_remove, '{}'::text[]);
  end if;

  -- THE PRECONDITION. v_next - 1 is the revision the caller merged against;
  -- v_next - 1 = 0 means the record has no revisions yet.
  --
  -- Raised with a distinguishable SQLSTATE so the route can answer 409 rather
  -- than 500: a stale write is a conflict the user can resolve by reloading,
  -- not a server fault.
  if p_expected_revision is not null then
    v_current := v_next - 1;
    if v_current <> p_expected_revision then
      raise exception
        'stale write: this record moved to revision % while the screen held revision %',
        v_current, p_expected_revision
        using errcode = '40001';
    end if;
  end if;

  insert into public.record_revisions (record_id, revision_number, payload, created_by)
  values (p_record_id, v_next, v_payload, p_created_by);

  return jsonb_build_object('revision_number', v_next, 'payload', v_payload);
end;
$$;

comment on function public.append_record_revision(uuid, jsonb, uuid, text[], integer) is
  'Appends the next revision under an advisory lock on the record. '
  'p_expected_revision, when supplied, makes the write CONDITIONAL on the '
  'record still being at that revision, checked inside the same lock so it is a '
  'compare-and-swap rather than a read-then-write. Raises SQLSTATE 40001 on a '
  'stale write so a route can answer 409. Null means do not check, which keeps '
  'every caller that has not opted in behaving exactly as before.';
