-- Terminus TMS: one atomic writer for every record revision.
-- Round 17A Phase 1, 2026-08-21. Written idempotently per Architecture rule 7.
--
-- WHAT THIS FIXES. Nine call sites read the highest revision_number, add one
-- in JS, and insert, with no transaction, no lock, no sequence and no retry.
-- Two writers to one record both read N and both compute N+1, and the unique
-- constraint (record_id, revision_number) refuses the loser with a raw 23505.
-- Round 17A Phase 0 measured it: two concurrent writes collided in 10 of 10
-- trials, and ten concurrent writes lost 82% of requests.
--
-- WHY THE MERGE MOVES IN HERE TOO, which is the half that is easy to skip.
-- Today one JS read supplies both the revision number and the payload being
-- merged. Making only the numbering atomic would let both writers succeed at
-- different numbers, each having merged its own field into the same stale
-- payload, so the second silently drops the first's field. Phase 0 already
-- produced that outcome from the current race: three values entered, one
-- stored, one absent, one still holding a previous value, and the row reading
-- "Saved". Numbering alone would make that the normal result rather than the
-- collision result, trading a loud failure for a silent loss. The patch is
-- therefore merged inside the same statement that computes the number, so the
-- read that supplies the number and the read that supplies the payload are
-- the same read.
--
-- SECURITY INVOKER, DELIBERATELY, AND THIS IS THE ONE PLACE THIS FUNCTION
-- DIVERGES FROM issue_reference_number's SHAPE. That function is security
-- definer because reference_number_counters has RLS enabled with no policies
-- at all and is reachable only through it. record_revisions is the opposite:
-- it carries a real insert policy,
--     auth.uid() = created_by
--     and auth.uid() = (select owner_id from records where id = record_id)
-- which is the owner check open item 32 is about. A security definer function
-- would bypass that policy and let any authenticated user write a revision to
-- any record, which is a silent and severe permission widening dressed up as
-- a bug fix. Invoker keeps the policy exactly where it is and exactly as
-- strict as it is today: this change must be invisible to permissions.
--
-- WHY AN ADVISORY LOCK RATHER THAN SELECT ... FOR UPDATE ON records.
-- Locking the parent row would serialize correctly, but under RLS a locking
-- read also applies the UPDATE policy, and records_update is
-- auth.uid() = owner_id. That would make taking the lock fail for exactly the
-- non-owner case open item 32 already describes, entangling this fix with a
-- security decision that belongs in its own change. pg_advisory_xact_lock
-- needs no privilege on any table, is keyed per record so writers to
-- different records never contend, and is released automatically when the
-- function's transaction commits.
--
-- THE UNIQUE CONSTRAINT STAYS. It stops being the mechanism and becomes the
-- backstop. Anything that bypasses this function in future still cannot land
-- a duplicate revision number silently.
create or replace function public.append_record_revision(
  p_record_id  uuid,
  p_patch      jsonb,
  p_created_by uuid
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_next    integer;
  v_payload jsonb;
begin
  if p_record_id is null then
    raise exception 'append_record_revision: p_record_id is required';
  end if;
  if p_created_by is null then
    raise exception 'append_record_revision: p_created_by is required';
  end if;

  -- Serializes writers for THIS record only. Held until this function's
  -- transaction commits, so the next writer's read sees this writer's row.
  perform pg_advisory_xact_lock(hashtextextended(p_record_id::text, 0));

  -- One read supplies both the number and the payload being merged.
  -- `||` is a shallow top-level merge, which is exactly what the JS
  -- `{ ...revRow.payload, ...payload }` at every call site does today, so
  -- per-key semantics are unchanged. Architecture rule 5: jsonb is compared
  -- and combined as jsonb here, never through a ::text cast.
  select r.revision_number + 1,
         coalesce(r.payload, '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb)
    into v_next, v_payload
    from public.record_revisions r
   where r.record_id = p_record_id
   order by r.revision_number desc
   limit 1;

  -- No prior revision. Every creation path writes revision 1 directly and
  -- does not call this, so this branch is defensive rather than used.
  if v_next is null then
    v_next := 1;
    v_payload := coalesce(p_patch, '{}'::jsonb);
  end if;

  insert into public.record_revisions (record_id, revision_number, payload, created_by)
  values (p_record_id, v_next, v_payload, p_created_by);

  return jsonb_build_object('revision_number', v_next, 'payload', v_payload);
end;
$$;

comment on function public.append_record_revision(uuid, jsonb, uuid) is
  'The single atomic writer for record_revisions. Computes the next revision '
  'number and merges the caller''s patch into the current payload under one '
  'per-record advisory lock, so the read supplying the number and the read '
  'supplying the payload are the same read. Security INVOKER on purpose: '
  'record_revisions_insert stays in force, unlike issue_reference_number '
  'whose table has no policies. Never call this with a service-role client '
  'expecting RLS to protect anything.';

grant execute on function public.append_record_revision(uuid, jsonb, uuid) to authenticated;
