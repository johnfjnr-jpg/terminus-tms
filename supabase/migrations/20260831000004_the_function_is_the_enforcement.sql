-- Terminus TMS: the route is the message, the database is the enforcement.
-- Round 41, after measuring both direct paths as an ordinary authenticated user.
--
-- ─────────────────────────────────────────────────────────────
-- WHAT WAS MEASURED, AND IT IS THE WHOLE REASON FOR THIS FILE
-- ─────────────────────────────────────────────────────────────
--
-- Acting as a real user with the publishable key and their own JWT, no Fastify
-- anywhere in the probe:
--
--   0. INSERT a transition_request      REFUSED 42501   <- the route cannot work
--   a. INSERT an approval directly      PERMITTED       <- self-approving, on a
--                                                          track they are not
--                                                          listed for
--   b. CALL decide_transition_request   PERMITTED       <- same
--   c. INSERT an approval AS SOMEBODY ELSE  REFUSED 42501
--
-- So the self-approval rule and the track-membership rule were ROUTE RULES ONLY,
-- and this project has now written down three times that a route guard is a
-- declared policy rather than an enforcement. The one boundary that held, (c),
-- held because it was a POLICY rather than a route check.
--
-- AND (0) IS A DEFECT THAT BLOCKS THE FEATURE OUTRIGHT: transition_requests was
-- created with a SELECT policy and no INSERT policy, and the raise route runs as
-- the calling user, so nobody could raise a request at all. Nothing caught it
-- because nothing had exercised the route end to end yet.
--
-- ─────────────────────────────────────────────────────────────
-- THE SPLIT, RULED BY THE BUSINESS
-- ─────────────────────────────────────────────────────────────
--
-- The route keeps its check FOR THE ERROR MESSAGE. The function is the
-- ENFORCEMENT. They are not duplicates: one exists to be readable and one exists
-- to be unbypassable, and only the second is load-bearing.

-- ─────────────────────────────────────────────────────────────
-- 1. THE MISSING POLICIES
-- ─────────────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'transition_requests' and policyname = 'transition_requests_insert') then
    -- A request is raised IN YOUR OWN NAME. Without this clause a user could
    -- raise one as somebody else and the self-approval rule would be a formality.
    create policy transition_requests_insert on public.transition_requests
      for insert to authenticated
      with check (requested_by = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where tablename = 'transition_requests' and policyname = 'transition_requests_withdraw') then
    -- WITHDRAWAL IS THE ONLY UPDATE A USER MAY MAKE, and only the requester, and
    -- only while it is open. Ruled: no admin concept. Closing a request by
    -- approving or rejecting it goes through the function, which is definer and
    -- does not consult this.
    create policy transition_requests_withdraw on public.transition_requests
      for update to authenticated
      using (requested_by = auth.uid() and status = 'open')
      with check (requested_by = auth.uid() and status = 'withdrawn');
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 2. A REQUEST-BOUND APPROVAL COMES FROM THE FUNCTION OR NOWHERE
-- ─────────────────────────────────────────────────────────────
--
-- This is path (a) closed. `auth.uid() = approver_id` was never enough: it stops
-- impersonation and says nothing about whether you may decide THIS request on
-- THIS track. Rather than restate the workflow's rules in a policy, the policy
-- refuses request-bound rows outright and the definer function writes them.
--
-- Pre-workflow rows and Test Bed's approvals are unaffected: they carry a null
-- request_id and keep exactly the rule they had.

drop policy if exists "approvals_insert" on public.approvals;
create policy "approvals_insert" on public.approvals
  for insert to authenticated
  with check (auth.uid() = approver_id and request_id is null);

comment on table public.approvals is
  'A request-bound approval (request_id not null) can only be written by '
  'decide_transition_request, which is SECURITY DEFINER and checks who is '
  'asking. The insert policy refuses them directly, so the workflow''s rules '
  'cannot be walked around with the publishable key.';

-- ─────────────────────────────────────────────────────────────
-- 3. THE FUNCTION STOPS TAKING "WHO IS ASKING" ON TRUST
-- ─────────────────────────────────────────────────────────────
--
-- p_approver is GONE. It was a parameter, which means it was an assertion by the
-- caller, and the caller is exactly who this is meant to constrain. auth.uid()
-- is the only thing here that cannot be argued with.
--
-- The old signature is dropped in the same migration, per the rule
-- revision-preconditions.test.mjs enforces: a migration that changes a
-- function's parameters drops the version it replaces, or both remain callable
-- and the old one is the unguarded one.

drop function if exists public.decide_transition_request(uuid, text, uuid, text, text, text[]);

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

  -- ── THE TWO RULES, HERE RATHER THAN ONLY IN THE ROUTE ──────────────────
  --
  -- Measured: without these, an ordinary user could call this function with the
  -- publishable key and approve their own request on a track they hold no role
  -- on. The route still checks both, because "You raised this request, so you
  -- cannot approve it" is a better thing to read than a SQLSTATE.
  if v_req.requested_by = v_caller then
    raise exception
      'You raised this request, so you cannot approve or reject it.'
      using errcode = 'PT403';
  end if;

  if not exists (
    select 1 from public.track_approvers ta
    where ta.record_type = v_req.record_type
      and ta.track = p_track
      and ta.user_id = v_caller
      and (ta.record_id is null or ta.record_id = v_req.record_id)
  ) then
    raise exception 'You are not an approver on the % track.', p_track using errcode = 'PT403';
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

comment on function public.decide_transition_request is
  'Records one track''s decision and, when it is the last outstanding one, '
  'closes the request and moves the record IN THE SAME TRANSACTION. THE '
  'ENFORCEMENT LIVES HERE: it reads auth.uid() rather than trusting a parameter, '
  'refuses the requester on every track, and refuses anyone not in '
  'track_approvers for that track. The route checks the same two things so the '
  'user reads a sentence rather than a SQLSTATE.';

-- EXECUTE STAYS GRANTED. The route calls this as the signed-in user, so
-- authenticated needs it; revoking would break the route it is the enforcement
-- for. That is why the check had to move INSIDE rather than the door being shut.
revoke all on function public.decide_transition_request(uuid, text, text, text, text[]) from public;
grant execute on function public.decide_transition_request(uuid, text, text, text, text[]) to authenticated;

-- Architecture 10: the ledger row, in the same paste.
insert into supabase_migrations.schema_migrations (version)
values ('20260831000004')
on conflict (version) do nothing;
