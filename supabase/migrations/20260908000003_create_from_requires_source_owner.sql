-- Terminus TMS: the create-from paths require ownership of the SOURCE record.
--
-- ─────────────────────────────────────────────────────────────
-- WHAT WAS MEASURED
-- ─────────────────────────────────────────────────────────────
--
-- A non-owner could call six paths against a source record they can see but do
-- not own. The record created is honestly theirs, so every insert policy passes
-- and RLS never asks the question that matters. Proven live, each with an owner
-- counterfactual and new rows counted before and after:
--
--   POST /test-beds/:id/convert                201, evidence 69947943
--   POST /contacts/:id/create-opportunity      201, evidence ee047aca
--   POST /contacts/:id/create-test-bed         201, evidence 745cd214
--   POST /test-beds/:id/customer-documents     201, evidence 7d04bf64
--   POST /test-beds/:id/complete-document      201, evidence 39a14a4c
--   POST /test-beds/:id/units/derive           200, TWO unit records
--
-- TWO RATIONALES, ruled separately and recorded because they differ. The first
-- five CONSUME from the source: convert spends the bed's single conversion
-- allowance so the owner's own attempt then refuses, takes its reference code
-- permanently, and adds a row to its audit history. units/derive INJECTS into
-- it, populating another owner's bed with hardware slots they never made, which
-- is editing by another name.
--
-- THIS MIGRATION COVERS THE TWO FUNCTION-MEDIATED PATHS. The other four are
-- route-level checks in the same commit, because that is where those writes
-- execute.
--
-- APPROVERS ENDORSE, OWNERS EXECUTE. Consuming an allowance and an identity is
-- execution. Colleague-initiated conversion, if ever wanted, arrives as an
-- explicit reassignment or roles feature in its own round.
--
-- EXEMPT BY NAME, so no later sweep closes it: POST
-- /transition-requests/:id/approvals is create-from BY DESIGN. A non-owner
-- acting there is the approval flow's entire point.
--
-- ─────────────────────────────────────────────────────────────
-- NO SELF-RECORDING LEDGER ROW
-- ─────────────────────────────────────────────────────────────
--
-- Architecture rule 10 as corrected 2026-09-08: a migration must not write its
-- own supabase_migrations.schema_migrations row. It fails `supabase db push`
-- with 23505 - the CLI writes that row itself, after the file, with an insert
-- carrying no conflict clause, so it is the CLI's insert that collides.
--
-- ─────────────────────────────────────────────────────────────
-- THE BODIES BELOW ARE TODAY'S, LIFTED VERBATIM, PLUS THE CHECK
-- ─────────────────────────────────────────────────────────────
--
-- Both functions are reproduced from 20260908000001 unchanged except for the
-- guard, rather than retyped. A retyped body is a second reader of the original
-- (Verification 20) and this file cannot be parse-checked before it is applied.

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

  -- ── THE SOURCE MUST BE YOURS. Create-from ownership round, R5 ───────────
  --
  -- Architecture 12: DERIVED from the record, never accepted as a parameter.
  -- owner_id is already in the row this function reads for its other columns,
  -- so the check costs nothing and cannot be told a different answer.
  --
  -- BEFORE every other check below, so a non-owner learns nothing about the
  -- source's state from the shape of the refusal.
  --
  -- 42501, matching raise_transition_request, which gained the same check one
  -- round earlier. The route maps it through sendWriteError -> isRefusal ->
  -- the estate's own ownership sentence, so the refusal reads identically
  -- wherever it came from. READ AS A DOCUMENTED POSITION: R2 reserves 42501
  -- for RLS-raised refusals in the sentence about ROUTES, which must not
  -- fabricate it; a SECURITY INVOKER function refusing a write is the nearest
  -- thing to RLS there is, and one code beats two that mean the same.
  if v_bed.owner_id is distinct from auth.uid() then
    raise exception 'This record belongs to another user. You can view it, but only its owner can change it.'
      using errcode = '42501';
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

  -- ── THE SOURCE MUST BE YOURS. Create-from ownership round, R5 ───────────
  --
  -- Architecture 12: DERIVED from the record, never accepted as a parameter.
  -- owner_id is already in the row this function reads for its other columns,
  -- so the check costs nothing and cannot be told a different answer.
  --
  -- BEFORE every other check below, so a non-owner learns nothing about the
  -- source's state from the shape of the refusal.
  --
  -- 42501, matching raise_transition_request, which gained the same check one
  -- round earlier. The route maps it through sendWriteError -> isRefusal ->
  -- the estate's own ownership sentence, so the refusal reads identically
  -- wherever it came from. READ AS A DOCUMENTED POSITION: R2 reserves 42501
  -- for RLS-raised refusals in the sentence about ROUTES, which must not
  -- fabricate it; a SECURITY INVOKER function refusing a write is the nearest
  -- thing to RLS there is, and one code beats two that mean the same.
  if v_contact.owner_id is distinct from auth.uid() then
    raise exception 'This record belongs to another user. You can view it, but only its owner can change it.'
      using errcode = '42501';
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

comment on function public.convert_test_bed(uuid, jsonb, integer, numeric, numeric) is
  'Converts a Test Bed to an Opportunity as ONE transaction. The caller must OWN '
  'the source Test Bed, checked against owner_id read from the record rather '
  'than accepted as a parameter; a non-owner is refused 42501. Added 2026-09-08 '
  'after a non-owner converted a bed, spending its single conversion allowance '
  'and taking its reference code.';

comment on function public.create_opportunity_from_contact(uuid, jsonb, text, numeric) is
  'Creates an Opportunity from a qualified Contact as ONE transaction. The '
  'caller must OWN the source Contact; a non-owner is refused 42501.';

grant execute on function public.convert_test_bed(uuid, jsonb, integer, numeric, numeric) to authenticated;
grant execute on function public.create_opportunity_from_contact(uuid, jsonb, text, numeric) to authenticated;
