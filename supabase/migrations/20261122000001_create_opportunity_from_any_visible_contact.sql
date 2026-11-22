-- Terminus TMS: an Opportunity may be created from any contact the user can see.
--
-- John's ruling 2026-11-22: any signed-in user may create an Opportunity from
-- ANY contact they can see, whoever owns the contact or its Account. The
-- creator owns the new Opportunity. Creation writes the new Opportunity and
-- its own links ONLY; it writes nothing on the contact or the Account.
-- Editing a contact or Account stays owner-only (unchanged).
--
-- SUPERSEDES R5 of the create-from ownership round (20260908000003) FOR THIS
-- ONE PATH. R5's stated reason was that a create-from CONSUMES from the source:
-- an allowance, an identity, a history. For this path the only thing consumed
-- was the history: one audit_log row keyed on the contact. No allowance exists
-- and the reference code is issued fresh, never taken from the contact. With
-- that row removed the premise no longer holds, so the decision is re-taken,
-- not re-weighed (Verification 29). convert_test_bed is NOT changed: it still
-- spends the bed's conversion allowance and takes its reference code.
--
-- TWO CHANGES TO THE BODY, AND NOTHING ELSE:
--   1. the owner check on the source contact is removed;
--   2. the audit_log row keyed on the contact is removed, so nothing written
--      here is keyed on the contact (and its record_freshness is not bumped).
-- The body is lifted from 20260908000003 by script, not retyped.
--
-- WHAT STILL ADMITS EACH WRITE, measured in Phase 0 by issuing the five writes
-- one by one as a user who does not own the contact: all five ADMITTED.
--   records_insert             auth.uid() = owner_id            (the creator)
--   record_revisions_insert    created_by and owner of record   (the new opp)
--   opportunity_details_insert owner of record_id                (the new opp)
--   record_contacts_insert     created_by and owner of record_id (the new opp)
--   audit_log_insert           auth.uid() = actor_id
-- No policy is changed. The contact's and Account's write policies are not
-- touched, so editing either stays owner-only.
--
-- SECURITY INVOKER, search_path and the grant are restated as they stand in
-- 20260908000003, so this file says what it leaves in force.
--
-- Not parse-checked: this session reaches Postgres only through PostgREST
-- (Build discipline 14). No self-recording ledger row (Architecture 10 as
-- corrected); record it separately after the apply.

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

  -- ── NO OWNERSHIP CHECK ON THE SOURCE. John's ruling 2026-11-22 ───────────
  --
  -- Any signed-in user may create an Opportunity from any contact they can
  -- see. The creator owns the new Opportunity; nothing below writes to the
  -- contact or its Account. Editing the contact stays owner-only: that is
  -- enforced by the write policies on the contact's own rows, which this
  -- function does not touch. Supersedes R5 of 20260908000003 for this path
  -- only; convert_test_bed keeps its check.

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

  -- ONE audit row, on the NEW record. The row keyed on the contact is gone:
  -- it was a write on the contact's history, and its trigger bumped the
  -- contact's record_freshness. The contact is named in this row's detail, so
  -- the fact is still recorded, on the record the creator owns.
  insert into public.audit_log (record_id, record_type, action, actor_id, detail)
  values
    (v_opp.id, 'opportunity', 'created_from_contact', v_actor,
     jsonb_build_object('contact_id', p_contact_id, 'initial_stage', 'Qualification'));

  -- The route sends the record itself, so that is what comes back.
  return to_jsonb(v_opp);
end;
$$;

comment on function public.create_opportunity_from_contact(uuid, jsonb, text, numeric) is
  'Creates an Opportunity from a qualified Contact as ONE transaction. Any '
  'signed-in user who can see the Contact may call it; the caller owns the new '
  'Opportunity. Writes the Opportunity, its revision, its details, its '
  'record_contacts link and one audit row on the Opportunity; writes nothing '
  'on the Contact or its Account. Ruled 2026-11-22, superseding the source-owner '
  'check of 20260908000003 for this function only.';

grant execute on function public.create_opportunity_from_contact(uuid, jsonb, text, numeric) to authenticated;

notify pgrst, 'reload schema';
