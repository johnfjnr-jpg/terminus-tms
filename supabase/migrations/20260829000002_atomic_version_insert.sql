-- Terminus TMS: a version is taken under the same lock its record is written
-- under, and the revision it names is required by the database. Round 38.
--
-- ─────────────────────────────────────────────────────────────
-- WHAT WAS LEFT OPEN, AND WHY IT IS THE LAST OF ITS CLASS
-- ─────────────────────────────────────────────────────────────
--
-- 20260829000001 gave a version the revision it was taken from, and the route
-- enforced it by READING the record's current revision, comparing, and then
-- inserting. That is read-then-write, which is the exact shape this round spent
-- itself removing from three per-field freshness checks and eleven revision
-- writers. It was named in the route rather than hidden, and naming it is not
-- fixing it.
--
-- TWO RACES, NOT ONE. The second was already known and already producing a raw
-- error rather than a refusal:
--
--   THE REVISION RACE. A revision landing between the read and the insert leaves
--   a version naming the revision the client saw while the record has moved on.
--
--   THE NUMBERING RACE. major/minor were read the same way. The unique
--   constraint on (record_id, major, minor) catches two concurrent saves, which
--   is why the numbering has never silently broken, but it surfaces as a raw
--   23505 rather than as anything a person can act on. That constraint's own
--   comment says the numbering "quietly stops being one" without it, so this
--   removes the collision rather than continuing to rely on the catch.
--
-- Both close with one lock, and it is the lock that already exists:
-- pg_advisory_xact_lock(hashtextextended(record_id::text, 0)), the same hash
-- append_record_revision takes. Taking the SAME hash is the whole point. A
-- version and a revision now serialise against each other, so no revision can
-- land between this function's check and its insert.
--
-- SECURITY INVOKER, deliberately, exactly as append_record_revision is: the
-- deal_sheet_versions_insert policy (auth.uid() = created_by) must stay in
-- force, and a definer function would bypass it.

create or replace function public.insert_deal_sheet_version(
  p_record_id         uuid,
  p_expected_revision integer,
  p_reason            text,
  p_inputs            jsonb,
  p_rates             jsonb,
  p_sections          jsonb,
  p_batch_id          uuid,
  p_created_by        uuid,
  p_created_by_email  text
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_current integer;
  v_major   integer;
  v_minor   integer;
  v_row     public.deal_sheet_versions;
begin
  if p_record_id is null then
    raise exception 'insert_deal_sheet_version: p_record_id is required';
  end if;
  if p_created_by is null then
    raise exception 'insert_deal_sheet_version: p_created_by is required';
  end if;
  if p_expected_revision is null then
    raise exception 'insert_deal_sheet_version: p_expected_revision is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_record_id::text, 0));

  select r.revision_number
    into v_current
    from public.record_revisions r
   where r.record_id = p_record_id
   order by r.revision_number desc
   limit 1;

  -- PT409, the same SQLSTATE a stale record write raises, so the route maps one
  -- code rather than two and a conflict never reaches the 500 path.
  if v_current is distinct from p_expected_revision then
    raise exception
      'This Opportunity is at revision %, and the version would have recorded revision %. Reload and take it again.',
      coalesce(v_current, 0), p_expected_revision
      using errcode = 'PT409';
  end if;

  -- The numbering, under the same lock. major carries forward and minor
  -- increments; major = 0 until something is issued.
  select v.major, v.minor
    into v_major, v_minor
    from public.deal_sheet_versions v
   where v.record_id = p_record_id
   order by v.major desc, v.minor desc
   limit 1;

  insert into public.deal_sheet_versions (
    record_id, major, minor, status, reason, revision_number,
    inputs, rates, sections, batch_id, created_by, created_by_email
  ) values (
    p_record_id, coalesce(v_major, 0), coalesce(v_minor, 0) + 1, 'draft',
    p_reason, p_expected_revision,
    p_inputs, p_rates, p_sections, p_batch_id, p_created_by, p_created_by_email
  )
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

comment on function public.insert_deal_sheet_version(uuid, integer, text, jsonb, jsonb, jsonb, uuid, uuid, text) is
  'Takes a Deal Sheet version under the same advisory lock append_record_revision '
  'takes, so the revision it records cannot move between being checked and being '
  'written, and two concurrent versions cannot compute the same number. Raises '
  'SQLSTATE PT409 when the record is not at the expected revision.';

-- ─────────────────────────────────────────────────────────────
-- AND THE REQUIREMENT MOVES INTO THE DATABASE
-- ─────────────────────────────────────────────────────────────
--
-- revision_number was nullable with the requirement enforced in one route. That
-- is the shape this round has been eliminating everywhere else: a guarantee that
-- is remembered rather than enforced, correct for every writer that exists and
-- silently absent for the next one. A second writer inserting without it would
-- produce a version that cannot be approved, and nothing would say so.
--
-- NOT VALID is the whole trick, and it is not a weakening. Postgres skips the
-- check for rows that already exist and enforces it on every subsequent insert
-- and update. So the one pre-existing version keeps its null, no history is
-- rewritten, and no new row can be created without a revision. The constraint is
-- deliberately never VALIDATEd; doing so would fail on that row and there is
-- nothing to gain from it.
--
-- The interaction with the immutability trigger, stated because it is the only
-- way this could bite: an UPDATE of the legacy null row would now fail the
-- check. That row is `issued`, and deal_sheet_versions_immutable() refuses to
-- change an issued row at all, so the update cannot happen for a different and
-- earlier reason.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'deal_sheet_versions_revision_required'
  ) then
    alter table public.deal_sheet_versions
      add constraint deal_sheet_versions_revision_required
      check (revision_number is not null) not valid;
  end if;
end $$;
