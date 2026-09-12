-- ── QUALIFY IS ONE TRANSACTION ───────────────────────────────────────────
--
-- R1 of the LEADS CARD round, 2026-09-12. Qualify is no longer gated on a
-- pre-existing Account link: it IS the conversion. Create or link the Account,
-- link the lead to it, and flip the status, ALL OR NOTHING.
--
-- The half states this exists to make impossible:
--   a Qualified lead with no Account, and an orphan Account with no lead.
-- Today's POST /contacts/:id/link-account makes THREE separate PostgREST
-- calls - insert the account record, insert its revision, update the contact -
-- so a failure between them leaves exactly the orphan this forbids. That route
-- stays for the Lead Detail path, which is frozen this round; this function is
-- what the card's Qualify calls.
--
-- ── WHAT "CREATE CONTACT" MEANS, and it is measured, not assumed ──────────
--
-- R1 says "create Contact". There is no second record. A Lead IS a `contact`
-- row at status Unqualified - there are no live `lead` records, the legacy
-- record_type='lead' rows are deliberately untouched, and the screen states
-- the design of record: "one record, one stage chip, no separate Lead
-- conversion". So the Contact is MADE by the status flip on the same row.
--
-- ── WHAT THIS FUNCTION DELIBERATELY DOES NOT DO ──────────────────────────
--
-- IT DOES NOT EVALUATE THE COMPLETENESS GATE. `computeBlocking` is the one
-- evaluator and POST /records/:id/transition already calls it server-side.
-- A second implementation here would be Verification 43 exactly: a writer
-- beside a correct rule, agreeing today and drifting later. The caller runs
-- the gate; this function runs the transaction.
--
-- Derived from create_opportunity_from_contact (20260908000003), which is the
-- estate's proven shape for a multi-record create: plpgsql, security invoker,
-- identity from auth.uid(), ownership derived from the record and never
-- accepted as a parameter (Architecture 12).
--
-- NO SELF-RECORDING LEDGER ROW. Architecture 10 as corrected: a file that
-- writes its own schema_migrations row collides with the CLI's own insert and
-- rolls the whole migration back. The row is recorded separately after apply.

create or replace function public.qualify_contact(
  p_contact_id        uuid,
  p_account_id        uuid default null,
  p_new_account_name  text default null,
  p_account_payload   jsonb default '{}'::jsonb,
  p_account_reference text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor    uuid := auth.uid();
  v_contact  public.records%rowtype;
  v_account  public.records%rowtype;
  v_next_rev integer;
  v_payload  jsonb;
begin
  if p_contact_id is null then
    raise exception 'qualify_contact: p_contact_id is required' using errcode = 'PT400';
  end if;

  -- EXACTLY ONE of the two account shapes, the same pair link-account accepts.
  -- Both or neither is a caller bug and must not be guessed at.
  if (p_account_id is null) = (p_new_account_name is null) then
    raise exception 'qualify_contact: exactly one of p_account_id or p_new_account_name is required'
      using errcode = 'PT400';
  end if;

  select * into v_contact
    from public.records
   where id = p_contact_id
     and record_type = 'contact';

  if not found then
    raise exception 'contact not found' using errcode = 'PT404';
  end if;

  -- THE RECORD MUST BE YOURS, derived from the row this function already read.
  -- Before every other check, so a non-owner learns nothing about its state
  -- from the shape of the refusal. 42501, matching the estate's other
  -- INVOKER functions, so the sentence reads identically wherever it came from.
  if v_contact.owner_id is distinct from auth.uid() then
    raise exception 'This record belongs to another user. You can view it, but only its owner can change it.'
      using errcode = '42501';
  end if;

  if v_contact.status = 'Qualified' then
    raise exception 'This lead is already Qualified.' using errcode = 'PT422';
  end if;

  -- ── THE ACCOUNT ──────────────────────────────────────────────────────────
  if p_account_id is not null then
    select * into v_account
      from public.records
     where id = p_account_id
       and record_type = 'account'
       and deleted_at is null;
    if not found then
      raise exception 'account not found' using errcode = 'PT404';
    end if;
  else
    insert into public.records (record_type, status, owner_id, reference_code)
    values ('account', 'active', v_actor, p_account_reference)
    returning * into v_account;

    insert into public.record_revisions (record_id, revision_number, payload, created_by)
    values (
      v_account.id, 1,
      coalesce(p_account_payload, '{}'::jsonb) || jsonb_build_object('name', p_new_account_name),
      v_actor
    );
  end if;

  -- ── THE LEAD BECOMES A CONTACT ───────────────────────────────────────────
  --
  -- A correlated subquery rather than an UPDATE ... FROM. Architecture 14(a):
  -- prefer a construct that CANNOT carry the error over one that is merely
  -- legal if typed right, because this migration reaches the business
  -- unverified and the dashboard is the first parser it meets.
  update public.records
     set status           = 'Qualified',
         parent_record_id = v_account.id
   where id = p_contact_id;

  -- The revision carries the payload forward unchanged. Qualifying does not
  -- edit the lead's fields; it records that the record moved.
  select coalesce(max(revision_number), 0) + 1 into v_next_rev
    from public.record_revisions
   where record_id = p_contact_id;

  select payload into v_payload
    from public.record_revisions
   where record_id = p_contact_id
   order by revision_number desc
   limit 1;

  insert into public.record_revisions (record_id, revision_number, payload, created_by)
  values (p_contact_id, v_next_rev, coalesce(v_payload, '{}'::jsonb), v_actor);

  insert into public.audit_log (record_id, record_type, action, actor_id, detail)
  values
    (p_contact_id, 'contact', 'qualified', v_actor,
     jsonb_build_object(
       'account_id', v_account.id,
       'account_created', (p_account_id is null),
       'from_stage', v_contact.status,
       'to_stage', 'Qualified')),
    (v_account.id, 'account',
     case when p_account_id is null then 'created_on_qualify' else 'linked_on_qualify' end,
     v_actor, jsonb_build_object('contact_id', p_contact_id));

  return jsonb_build_object(
    'contact_id', p_contact_id,
    'account_id', v_account.id,
    'account_created', (p_account_id is null),
    'revision_number', v_next_rev,
    'status', 'Qualified');
end;
$$;

comment on function public.qualify_contact(uuid, uuid, text, jsonb, text) is
  'R1, LEADS CARD round: Qualify as an atomic conversion. Creates or links the '
  'Account, links the lead to it and flips status to Qualified in one '
  'transaction. Does NOT evaluate the completeness gate - computeBlocking is '
  'the single evaluator and the caller runs it.';
