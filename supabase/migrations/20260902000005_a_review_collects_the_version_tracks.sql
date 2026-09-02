-- Terminus TMS: the approvable track set is derived from the request's KIND.
--
-- ORIGIN: 20260902000004, this round, and it is Architecture 8 arriving from
-- the schema side. That migration taught required_tracks_for to exclude
-- version-scoped rules, correctly: a version-scoped approval is a standing
-- sign-off held against an issued major version, not a track a TRANSITION
-- request collects. It then asserted the resulting empty array as its own
-- success condition - "Proposal must collect no tracks under the version gate".
--
-- THE ASSERTION WAS TRUE AND NOBODY ASKED WHO ELSE READS THAT ARRAY.
-- decide_transition_request validates the submitted track against
-- required_tracks_for REGARDLESS OF KIND. From Proposal onward every rule is
-- version-scoped, so the array is empty, so every track is "not required", so
-- an authorised approver could not approve a pricing approval at all. Measured
-- at the server: POST .../approvals returned 400 and wrote zero rows.
--
-- FOUR READERS OF "WHICH TRACKS DOES THIS REQUEST COLLECT". Three branch on
-- kind or scope - transition-requests.js:591, transition-requests.js:247 and
-- records.js:390. The SQL did not. Verification 20 from the schema side: the
-- empty array meaning "a transition needs no stage tracks here" was read as
-- "no track may be approved".
--
-- AND THE ASYMMETRY, which was worse than a clean failure. The check was
-- guarded by p_decision = 'approved', so a rejection skipped it entirely: an
-- approver could REJECT a pricing approval and not APPROVE one. Rejecting
-- worked, which reads as the feature functioning. The check below applies to
-- both decisions.

-- ── THE MIRROR OF required_tracks_for ─────────────────────────────────────
-- Same rows, same filters, the one clause inverted. Deliberately a second
-- function rather than a boolean parameter on the first: the two answer
-- different questions and each has its own caller.
create or replace function public.version_tracks_for(p_record_type text, p_from_stage text)
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
    and coalesce(sgr.requirement_detail->>'track', '') <> ''
    and coalesce(sgr.requirement_detail->>'scope', '') = 'version';
$$;

comment on function public.version_tracks_for is
  'The version-scoped approval tracks at a stage: the standing sign-offs a '
  'pricing review collects, and exactly the set required_tracks_for excludes. '
  'Added 20260902000005 because decide_transition_request was asking the '
  'transition question of a review request.';

-- ── WHAT THIS REQUEST MAY COLLECT, DERIVED FROM ITS KIND ──────────────────
-- Architecture 12: derived from the request and the record, never accepted.
-- p_kind is read from the request row by the caller below, not from an
-- argument supplied by whoever is deciding.
create or replace function public.approvable_tracks_for(
  p_record_type text, p_from_stage text, p_kind text)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_kind = 'review' then public.version_tracks_for(p_record_type, p_from_stage)
    else public.required_tracks_for(p_record_type, p_from_stage)
  end;
$$;

comment on function public.approvable_tracks_for is
  'The tracks a decision on this request can legitimately name. A transition '
  'collects the stage-scoped tracks; a review collects the version-scoped ones. '
  'One question per kind, so an empty set on one is not read as a refusal on '
  'the other.';

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
  -- ── A REVIEW DOES NOT FREEZE, SO IT MUST NOT GO STALE ON A REVISION ──
  --
  -- Ruled 2026-09-03. Found while calibrating this migration's probe and folded
  -- in before it was applied, because it is the NEXT barrier on the same click:
  -- with the track check corrected an approver could approve, and the first
  -- ordinary edit then made the pricing approval undecidable with 'Withdraw it
  -- and raise a new one'. Measured: revision unchanged -> the track refusal,
  -- one edit later -> PT412.
  --
  -- A pricing approval attaches to an ISSUED MAJOR VERSION and deliberately
  -- leaves the record editable, which is the feature. Whether the price has
  -- moved since issue is a question about pricing state, answered by
  -- versionApprovalState at the transition, and NOT a question about the
  -- record's revision number. Checking the revision here was the same
  -- conflation this round removed everywhere else.
  --
  -- from_stage is still checked above for both kinds: a request raised at one
  -- stage is not evidence about another, whatever it froze.
  if v_req.kind <> 'review' and v_req.frozen_revision is distinct from v_rev then
    raise exception
      'This request froze revision %, and the record is at revision %. Withdraw '
      'it and raise a new one.', v_req.frozen_revision, v_rev
      using errcode = 'PT412';
  end if;

  -- DERIVED FROM THE REQUEST'S OWN from_stage AND ITS OWN KIND, both read from
  -- the row rather than taken as arguments. Was required_tracks_for regardless
  -- of kind, which refused every pricing approval from Proposal onward.
  v_required := public.approvable_tracks_for(v_req.record_type, v_req.from_stage, v_req.kind);

  -- THE TRACK MUST BE ONE THIS REQUEST COLLECTS. A decision on a track the
  -- request does not collect is not a smaller decision, it is a decision about
  -- nothing, and it would sit in the audit trail looking like one.
  --
  -- BOTH DECISIONS. The 'approved' guard this replaces let a rejection through
  -- unchecked, so the two halves of one control disagreed.
  if not (p_track = any(v_required)) then
    if v_req.kind = 'review' then
      raise exception
        'The % track is not part of the pricing approval at %, so a decision on '
        'it would decide nothing.', p_track, v_req.from_stage
        using errcode = 'PT400';
    else
      raise exception
        'The % track is not required to leave %, so a decision on it would '
        'decide nothing.', p_track, v_req.from_stage
        using errcode = 'PT400';
    end if;
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

  -- Computed before the kind branch now. It used to sit after it, so a review
  -- reported its WHOLE required set as outstanding: harmless while that set was
  -- empty, and wrong the moment this migration made it the three version tracks.
  select coalesce(array_agg(t), '{}') into v_outstanding
  from unnest(v_required) as t
  where not exists (
    select 1 from public.approvals a
    where a.request_id = p_request_id and a.track = t and a.decision = 'approved');

  -- A review does not move the record and does not close: the version gate is
  -- checked at the transition, synchronously. Unchanged by this migration.
  if v_req.kind = 'review' then
    return jsonb_build_object('approval_id', v_approval_id, 'status', 'open',
      'transitioned', false, 'required', to_jsonb(v_required),
      'outstanding', to_jsonb(coalesce(v_outstanding, '{}')));
  end if;

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
  'outstanding. Derives the caller from auth.uid(), the stage and revision from '
  'the record, and THE APPROVABLE TRACKS from the request''s own kind via '
  'approvable_tracks_for: a transition collects stage-scoped tracks, a review '
  'collects version-scoped ones. Architecture 12.';

revoke all on function public.version_tracks_for(text, text) from public;
grant execute on function public.version_tracks_for(text, text) to authenticated;
revoke all on function public.approvable_tracks_for(text, text, text) from public;
grant execute on function public.approvable_tracks_for(text, text, text) to authenticated;
revoke all on function public.decide_transition_request(uuid, text, text, text) from public;
grant execute on function public.decide_transition_request(uuid, text, text, text) to authenticated;

-- ── SELF-CHECK, the same instrument 20260902000004 used ───────────────────
-- Stated as the two sets being DIFFERENT and each non-empty where it should be,
-- which is what the previous migration's assertion could not see.
do $$
declare
  v_stage_at_sa   text[] := public.approvable_tracks_for('opportunity', 'Solution Alignment', 'transition');
  v_review_at_sa  text[] := public.approvable_tracks_for('opportunity', 'Solution Alignment', 'review');
  v_stage_at_prop text[] := public.approvable_tracks_for('opportunity', 'Proposal', 'transition');
  v_rev_at_prop   text[] := public.approvable_tracks_for('opportunity', 'Proposal', 'review');
begin
  if array_length(v_stage_at_sa, 1) is distinct from 3 then
    raise exception 'Solution Alignment transition must collect three stage tracks, got %', v_stage_at_sa;
  end if;
  if array_length(v_review_at_sa, 1) is not null then
    raise exception 'Solution Alignment has no version rules, so a review collects nothing, got %', v_review_at_sa;
  end if;
  if array_length(v_stage_at_prop, 1) is not null then
    raise exception 'Proposal must collect no stage tracks under the version gate, got %', v_stage_at_prop;
  end if;
  -- THE ONE THAT WOULD HAVE CAUGHT THE DEFECT.
  if array_length(v_rev_at_prop, 1) is distinct from 3 then
    raise exception 'A review at Proposal must collect three version tracks, got %', v_rev_at_prop;
  end if;
end $$;

-- Two new functions, so the API's schema cache has to be told.
notify pgrst, 'reload schema';

-- Architecture 10: the ledger row, in the same paste.
insert into supabase_migrations.schema_migrations (version)
values ('20260902000005')
on conflict (version) do nothing;
