-- Terminus TMS: a request is raised by a function, and executing one checks that
-- it still describes the record. Round 41, on the business's correction.
--
-- ─────────────────────────────────────────────────────────────
-- THE THREAT, RESTATED CORRECTLY
-- ─────────────────────────────────────────────────────────────
--
-- I recorded the raise-path gap as a self-inflicted freeze the raiser could
-- withdraw. THAT WAS WRONG AND IT UNDER-RATED IT. The business's wording is the
-- accurate one:
--
--   A DIRECT RAISE SKIPS THE EXIT-CRITERIA CHECK AND APPROVERS CANNOT TELL.
--   The consequence is a TRANSITION WITHOUT CRITERIA, not a nuisance.
--
-- An approver sees a request naming a stage and three tracks. Nothing on it says
-- whether the criteria were ever met, so three people approve in good faith and
-- the record moves. The gate is not bypassed by defeating it; it is bypassed by
-- never asking it.
--
-- ─────────────────────────────────────────────────────────────
-- 1. DIRECT INSERTS ARE REFUSED. A DEFINER FUNCTION IS THE ONLY WRITER
-- ─────────────────────────────────────────────────────────────
--
-- Same shape as approvals in 20260831000004: the policy refuses the row outright
-- rather than restating the workflow's rules, and a SECURITY DEFINER function
-- writes it.
--
-- AND THE FUNCTION DERIVES WHAT IT COULD HAVE BEEN TOLD. from_stage,
-- record_type and frozen_revision are READ FROM THE RECORD, not taken as
-- parameters. A parameter is an assertion by the caller, and this is the second
-- time in two migrations that removing one closed a hole: p_approver went the
-- same way.

drop policy if exists transition_requests_insert on public.transition_requests;

comment on table public.transition_requests is
  'A request to move a record to another stage, approved track by track. INSERTS '
  'ARE REFUSED BY POLICY: raise_transition_request is the only writer, and it '
  'derives record_type, from_stage and frozen_revision from the record rather '
  'than accepting them. While a transition request is open the record is FROZEN.';

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
  v_caller uuid := auth.uid();
  v_rec    record;
  v_rev    integer;
  v_row    public.transition_requests%rowtype;
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

  insert into public.transition_requests
    (record_id, record_type, from_stage, to_stage, kind, status,
     frozen_revision, frozen_version_id, requested_by)
  values
    (v_rec.id, v_rec.record_type, v_rec.status, p_to_stage, p_kind, 'open',
     v_rev, p_frozen_version_id, v_caller)
  returning * into v_row;

  return v_row;
end $$;

comment on function public.raise_transition_request is
  'The only writer of transition_requests. Derives record_type, from_stage and '
  'frozen_revision FROM THE RECORD so a caller cannot fabricate them, and takes '
  'requested_by from auth.uid() so a request cannot be raised in somebody '
  'else''s name. It does NOT evaluate exit criteria: that is computeBlocking''s '
  'job in the route, and a second gate computation path in SQL is what '
  'Architecture rule 3 forbids. See the residual note in the migration.';

revoke all on function public.raise_transition_request(uuid, text, text, uuid) from public;
grant execute on function public.raise_transition_request(uuid, text, text, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. EXECUTING A REQUEST CHECKS THAT IT STILL DESCRIBES THE RECORD
-- ─────────────────────────────────────────────────────────────
--
-- The control that makes a fabricated request fail AT EXECUTION. from_stage must
-- equal the record's current stage and frozen_revision must equal its current
-- revision, or the request is describing something that is no longer true and
-- moving the record on it would be moving it from a stage it is not in.
--
-- For a transition request the freeze holds both still, so in ordinary operation
-- this can never fire. THAT IS THE POINT: it fires only when a row got in by a
-- route this migration does not know about, which is exactly the case a control
-- exists for. PT412, its own SQLSTATE, because "this request no longer matches
-- the record" is not a conflict and not a permission problem.

create or replace function public.decide_transition_request(
  p_request_id  uuid,
  p_track       text,
  p_decision    text,
  p_reason      text default null,
  p_required    text[] default '{}'
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
      'transitioned', false, 'outstanding', '[]'::jsonb);
  end if;

  if v_req.kind = 'review' then
    return jsonb_build_object('approval_id', v_approval_id, 'status', 'open',
      'transitioned', false, 'outstanding', to_jsonb(p_required));
  end if;

  select coalesce(array_agg(t), '{}') into v_outstanding
  from unnest(p_required) as t
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
    'outstanding', to_jsonb(coalesce(v_outstanding, '{}')));
end $$;

-- ─────────────────────────────────────────────────────────────
-- 3. THE RESIDUAL, RECORDED WITH ITS ACCURATE THREAT
-- ─────────────────────────────────────────────────────────────
--
-- What is now impossible: raising in somebody else's name, fabricating a stage
-- or a revision, deciding your own request, deciding a track you hold no role
-- on, writing a request-bound approval by hand, and executing a request that no
-- longer matches the record.
--
-- WHAT REMAINS: a caller may invoke raise_transition_request directly, with the
-- publishable key, and skip the route's computeBlocking. The request that
-- results is HONEST about the record - correct stage, correct revision - and
-- dishonest by omission: nobody asked whether the exit criteria were met.
--
-- IT CANNOT BE CLOSED IN SQL WITHOUT A SECOND GATE COMPUTATION PATH. The gate is
-- computeBlocking, in JavaScript, reading stage_gate_rules; reimplementing it
-- here would be the fork Architecture rule 3 forbids, and two implementations
-- that agree today would disagree later.
--
-- SO THE ANSWER IS THE BUSINESS'S OWN WORDING: the threat is that APPROVERS
-- CANNOT TELL. The fix belongs on the approver's screen and in the queue, where
-- each request carries the criteria state at the moment it is decided. That is
-- the client boundary's work and it is named here so it is not lost.

insert into supabase_migrations.schema_migrations (version)
values ('20260831000005')
on conflict (version) do nothing;
