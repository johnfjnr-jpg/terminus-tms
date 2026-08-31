-- Terminus TMS: required tracks are DERIVED, and a zero-track transition
-- executes when it is raised. Round 41 W6.
--
-- ═════════════════════════════════════════════════════════════
-- 1. THE LIVE DEFECT: A REQUEST NOTHING CAN CLOSE
-- ═════════════════════════════════════════════════════════════
--
-- Qualification exit requires NO approval tracks. It carries one exit criterion,
-- assessmentReviewed, and no approval_obtained rule at all.
--
-- raise_transition_request always inserted `status = 'open'`, and
-- decide_transition_request is the only thing that closes a request. Deciding
-- needs a track and writes an approval row. WITH NO TRACKS THERE IS NOTHING TO
-- DECIDE, so the request stays open for ever - and an open request FREEZES the
-- record, because refuse_write_while_frozen() refuses every write to it.
--
-- Found on the walk: TT-SGP-SMARTC-108 raised a Qualification to Solution
-- Alignment request at 08:07 and has been frozen and unmovable since, with no
-- action available to anybody that would release it except withdrawing.
--
-- THE FIX IS IN THE PATH, NOT BESIDE IT. Ruled by the business: no separate
-- route. A transition with nothing outstanding is still raised, still recorded,
-- and still auditable; it simply completes in the same transaction.
--
-- ═════════════════════════════════════════════════════════════
-- 2. ARCHITECTURE 12, THIRD INSTANCE: p_required GOES
-- ═════════════════════════════════════════════════════════════
--
-- `decide_transition_request` took the required tracks AS A PARAMETER and moved
-- the record when that list was exhausted. A caller passing '{}' moved a record
-- that needs three approvals on one approval, and the function is SECURITY
-- DEFINER, so it had the privilege to do it.
--
-- Same shape as p_approver and as from_stage/frozen_revision, both already
-- removed in this round. The test is whether the parameter is about the CALLER
-- or about the WORLD: which tracks a stage requires is a fact the database
-- holds in stage_gate_rules, and a fact the database holds must be read, not
-- accepted.
--
-- ONE DERIVATION, USED BY BOTH FUNCTIONS. required_tracks_for() is the single
-- expression of "which tracks must approve a move out of this stage", so raise
-- and decide cannot disagree about it. src/lib/transition-requests.js keeps
-- requiredTracks() for DISPLAY, and the decide result now returns `required` so
-- a screen can show what the database used rather than recomputing it.
--
-- ═════════════════════════════════════════════════════════════
-- 3. WHY THE ZERO-TRACK REQUEST IS INSERTED ALREADY CLOSED
-- ═════════════════════════════════════════════════════════════
--
-- The freeze makes the order compulsory, exactly as 20260831000003 records for
-- the decide path: while a request is open the record cannot be updated, so the
-- request must reach a closed status BEFORE the status update runs. Inserting it
-- as 'approved' rather than opening and immediately closing it means the freeze
-- never sees an open row, and there is no window in which a crash could leave a
-- record frozen by a request that was about to complete.

-- ---------------------------------------------------------------------------
-- The one derivation
-- ---------------------------------------------------------------------------
create or replace function public.required_tracks_for(p_record_type text, p_from_stage text)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct sgr.requirement_detail->>'track' order by sgr.requirement_detail->>'track'), '{}')
  from public.stage_gate_rules sgr
  where sgr.record_type = p_record_type
    and sgr.from_stage = p_from_stage
    and sgr.requirement_type = 'approval_obtained'
    and coalesce(sgr.requirement_detail->>'track', '') <> '';
$$;

comment on function public.required_tracks_for is
  'Which approval tracks must approve a move OUT of this stage, from '
  'stage_gate_rules. The single derivation: raise and decide both call it, so '
  'they cannot disagree. Round 41 W6, Architecture 12.';

revoke all on function public.required_tracks_for(text, text) from public;
grant execute on function public.required_tracks_for(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Raise: a transition with nothing required completes here
-- ---------------------------------------------------------------------------
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

  select r.id, r.record_type, r.status into v_rec
  from public.records r where r.id = p_record_id;
  if not found then
    raise exception 'no such record' using errcode = 'PT404';
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
  -- update. See the note at the top of this migration.
  if v_immediate then
    update public.records
      set status = p_to_stage, updated_at = now()
      where id = v_rec.id;
  end if;

  return v_row;
end $$;

comment on function public.raise_transition_request is
  'The only writer of transition_requests. Derives record_type, from_stage, '
  'frozen_revision and the REQUIRED TRACKS from the record and the gate rules, '
  'so a caller cannot fabricate any of them, and takes requested_by from '
  'auth.uid(). A transition needing no approval executes here, in the same '
  'transaction, and keeps its request row as the audit of what happened. It '
  'does NOT evaluate exit criteria: that is computeBlocking''s job in the route, '
  'and a second gate computation path in SQL is what Architecture rule 3 forbids.';

revoke all on function public.raise_transition_request(uuid, text, text, uuid) from public;
grant execute on function public.raise_transition_request(uuid, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Decide: p_required removed, not merely ignored
-- ---------------------------------------------------------------------------
--
-- DROPPED rather than left beside the new one. Two overloads would let an old
-- caller keep passing its own list and keep the bypass alive, which is the
-- opposite of what removing it is for.
drop function if exists public.decide_transition_request(uuid, text, text, text, text[]);

create or replace function public.decide_transition_request(
  p_request_id  uuid,
  p_track       text,
  p_decision    text,
  p_reason      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req         public.transition_requests%rowtype;
  v_caller      uuid := auth.uid();
  v_stage       text;
  v_rev         integer;
  v_required    text[];
  v_outstanding text[];
  v_moved       boolean := false;
  v_approval_id uuid;
begin
  if v_caller is null then
    raise exception 'not signed in' using errcode = 'PT401';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'decision must be approved or rejected, got %', p_decision using errcode = 'PT400';
  end if;
  if p_decision = 'rejected' and (p_reason is null or length(btrim(p_reason)) = 0) then
    raise exception 'a rejection needs a reason' using errcode = 'PT400';
  end if;

  select * into v_req from public.transition_requests where id = p_request_id for update;
  if not found then
    raise exception 'no such transition request' using errcode = 'PT404';
  end if;
  if v_req.status <> 'open' then
    raise exception 'this request is % and cannot be decided', v_req.status using errcode = 'PT409';
  end if;

  if v_req.requested_by = v_caller then
    raise exception 'You raised this request, so you cannot approve or reject it.'
      using errcode = 'PT403';
  end if;

  if not exists (
    select 1 from public.track_approvers ta
    where ta.record_type = v_req.record_type and ta.track = p_track
      and ta.user_id = v_caller
      and (ta.record_id is null or ta.record_id = v_req.record_id)
  ) then
    raise exception 'You are not an approver on the % track.', p_track using errcode = 'PT403';
  end if;

  -- ── THE REQUEST MUST STILL DESCRIBE THE RECORD ────────────────────────
  select r.status into v_stage from public.records r where r.id = v_req.record_id;
  select max(rr.revision_number) into v_rev
  from public.record_revisions rr where rr.record_id = v_req.record_id;

  if v_req.from_stage is distinct from v_stage then
    raise exception
      'This request says the record is in %, and it is in %. It was not raised '
      'from the state it claims. Withdraw it and raise a new one.',
      v_req.from_stage, v_stage
      using errcode = 'PT412';
  end if;
  if v_req.frozen_revision is distinct from v_rev then
    raise exception
      'This request froze revision %, and the record is at revision %. Withdraw '
      'it and raise a new one.', v_req.frozen_revision, v_rev
      using errcode = 'PT412';
  end if;

  -- DERIVED FROM THE REQUEST'S OWN from_stage, which was itself derived from
  -- the record at raise time and re-checked against it four lines above.
  v_required := public.required_tracks_for(v_req.record_type, v_req.from_stage);

  -- THE TRACK MUST BE ONE THIS STAGE ASKS FOR. Previously impossible to state,
  -- because the list was the caller's. An approval on a track the gate does not
  -- require is not a smaller approval, it is an approval of nothing, and it
  -- would sit in the audit trail looking like one.
  if p_decision = 'approved' and not (p_track = any(v_required)) then
    raise exception
      'The % track is not required to leave %, so an approval on it would '
      'decide nothing.', p_track, v_req.from_stage
      using errcode = 'PT400';
  end if;

  insert into public.approvals
    (record_id, request_id, revision_number, stage, track, approver_id, decision, comment, decided_at)
  values
    (v_req.record_id, p_request_id, v_req.frozen_revision, v_req.from_stage, p_track, v_caller,
     p_decision, nullif(btrim(coalesce(p_reason, '')), ''), now())
  returning id into v_approval_id;

  if p_decision = 'rejected' then
    update public.transition_requests
      set status = 'rejected', closed_by = v_caller, closed_at = now(), close_reason = p_reason
      where id = p_request_id;
    return jsonb_build_object('approval_id', v_approval_id, 'status', 'rejected',
      'transitioned', false, 'required', to_jsonb(v_required), 'outstanding', '[]'::jsonb);
  end if;

  if v_req.kind = 'review' then
    return jsonb_build_object('approval_id', v_approval_id, 'status', 'open',
      'transitioned', false, 'required', to_jsonb(v_required), 'outstanding', to_jsonb(v_required));
  end if;

  select coalesce(array_agg(t), '{}') into v_outstanding
  from unnest(v_required) as t
  where not exists (
    select 1 from public.approvals a
    where a.request_id = p_request_id and a.track = t and a.decision = 'approved');

  if array_length(v_outstanding, 1) is null then
    update public.transition_requests
      set status = 'approved', closed_by = v_caller, closed_at = now()
      where id = p_request_id;
    update public.records
      set status = v_req.to_stage, updated_at = now()
      where id = v_req.record_id;
    v_moved := true;
  end if;

  return jsonb_build_object(
    'approval_id', v_approval_id,
    'status', case when v_moved then 'approved' else 'open' end,
    'transitioned', v_moved,
    'required', to_jsonb(v_required),
    'outstanding', to_jsonb(coalesce(v_outstanding, '{}')));
end $$;

comment on function public.decide_transition_request is
  'Records one track''s decision and completes the transition when nothing is '
  'outstanding. Derives the caller from auth.uid() and THE REQUIRED TRACKS from '
  'stage_gate_rules: p_required was removed in Round 41 W6 because a caller '
  'passing an empty list moved a record that needed three approvals on one. '
  'Architecture 12.';

revoke all on function public.decide_transition_request(uuid, text, text, text) from public;
grant execute on function public.decide_transition_request(uuid, text, text, text) to authenticated;

-- Architecture 10: the ledger row, in the same paste.
insert into supabase_migrations.schema_migrations (version)
values ('20260831000008')
on conflict (version) do nothing;
