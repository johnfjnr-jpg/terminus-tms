-- Terminus TMS: append_record_revision gains a key-removal list.
-- Round 17A Phase 1, 2026-08-21. Written idempotently per Architecture rule 7.
--
-- WHY THIS IS A SECOND MIGRATION rather than an edit to 20260821000000.
-- That migration is already recorded in supabase_migrations.schema_migrations,
-- so editing it would change the file without changing the database and leave
-- the two disagreeing - the exact drift Round 9 Phase 2 found and this project
-- has scar tissue about. A new migration converges a fresh database and the
-- live one on the same definition.
--
-- WHAT IT IS FOR. PATCH /test-beds/:id does not only merge keys, it REMOVES
-- them: an exit criterion sent as null is deleted from the payload rather than
-- stored as null, at src/routes/test-beds.js. A jsonb `||` merge cannot express
-- a deletion, so a patch alone could not reproduce that route's existing
-- behaviour. Setting null instead was rejected: it is equivalent for gate
-- evaluation, where payload_field_required blocks on null, undefined and empty
-- string alike, but it is NOT equivalent for any reader testing key presence,
-- and changing that quietly is a behaviour change smuggled inside a race fix.
--
-- ONE FUNCTION, NOT AN OVERLOAD. The three-argument version is dropped rather
-- than left alongside this one. Two functions of the same name differing only
-- by a defaulted argument is ambiguous to PostgREST, and more importantly it
-- would be a second atomic writer, which is the thing Phase 1 exists to
-- prevent.
drop function if exists public.append_record_revision(uuid, jsonb, uuid);

create or replace function public.append_record_revision(
  p_record_id  uuid,
  p_patch      jsonb,
  p_created_by uuid,
  p_remove     text[] default '{}'::text[]
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

  -- One read supplies both the number and the payload being merged. `||` is
  -- a shallow top-level merge, exactly what `{ ...revRow.payload, ...payload }`
  -- did at every call site before this. `- p_remove` then deletes the keys the
  -- caller asked to unset, in the same statement and after the merge, so a
  -- key present in both p_patch and p_remove ends up removed. Architecture
  -- rule 5: jsonb is combined as jsonb throughout, never via a ::text cast.
  select r.revision_number + 1,
         (coalesce(r.payload, '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb))
           - coalesce(p_remove, '{}'::text[])
    into v_next, v_payload
    from public.record_revisions r
   where r.record_id = p_record_id
   order by r.revision_number desc
   limit 1;

  -- No prior revision. Every creation path writes revision 1 directly and
  -- does not call this, so this branch is defensive rather than used.
  if v_next is null then
    v_next := 1;
    v_payload := coalesce(p_patch, '{}'::jsonb) - coalesce(p_remove, '{}'::text[]);
  end if;

  insert into public.record_revisions (record_id, revision_number, payload, created_by)
  values (p_record_id, v_next, v_payload, p_created_by);

  return jsonb_build_object('revision_number', v_next, 'payload', v_payload);
end;
$$;

comment on function public.append_record_revision(uuid, jsonb, uuid, text[]) is
  'The single atomic writer for record_revisions. Computes the next revision '
  'number, merges the caller''s patch and removes p_remove''s keys, all under '
  'one per-record advisory lock, so the read supplying the number and the read '
  'supplying the payload are the same read. Security INVOKER on purpose: '
  'record_revisions_insert stays in force, unlike issue_reference_number '
  'whose table has no policies. Never call this with a service-role client '
  'expecting RLS to protect anything.';

grant execute on function public.append_record_revision(uuid, jsonb, uuid, text[]) to authenticated;
