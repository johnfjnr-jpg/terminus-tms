-- Terminus TMS: deciding a transition request is ONE act. Round 41.
--
-- ─────────────────────────────────────────────────────────────
-- WHY THIS IS A FUNCTION AND NOT THREE ROUTE STATEMENTS
-- ─────────────────────────────────────────────────────────────
--
-- Approving the last outstanding track does four things: it records the
-- approval, it closes the request, it moves the record, and it writes the audit
-- row. THE FREEZE MAKES THEM ORDER-DEPENDENT: while the request is open,
-- refuse_write_while_frozen() refuses the status update, so the request must
-- close first. And once it has closed, a crash leaves a request marked APPROVED
-- against a record that never moved, which is a lie in the audit trail rather
-- than a recoverable state.
--
-- Same reasoning as 20260829000002: the version insert became a function because
-- the revision it records must not move between being checked and being written.
-- Here the request's completeness must not move between being judged and being
-- acted on.
--
-- ─────────────────────────────────────────────────────────────
-- WHAT IT DOES NOT DO
-- ─────────────────────────────────────────────────────────────
--
-- It does not decide WHO may approve. That rule compares the request's requester
-- with the caller and consults track_approvers, and it lives in the route, where
-- the caller's identity is a fact rather than an argument. A function taking
-- "who is asking" on trust would be a worse place for it.
--
-- It does not evaluate exit criteria either. Those are checked when the request
-- is RAISED, against a record that then freezes, so re-checking here would ask a
-- question whose answer cannot have changed.

create or replace function public.decide_transition_request(
  p_request_id  uuid,
  p_track       text,
  p_approver    uuid,
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
  v_outstanding text[];
  v_moved       boolean := false;
  v_approval_id uuid;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'decision must be approved or rejected, got %', p_decision using errcode = 'PT400';
  end if;
  if p_decision = 'rejected' and (p_reason is null or length(btrim(p_reason)) = 0) then
    raise exception 'a rejection needs a reason' using errcode = 'PT400';
  end if;

  -- THE LOCK. Two approvers deciding the last two tracks at the same moment
  -- would otherwise both read "one outstanding" and neither would transition, or
  -- both would.
  select * into v_req from public.transition_requests
  where id = p_request_id for update;

  if not found then
    raise exception 'no such transition request' using errcode = 'PT404';
  end if;
  if v_req.status <> 'open' then
    raise exception 'this request is % and cannot be decided', v_req.status using errcode = 'PT409';
  end if;

  insert into public.approvals
    (record_id, request_id, revision_number, stage, track, approver_id, decision, comment, decided_at)
  values
    (v_req.record_id, p_request_id, v_req.frozen_revision, v_req.from_stage, p_track, p_approver,
     p_decision, nullif(btrim(coalesce(p_reason, '')), ''), now())
  returning id into v_approval_id;

  -- ── A REJECTION IS DECISIVE ────────────────────────────────────────────
  --
  -- Ruled: any rejection closes the request. The other tracks' approvals stay on
  -- it as audit and do not carry over, which is why nothing is deleted here.
  if p_decision = 'rejected' then
    update public.transition_requests
      set status = 'rejected', closed_by = p_approver, closed_at = now(),
          close_reason = p_reason
      where id = p_request_id;

    return jsonb_build_object(
      'approval_id', v_approval_id, 'status', 'rejected',
      'transitioned', false, 'outstanding', '[]'::jsonb);
  end if;

  -- A review request never transitions anything, whatever its tracks say.
  if v_req.kind = 'review' then
    return jsonb_build_object(
      'approval_id', v_approval_id, 'status', 'open',
      'transitioned', false, 'outstanding', to_jsonb(p_required));
  end if;

  select coalesce(array_agg(t), '{}') into v_outstanding
  from unnest(p_required) as t
  where not exists (
    select 1 from public.approvals a
    where a.request_id = p_request_id and a.track = t and a.decision = 'approved');

  if array_length(v_outstanding, 1) is null then
    -- CLOSE FIRST, THEN MOVE. The freeze refuses the status update while the
    -- request is open, and both statements are in this one transaction, so the
    -- window the route could not have closed does not exist.
    update public.transition_requests
      set status = 'approved', closed_by = p_approver, closed_at = now()
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
  'Records one track''s decision on a transition request and, when it is the '
  'last one outstanding, closes the request and moves the record IN THE SAME '
  'TRANSACTION. The freeze refuses the status update while the request is open, '
  'so the order is forced; doing it in two route calls would leave a request '
  'marked approved against a record that never moved. Who may decide is the '
  'route''s rule, not this function''s.';

revoke all on function public.decide_transition_request(uuid, text, uuid, text, text, text[]) from public;
grant execute on function public.decide_transition_request(uuid, text, uuid, text, text, text[]) to authenticated;

-- Architecture 10: the ledger row, in the same paste.
insert into supabase_migrations.schema_migrations (version)
values ('20260831000003')
on conflict (version) do nothing;
