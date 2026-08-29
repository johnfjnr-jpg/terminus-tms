-- Terminus TMS: give the stale-write raise a SQLSTATE the API can carry.
-- Round 38, condition 6a, immediately after 20260828000001.
--
-- 20260828000001 raised the precondition failure with errcode '40001'. That is
-- serialization_failure, which the connection pooler and PostgREST treat as a
-- retryable transaction fault rather than as an answer: the call did not return
-- a 409, it returned a dropped connection, seen from the client as
-- "TypeError: fetch failed". Reproducible, not a blip.
--
-- PostgREST maps a SQLSTATE of the form PTnnn to HTTP status nnn, which is the
-- mechanism for saying "this is a 409" from inside a function. Verified by
-- calling it rather than by trusting the mapping.
--
-- The signature is unchanged, so this create or replace genuinely replaces
-- rather than overloading - which is the distinction 20260828000002 exists to
-- record.
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

  -- The precondition, inside the lock: a compare-and-swap rather than a
  -- read-then-write. v_next - 1 is the revision the caller merged against.
  if p_expected_revision is not null then
    v_current := v_next - 1;
    if v_current <> p_expected_revision then
      raise exception
        'This record changed since the screen loaded. It is now at revision %, the screen holds revision %. Reload before saving.',
        v_current, p_expected_revision
        using errcode = 'PT409';
    end if;
  end if;

  insert into public.record_revisions (record_id, revision_number, payload, created_by)
  values (p_record_id, v_next, v_payload, p_created_by);

  return jsonb_build_object('revision_number', v_next, 'payload', v_payload);
end;
$$;
