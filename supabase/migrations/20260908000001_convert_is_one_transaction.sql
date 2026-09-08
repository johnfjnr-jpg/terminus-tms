-- Terminus TMS: a conversion is one transaction, or it never happened.
--
-- ─────────────────────────────────────────────────────────────
-- WHAT THIS CLOSES
-- ─────────────────────────────────────────────────────────────
--
-- POST /test-beds/:id/convert performed four writes in sequence with no
-- transaction: records, record_revisions, opportunity_details, and an
-- audit_log batch of two whose error was never checked. Each write returned
-- early on failure, so a failure after the second left a usable-looking
-- Opportunity with no details row, and the consequences fanned out:
--
--   the max-conversions check reads opportunity_details
--   .converted_from_test_bed_id, so the conversion did not count and a
--   SECOND conversion of the same Test Bed was permitted;
--   the close-date PATCH refused the owner through its zero-rows path;
--   the probability trigger UPDATEd zero rows silently at every transition;
--   test_bed_cost was lost to the Deal Sheet.
--
-- The contact sibling, POST /contacts/:id/create-opportunity, had the same
-- unguarded shape with a fifth write (the record_contacts link) and no
-- conversion counter.
--
-- AND A SECOND RACE, INDEPENDENT OF THE FIRST. The max-conversions check was
-- read-then-write with no constraint behind it, so two concurrent converts of
-- one bed both read zero and both committed even if each request had been
-- internally atomic. Making the four writes atomic does not close that; the
-- lock does.
--
-- ─────────────────────────────────────────────────────────────
-- THE AUDIT SEMANTICS CHANGE, RULED BY THE BUSINESS 2026-09-08
-- ─────────────────────────────────────────────────────────────
--
-- Inside the transaction, a failed audit_log insert ROLLS THE CONVERSION BACK.
-- An unauditable conversion must not exist. This is a deliberate behaviour
-- change from the fire-and-forget the routes had, where insert 4 could fail and
-- the route still answered 201.
--
-- IT IS IMPLEMENTED BY CONSTRUCT RATHER THAN BY CODE, which is the point.
-- Neither function carries an EXCEPTION block, so any error raised by any
-- statement propagates out of the function and aborts the whole call. There is
-- no branch to get wrong and nothing to remember. Adding an exception handler
-- to either of these functions would silently restore the old behaviour.
--
-- ─────────────────────────────────────────────────────────────
-- SECURITY INVOKER, AND WHY IT IS LOAD-BEARING RATHER THAN INCIDENTAL
-- ─────────────────────────────────────────────────────────────
--
-- Both functions run as the caller, exactly as append_record_revision and
-- insert_deal_sheet_version do. Every policy these five inserts must satisfy is
-- owner-scoped and stays in force:
--
--   records_insert             auth.uid() = owner_id
--   record_revisions_insert    auth.uid() = created_by AND owner of the record
--   opportunity_details_insert auth.uid() = owner of record_id
--   record_contacts_insert     auth.uid() = created_by AND owner of record_id
--   audit_log_insert           auth.uid() = actor_id
--
-- A SECURITY DEFINER function would satisfy all five as its owner and none of
-- them as the caller, which is Architecture rule 12's point arriving from the
-- other side: the more powerful the executor, the less it may take on trust.
--
-- THERE IS DELIBERATELY NO IDENTITY GUARD. It would be tempting to open each
-- function with `if auth.uid() is null then raise ... end if`, and that guard
-- would be a SECOND READER of the fact the five policies already read
-- (Verification 20), and worse: it would MASK the enforcement, so the proof
-- that RLS refuses an unidentified caller could never fire. The database
-- refuses; the function does not restate the refusal.
--
-- AND THE COUNT SEES EVERY OWNER'S ROWS, which is what makes the limit real
-- under INVOKER. records_select and opportunity_details_select are both
-- `auth.uid() is not null` since 20260812000004, so the conversion count is
-- team-wide. Had either stayed owner-scoped, one user's conversion would have
-- been invisible to another's count and the limit would have been per-person
-- rather than per-bed. This is stated because it is the premise the INVOKER
-- choice rests on, and Verification 29 says a premise is written down at the
-- moment the decision is taken.
--
-- ─────────────────────────────────────────────────────────────
-- THE LOCK, AND WHY IT IS THE BED'S
-- ─────────────────────────────────────────────────────────────
--
-- pg_advisory_xact_lock(hashtextextended(bed_id::text, 0)) is the same hash
-- append_record_revision and insert_deal_sheet_version take on a record id, and
-- a Test Bed IS a record. Taking the same hash is the whole point: two
-- conversions of one bed serialise against each other, and so does a revision
-- being appended to that bed while it is being converted.
--
-- The conversion count is the ONLY read that moves inside the function, because
-- the lock is what makes it true. Everything else the routes compute stays in
-- the routes, per the brief: the bed payload, the criteria row, the probability
-- default, the system defaults, and reference-number issuance.
--
-- WITH ONE DEPARTURE, RECORDED AS ONE. The bed's account_id and reference_code
-- are read INSIDE rather than passed. They are not computed values; they are
-- facts the database holds about the record, and Architecture rule 12's test is
-- whether a parameter is about the CALLER or about the WORLD. A caller
-- supplying its own reference_code would produce an Opportunity carrying a code
-- that belongs to a different Test Bed, and it would look entirely normal -
-- the p_from_stage shape exactly. The read costs nothing: the function is
-- already inside the lock and already needs the bed row to exist.
--
-- ─────────────────────────────────────────────────────────────
-- PT422, AND THE MAPPING
-- ─────────────────────────────────────────────────────────────
--
-- The limit refusal raises SQLSTATE PT422, which the route maps to 422 - the
-- status POST /test-beds/:id/convert already answers for this case, with the
-- same message it already sends.
--
-- CHOSEN SO IT CANNOT COLLIDE. The estate's custom codes are PT400, PT401,
-- PT403, PT404, PT409, PT412, PT423 and PT500, enumerated from the migrations
-- rather than recalled. PT422 is free, and it follows the convention the others
-- set: the code names the HTTP status it maps to. It must not be PT409, whose
-- meaning is "the record moved under you, reload and try again"; a conversion
-- limit is not a staleness conflict and the two need different words on screen.
--
-- The full mapping this migration introduces or relies on:
--
--   PT422  conversion limit reached      -> 422  (new, this migration)
--   PT404  the Test Bed or Contact is gone -> 404  (existing)
--   PT400  a required argument is null   -> 400  (existing)
--   42501  RLS refused an insert         -> 403  (existing, sendRefusal)
--   PT423  the record is frozen          -> 423  (existing, inherited)
--
-- PT423 is INHERITED rather than introduced, and it is Verification 46: three
-- of the five tables written here carry refuse_write_while_frozen on INSERT
-- (record_revisions, opportunity_details, record_contacts). A brand-new
-- Opportunity has no open transition request so the guard cannot fire today,
-- and it is named because a new writer is bound by every guard already on the
-- table whether or not it was written for this purpose.

-- ─────────────────────────────────────────────────────────────
-- 1. convert_test_bed
-- ─────────────────────────────────────────────────────────────

create or replace function public.convert_test_bed(
  p_bed_id          uuid,
  p_payload         jsonb,
  p_max_conversions integer,
  p_probability_pct numeric,
  p_test_bed_cost   numeric
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_bed   public.records%rowtype;
  v_live  integer;
  v_opp   public.records%rowtype;
begin
  if p_bed_id is null then
    raise exception 'convert_test_bed: p_bed_id is required' using errcode = 'PT400';
  end if;
  if p_payload is null then
    raise exception 'convert_test_bed: p_payload is required' using errcode = 'PT400';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_bed_id::text, 0));

  select * into v_bed
    from public.records
   where id = p_bed_id
     and record_type = 'test_bed';

  if not found then
    raise exception 'test bed not found' using errcode = 'PT404';
  end if;

  -- The count, under the lock, and only under the lock. A null limit means the
  -- conversion_criteria row sets none, which is the route's own reading of
  -- condition->>'max_conversions'.
  --
  -- A CORRELATED EXISTS RATHER THAN A JOIN, per Architecture rule 14(a): this
  -- migration cannot be parse-checked before it is applied, so the construct is
  -- chosen to be one that cannot carry the error rather than one that is merely
  -- legal if typed correctly.
  --
  -- deleted_at is null preserves the route's liveConversions filter exactly:
  -- a soft-deleted Opportunity does not count, so deleting an Opportunity frees
  -- its Test Bed to be converted again. That rule has never been exercised by
  -- any row in this database - every recorded conversion has both its bed and
  -- its opportunity soft-deleted - which is why the phase that measured it made
  -- a constructed fixture a named proof rather than a nicety.
  if p_max_conversions is not null then
    select count(*) into v_live
      from public.opportunity_details d
     where d.converted_from_test_bed_id = p_bed_id
       and exists (
         select 1 from public.records o
          where o.id = d.record_id
            and o.deleted_at is null
       );

    if v_live >= p_max_conversions then
      raise exception 'This Test Bed has already been converted to an Opportunity'
        using errcode = 'PT422';
    end if;
  end if;

  insert into public.records (
    record_type, status, owner_id, account_id, reference_code
  ) values (
    'opportunity', 'Qualification', v_actor, v_bed.account_id, v_bed.reference_code
  )
  returning * into v_opp;

  insert into public.record_revisions (
    record_id, revision_number, payload, created_by
  ) values (
    v_opp.id, 1, p_payload, v_actor
  );

  insert into public.opportunity_details (
    record_id, probability_pct, converted_from_test_bed_id, test_bed_cost
  ) values (
    v_opp.id, p_probability_pct, p_bed_id, p_test_bed_cost
  );

  -- Both audit rows, and a failure here rolls everything above back. Ruling 2.
  insert into public.audit_log (record_id, record_type, action, actor_id, detail)
  values
    (p_bed_id, 'test_bed', 'converted_to_opportunity', v_actor,
     jsonb_build_object('opportunity_id', v_opp.id)),
    (v_opp.id, 'opportunity', 'created_from_test_bed', v_actor,
     jsonb_build_object(
       'from_test_bed_id', p_bed_id,
       'test_bed_cost',    p_test_bed_cost,
       'account_id',       v_bed.account_id,
       'reference_code',   v_bed.reference_code
     ));

  -- The route's response body, unchanged: the new record plus the two carried
  -- fields it appends. Returned from here so the route keeps the same shape
  -- without re-deriving it, rather than assembling a second version of it.
  return to_jsonb(v_opp) || jsonb_build_object(
    'converted_from_test_bed_id', p_bed_id,
    'test_bed_cost',              p_test_bed_cost
  );
end;
$$;

comment on function public.convert_test_bed(uuid, jsonb, integer, numeric, numeric) is
  'Converts a Test Bed to an Opportunity as ONE transaction: records, '
  'record_revisions, opportunity_details and both audit_log rows, or none of '
  'them. Takes the same advisory lock append_record_revision takes on a record '
  'id, so the max-conversions count cannot be raced. Raises PT422 when the '
  'limit in conversion_criteria.condition is already reached, PT404 when the '
  'bed is gone. SECURITY INVOKER: every owner-scoped insert policy stays in '
  'force and there is deliberately no identity guard restating them.';

grant execute on function public.convert_test_bed(uuid, jsonb, integer, numeric, numeric) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. create_opportunity_from_contact
-- ─────────────────────────────────────────────────────────────
--
-- Narrow, and deliberately not a generalisation of the one above. The two
-- creation paths differ in four ways - the link row, the reference code, the
-- absence of a conversion counter, and the response body - and a shared
-- function with four branches would be one computation path in name only.
--
-- NO ADVISORY LOCK, and the absence is the decision. A lock exists here to make
-- a read-then-write true, and this path has no such read: there is no limit on
-- how many Opportunities a Contact may produce. Adding one would serialise
-- unrelated work and would read as though it were protecting something.
--
-- The account_id is read from the Contact's own parent_record_id inside, for
-- the same reason the bed's is: it is a fact the database holds, not a computed
-- value. The reference code IS computed - issue_reference_number increments a
-- counter and must stay a distinct explicit call in the route - so it is a
-- parameter, and null when the Contact has no industry or an unmapped country,
-- which is the route's existing honest-absence behaviour.

create or replace function public.create_opportunity_from_contact(
  p_contact_id      uuid,
  p_payload         jsonb,
  p_reference_code  text,
  p_probability_pct numeric
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor   uuid := auth.uid();
  v_contact public.records%rowtype;
  v_opp     public.records%rowtype;
begin
  if p_contact_id is null then
    raise exception 'create_opportunity_from_contact: p_contact_id is required' using errcode = 'PT400';
  end if;
  if p_payload is null then
    raise exception 'create_opportunity_from_contact: p_payload is required' using errcode = 'PT400';
  end if;

  select * into v_contact
    from public.records
   where id = p_contact_id
     and record_type = 'contact';

  if not found then
    raise exception 'contact not found' using errcode = 'PT404';
  end if;

  insert into public.records (
    record_type, status, owner_id, reference_code, account_id
  ) values (
    'opportunity', 'Qualification', v_actor, p_reference_code, v_contact.parent_record_id
  )
  returning * into v_opp;

  insert into public.record_revisions (
    record_id, revision_number, payload, created_by
  ) values (
    v_opp.id, 1, p_payload, v_actor
  );

  insert into public.opportunity_details (
    record_id, probability_pct
  ) values (
    v_opp.id, p_probability_pct
  );

  -- The link, in the shape linkContact writes it. role is the text column and
  -- role_id and role_other stay null, which is what
  -- record_contacts_one_role_source requires: num_nonnulls(role, role_id,
  -- role_other) = 1. Verification 46 - this insert inherits that constraint and
  -- the frozen guard whether or not either was written for this path.
  insert into public.record_contacts (
    record_id, contact_id, role, created_by
  ) values (
    v_opp.id, p_contact_id, 'commercial buyer', v_actor
  );

  insert into public.audit_log (record_id, record_type, action, actor_id, detail)
  values
    (p_contact_id, 'contact', 'created_opportunity', v_actor,
     jsonb_build_object('opportunity_id', v_opp.id)),
    (v_opp.id, 'opportunity', 'created_from_contact', v_actor,
     jsonb_build_object('contact_id', p_contact_id, 'initial_stage', 'Qualification'));

  -- The route sends the record itself, so that is what comes back.
  return to_jsonb(v_opp);
end;
$$;

comment on function public.create_opportunity_from_contact(uuid, jsonb, text, numeric) is
  'Creates an Opportunity from a qualified Contact as ONE transaction: records, '
  'record_revisions, opportunity_details, the record_contacts link and both '
  'audit_log rows, or none of them. No advisory lock: this path has no '
  'read-then-write to protect. SECURITY INVOKER, same reasoning as '
  'convert_test_bed. Raises PT404 when the Contact is gone.';

grant execute on function public.create_opportunity_from_contact(uuid, jsonb, text, numeric) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- THE LEDGER ROW, IN THE SAME PASTE
-- ─────────────────────────────────────────────────────────────
--
-- Architecture rule 10. Applying SQL through the Supabase dashboard does not
-- write to supabase_migrations.schema_migrations, so the schema and the ledger
-- disagree from that moment and nothing in the application can see it. One
-- paste, two statements. Safe under both paths: by hand it records what the
-- dashboard will not, and under `supabase db push` the CLI writes the row
-- itself and the on conflict makes this a no-op.
insert into supabase_migrations.schema_migrations (version)
values ('20260908000001')
on conflict (version) do nothing;
