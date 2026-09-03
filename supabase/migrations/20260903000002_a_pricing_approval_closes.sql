-- Terminus TMS: a pricing approval CLOSES, by both routes it can close by.
--
-- W2, ruled 2026-09-03 after the walk found a banner reading "V1 is waiting on
-- approval" on a record whose V1 had every track approved and whose current
-- pricing had reached V3. Refreshing did not clear it, and that was not a stale
-- read: the row genuinely WAS open, so the server kept returning it and the
-- banner faithfully reported a true fact about a request nothing ever closed.
--
-- TWO INDEPENDENT CAUSES, both measured, and either alone reproduces the stuck
-- banner:
--
--   1. decide_transition_request returned 'open' UNCONDITIONALLY for a review,
--      so approving the last track never closed anything.
--   2. Issuing a new major version did not touch the prior major's review.
--      deal-sheet-versions.js mentions transition_requests ZERO times: not a
--      failed attempt, no attempt.
--
-- Fixing one would have left the other producing the same screen, which is why
-- both are in one migration and both are calibrated.

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

  -- ── A REVIEW CLOSES WHEN ITS LAST TRACK APPROVES, AND DOES NOT MOVE ──
  --
  -- W2 cause 1, ruled 2026-09-03. This returned 'open' UNCONDITIONALLY, so a
  -- pricing approval with every track approved stayed open for ever and the
  -- banner went on saying the version was waiting on approval. Measured on live
  -- data: request 653d931d, frozen on V1, all three tracks approved, still
  -- open, on a record whose highest issued version had reached V3.
  --
  -- IT STILL DOES NOT TRANSITION. Ruling B stands: a review is a standing
  -- sign-off against an issued major version, and the from-Proposal transition
  -- CHECKS it synchronously. Closing is not moving.
  --
  -- The approvals stand as the sign-off after the close, which is what makes
  -- the closed request readable as "approved" rather than as "gone".
  if v_req.kind = 'review' then
    if array_length(v_outstanding, 1) is null then
      update public.transition_requests
        set status = 'approved', closed_by = v_caller, closed_at = now()
        where id = p_request_id;
      return jsonb_build_object('approval_id', v_approval_id, 'status', 'approved',
        'transitioned', false, 'required', to_jsonb(v_required), 'outstanding', '[]'::jsonb);
    end if;
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
  'Records one track''s decision. A transition completes and moves the record '
  'when nothing is outstanding; a REVIEW closes as approved when nothing is '
  'outstanding and never moves the record. Derives the caller from auth.uid(), '
  'the stage and revision from the record, and the approvable tracks from the '
  'request''s own kind. Architecture 12.';

-- ── CAUSE 2: ISSUING A NEW MAJOR SUPERSEDES THE PRIOR MAJOR'S REVIEW ─────
--
-- Ruling A's re-arming, applied to the REQUEST rather than to the approvals.
-- A review is a sign-off on a specific issued major version. Once a newer major
-- exists, the price that was signed off is not the price on the table, so the
-- request is closed and V2 needs its own.
--
-- A TRIGGER ON THE FACT, for the same reason W1's probability trigger is one:
-- the issue route is one issuer today and the rule is about a version becoming
-- issued, not about who issued it. Architecture 3, one computation path.
--
-- SCOPED TO A PRIOR MAJOR, literally as ruled. A review whose frozen_version_id
-- is null names no major and is therefore not "a review for a prior major";
-- those are left alone rather than swept up, and they are visible to anybody
-- who wants to rule on them separately.
create or replace function public.close_superseded_reviews()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'issued' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'issued' then return new; end if;

  update public.transition_requests tr
     set status = 'superseded',
         closed_at = now(),
         close_reason = format(
           'Superseded by V%s. The approvals on it stand as the record of what '
           'was signed off; the price on the table has moved.', new.major)
    from public.deal_sheet_versions frozen
   where tr.record_id = new.record_id
     and tr.kind = 'review'
     and tr.status = 'open'
     and frozen.id = tr.frozen_version_id
     and frozen.major < new.major;

  return new;
end $$;

comment on function public.close_superseded_reviews is
  'Closes any open pricing-approval request held against an EARLIER major '
  'version when a new major is issued. The approvals stay as history. Added '
  'because the issue route never referenced transition_requests at all.';

drop trigger if exists deal_sheet_versions_supersede_reviews_trg on public.deal_sheet_versions;
create trigger deal_sheet_versions_supersede_reviews_trg
  after insert or update of status on public.deal_sheet_versions
  for each row execute function public.close_superseded_reviews();

revoke all on function public.decide_transition_request(uuid, text, text, text) from public;
grant execute on function public.decide_transition_request(uuid, text, text, text) to authenticated;

-- ── THE STUCK REQUEST THE WALK FOUND ────────────────────────────────────
--
-- Closed under the rule that now exists, rather than left as the one row the
-- new behaviour does not reach. Guarded so a replay is a no-op, Architecture 7.
update public.transition_requests tr
   set status = 'superseded', closed_at = now(),
       close_reason = 'Superseded by a later major version issued before this rule existed.'
  from public.deal_sheet_versions frozen,
       lateral (select max(v.major) as top from public.deal_sheet_versions v
                 where v.record_id = tr.record_id and v.status = 'issued') newest
 where tr.kind = 'review' and tr.status = 'open'
   and frozen.id = tr.frozen_version_id
   and newest.top > frozen.major;

do $$
declare v_stuck integer;
begin
  select count(*) into v_stuck
  from public.transition_requests tr
  join public.deal_sheet_versions frozen on frozen.id = tr.frozen_version_id
  where tr.kind = 'review' and tr.status = 'open'
    and exists (select 1 from public.deal_sheet_versions v
                 where v.record_id = tr.record_id and v.status = 'issued'
                   and v.major > frozen.major);
  if v_stuck <> 0 then
    raise exception '% review requests still held against a superseded major', v_stuck;
  end if;
end $$;

notify pgrst, 'reload schema';

-- Architecture 10: the ledger row, in the same paste.
insert into supabase_migrations.schema_migrations (version)
values ('20260903000002')
on conflict (version) do nothing;
