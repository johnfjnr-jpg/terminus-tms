-- Terminus TMS: the four write paths a non-owner could reach, closed.
--
-- ─────────────────────────────────────────────────────────────
-- WHAT WAS MEASURED, LIVE, BEFORE THIS WAS WRITTEN
-- ─────────────────────────────────────────────────────────────
--
-- Three holes, each proven by an actual write landing on a record the caller
-- did not own. Not read off the policies: run.
--
--   POST /opportunities/:id/deal-sheet-versions  -> 201, a version created
--   POST /deal-sheet-versions/:vid/issue         -> 200, V0.1 draft ISSUED as V1.0
--   POST /records/:id/transition-requests        -> 201, auto-approved, AND THE
--                                                   RECORD MOVED Qualification
--                                                   -> Solution Alignment
--
-- The third is the one that matters most: a person who owns nothing moved
-- somebody else's opportunity to the next stage. The second is next, because
-- issuing is the act that makes a price official.
--
-- A fourth, source-derived and NOT proven live, closes with them:
-- document_details carries `record_id IN (SELECT id FROM records)`, and
-- records_select has been `auth.uid() is not null` since 20260812000004, so
-- that predicate is satisfied by every row for every authenticated caller.
--
-- ─────────────────────────────────────────────────────────────
-- THE SHAPE OF THE FAULT, AND WHY IT IS ONE FAULT AND NOT FOUR
-- ─────────────────────────────────────────────────────────────
--
-- Every one of these is IDENTITY-SHAPED where it should be OWNERSHIP-SHAPED.
-- `auth.uid() = created_by` verifies that you sign your own work. It never asks
-- whose record you are signing it onto. The estate gets this right on records,
-- record_revisions, opportunity_details, record_contacts and
-- record_contact_stances - all five carry
-- `auth.uid() = (select owner_id from records where id = record_id)` - and the
-- four below are the ones that were written without it.
--
-- ─────────────────────────────────────────────────────────────
-- WHAT DOES *NOT* CHANGE, ruled 2026-09-08 and stated so a later reader does
-- not "fix" it
-- ─────────────────────────────────────────────────────────────
--
-- audit_log and approvals STAY IDENTITY-SHAPED. Owner-only there would break
-- the features:
--
--   audit_log  `auth.uid() = actor_id` - an audit row is a statement about who
--              did something. An approver, or any future non-owner actor, must
--              be able to write one about themselves.
--   approvals  `auth.uid() = approver_id` - THE WHOLE POINT IS THAT SOMEBODY
--              ELSE SIGNS. An approver is by design not the owner.
--
-- The product rulings behind this migration, recorded because a policy cannot
-- carry them: APPROVERS ENDORSE, OWNERS EXECUTE - an approver may not issue.
-- And there is NO MANAGER OVERRIDE; if one is ever wanted it arrives as an
-- explicit roles feature in its own round, never as a loose policy.
--
-- ─────────────────────────────────────────────────────────────
-- NO SELF-RECORDING LEDGER ROW
-- ─────────────────────────────────────────────────────────────
--
-- Architecture rule 10 as corrected 2026-09-08: a migration file must not write
-- its own supabase_migrations.schema_migrations row. Measured live, it fails
-- `supabase db push` with 23505 - the CLI writes that row itself, after the
-- file, with an insert carrying no conflict clause, so it is the CLI's insert
-- that collides. Under db push the CLI records the version. Applied by hand
-- instead, the row is inserted afterwards as a separate statement.

-- ─────────────────────────────────────────────────────────────
-- 1. deal_sheet_versions INSERT: the owner of the record only
-- ─────────────────────────────────────────────────────────────
--
-- Was: `with check (auth.uid() = created_by)`.
--
-- The self-signing clause is KEPT rather than replaced. Both halves are wanted,
-- and this is the shape record_revisions_insert already uses: you may only
-- write a row as yourself, and only onto a record that is yours.

drop policy if exists "deal_sheet_versions_insert" on public.deal_sheet_versions;
create policy "deal_sheet_versions_insert" on public.deal_sheet_versions
  for insert to authenticated
  with check (
    auth.uid() = created_by
    and auth.uid() = (select r.owner_id from public.records r where r.id = record_id)
  );

-- ─────────────────────────────────────────────────────────────
-- 2. deal_sheet_versions UPDATE: the owner only, and only a draft
-- ─────────────────────────────────────────────────────────────
--
-- Was: `using (auth.uid() is not null and status = 'draft')`, which is every
-- authenticated caller on every draft in the estate. ISSUING IS EXACTLY THIS
-- UPDATE, which is how a non-owner issued V1.0.
--
-- THE `with check` IS UNCHANGED, deliberately. `status in ('draft', 'issued')`
-- is the issued-immutability rule: a row may stay a draft or become issued, and
-- may never become anything else. The `using` clause already refuses a row that
-- is not a draft, so an issued version cannot be updated at all. Ruled: that
-- rule is preserved unchanged, and it is preserved by not touching it.

drop policy if exists "deal_sheet_versions_update_draft" on public.deal_sheet_versions;
create policy "deal_sheet_versions_update_draft" on public.deal_sheet_versions
  for update to authenticated
  using (
    status = 'draft'
    and auth.uid() = (select r.owner_id from public.records r where r.id = record_id)
  )
  with check (status in ('draft', 'issued'));

-- ─────────────────────────────────────────────────────────────
-- 3. document_details: the owner of the record it hangs off
-- ─────────────────────────────────────────────────────────────
--
-- Was: `FOR ALL USING (record_id IN (SELECT id FROM public.records))`. That
-- reads as a foreign-key check and behaves as none at all: records_select is
-- team-wide, so every id is visible to every authenticated caller and the
-- predicate is always true.
--
-- SCOPED TO THE DOCUMENT RECORD'S OWNER, which is the same shape
-- opportunity_details uses. A document row is created by whoever adds the
-- document, with owner_id = that person, so this preserves the existing flow:
-- both document routes in src/routes/test-beds.js insert the `records` row as
-- request.user.id and then upsert document_details against it.
--
-- THE OTHER READING, named rather than silently discarded: "parent record"
-- could mean the Test Bed the document hangs off (records.parent_record_id)
-- rather than the document itself. That would let the bed's owner edit a
-- document somebody else attached, and stop the attacher editing their own.
-- The direct analogue with every other detail table won; if the business wants
-- the bed's owner to govern its documents, that is a different rule and a
-- different migration.

drop policy if exists "rls_document_details" on public.document_details;
create policy "document_details_owner" on public.document_details
  for all to authenticated
  using (auth.uid() = (select r.owner_id from public.records r where r.id = record_id))
  with check (auth.uid() = (select r.owner_id from public.records r where r.id = record_id));

-- ─────────────────────────────────────────────────────────────
-- 4. raise_transition_request: the DEFINER gains the ownership check
-- ─────────────────────────────────────────────────────────────
--
-- ARCHITECTURE RULE 12'S OWN SUBJECT. A SECURITY DEFINER function bypasses RLS
-- entirely, so it must ask for itself every question RLS would have asked. This
-- one read auth.uid() - it knew WHO - and never asked WHOSE RECORD. That is the
-- whole of hole three, and it is why the fix cannot be a policy: there is no
-- policy in the path.
--
-- IT DERIVES, IT DOES NOT ACCEPT. The owner is read from the record inside the
-- function, beside the stage and the record type it already reads there. No new
-- parameter: a parameter would be the caller's claim, and the caller is who the
-- rule constrains.
--
-- 42501, NOT PT403. Two reasons, and the second is the one that decided it.
-- PT403 already means "you are not an approver on this track" in
-- decide_transition_request, and blurring two different refusals into one code
-- costs a reader the difference. And 42501 is what RLS ITSELF raises for a
-- refused write, so `isRefusal` in src/lib/write-errors.js already maps it to
-- the estate's own ownership sentence: the refusal reads identically whether it
-- came from a policy or from this function. One path, not two that agree today.

create or replace function public.raise_transition_request(
  p_record_id         uuid,
  p_to_stage          text,
  p_kind              text default 'transition',
  p_frozen_version_id uuid default null
)
returns public.transition_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller   uuid := auth.uid();
  v_rec      record;
  v_rev      integer;
  v_required text[];
  v_immediate boolean := false;
  v_row      public.transition_requests%rowtype;
begin
  if v_caller is null then
    raise exception 'not signed in' using errcode = 'PT401';
  end if;
  if p_kind not in ('transition', 'review') then
    raise exception 'kind must be transition or review, got %', p_kind using errcode = 'PT400';
  end if;

  -- owner_id joins the columns this already reads. Derived, never accepted.
  select r.id, r.record_type, r.status, r.owner_id into v_rec
  from public.records r where r.id = p_record_id;
  if not found then
    raise exception 'no such record' using errcode = 'PT404';
  end if;

  -- THE CHECK THIS FUNCTION NEVER HAD. Before the stage checks, so a non-owner
  -- learns nothing about the record's state from the shape of the refusal.
  if v_rec.owner_id is distinct from v_caller then
    raise exception 'This record belongs to another user. You can view it, but only its owner can change it.'
      using errcode = '42501';
  end if;

  if v_rec.status = p_to_stage then
    raise exception 'record is already in %', p_to_stage using errcode = 'PT400';
  end if;

  select max(rr.revision_number) into v_rev
  from public.record_revisions rr where rr.record_id = p_record_id;
  if v_rev is null then
    raise exception 'this record has no revision to freeze' using errcode = 'PT400';
  end if;

  -- DERIVED, never accepted. The caller says where it wants to go; the database
  -- says what that costs.
  v_required := public.required_tracks_for(v_rec.record_type, v_rec.status);

  -- ONLY A TRANSITION COMPLETES ITSELF. A review request is a request for
  -- comment and has no completion condition of its own, so it stays open
  -- whatever the tracks say, and is closed by withdrawing it.
  v_immediate := (p_kind = 'transition' and coalesce(array_length(v_required, 1), 0) = 0);

  insert into public.transition_requests
    (record_id, record_type, from_stage, to_stage, kind, status,
     frozen_revision, frozen_version_id, requested_by, closed_by, closed_at, close_reason)
  values
    (v_rec.id, v_rec.record_type, v_rec.status, p_to_stage, p_kind,
     case when v_immediate then 'approved' else 'open' end,
     v_rev, p_frozen_version_id, v_caller,
     case when v_immediate then v_caller end,
     case when v_immediate then now() end,
     case when v_immediate then
       'No approval tracks are required to leave ' || v_rec.status || '. The exit criteria were met and the move was made when it was requested.'
     end)
  returning * into v_row;

  -- AFTER the insert, and only because the row went in already closed: the
  -- freeze reads `status = 'open'`, so an open row here would refuse this
  -- update.
  if v_immediate then
    update public.records
      set status = p_to_stage, updated_at = now()
      where id = v_rec.id;
  end if;

  return v_row;
end $$;

comment on function public.raise_transition_request(uuid, text, text, uuid) is
  'Raises a transition or review request. SECURITY DEFINER, so it asks for '
  'itself every question RLS would have asked: the caller must OWN the record, '
  'checked against owner_id read from the record rather than accepted as a '
  'parameter. Raises 42501 for a non-owner, the same code RLS raises, so the '
  'refusal reads identically wherever it came from. Added 2026-09-08 after a '
  'non-owner raised a request that auto-approved and moved the record.';

grant execute on function public.raise_transition_request(uuid, text, text, uuid) to authenticated;
