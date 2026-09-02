-- Terminus TMS: a version-scoped approval is not a track a REQUEST collects.
-- Internal review item 4, ruled by the business 2026-09-02.
--
-- Part 3 of the version-gate change. Parts 1 and 2 (the stage_gate_rules
-- scopes) are 20260902000003 and are already applied; this is separate rather
-- than folded into that file, because its version is already in the ledger and
-- editing it afterwards would make the directory claim something was applied
-- that was not. Architecture 10.
--
-- ─────────────────────────────────────────────────────────────
-- THIS IS WHAT MAKES THE FROM-PROPOSAL TRANSITION A CHECK, NOT A WAIT
-- ─────────────────────────────────────────────────────────────
--
-- `raise_transition_request` already executes a transition immediately when it
-- requires no approval tracks. A standing sign-off held against an issued major
-- version is not a track the REQUEST collects: it either exists already or it
-- does not. So the derivation excludes them and the existing zero-track path
-- does the rest. NO NEW MECHANISM.
--
-- The consequence, stated so it is checked rather than assumed:
--
--   Solution Alignment -> Proposal   three stage-scoped tracks -> opens, freezes,
--                                    waits, auto-transitions. UNCHANGED.
--   Proposal onward                  zero collected tracks -> executes on raise,
--                                    no freeze, and the route's gate refuses
--                                    first when the issued major is unapproved.
--
-- AND THIS IS ALSO HOW AUTO-TRANSITION GOES OFF. `decide_transition_request`
-- calls the same function, so from Proposal onward there are no tracks to
-- collect, no last approval, and therefore nothing that moves the record. The
-- transition becomes a separate act.
--
-- THE REASON IS THE BUSINESS'S, recorded as theirs rather than as a technical
-- consequence: this puts the salesperson in control of pace, subject to pricing
-- sign-off. The deal no longer stops dead waiting for three people once the
-- price is agreed; it stops only when the price on the table is not approved.

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
    and coalesce(sgr.requirement_detail->>'track', '') <> ''
    -- The one added clause.
    and coalesce(sgr.requirement_detail->>'scope', '') is distinct from 'version';
$$;

comment on function public.required_tracks_for is
  'Which approval tracks a REQUEST must collect to move out of this stage, from '
  'stage_gate_rules. Version-scoped approvals are excluded: they are standing '
  'sign-offs held against an issued major version, checked by the gate rather '
  'than collected here. The single derivation: raise and decide both call it, '
  'so they cannot disagree. Round 41 W6 and internal review item 4.';

revoke all on function public.required_tracks_for(text, text) from public;
grant execute on function public.required_tracks_for(text, text) to authenticated;

-- ── Asserted in BOTH directions ───────────────────────────────────────────
--
-- A migration that changed nothing would be indistinguishable from one that
-- worked, and this one is a single WHERE clause whose absence is invisible.
do $$
declare
  v_sa text[];
  v_prop text[];
  v_eval text[];
begin
  v_sa := public.required_tracks_for('opportunity', 'Solution Alignment');
  if coalesce(array_length(v_sa, 1), 0) <> 3 then
    raise exception 'Solution Alignment must STILL collect three tracks, got %', v_sa;
  end if;

  v_prop := public.required_tracks_for('opportunity', 'Proposal');
  if coalesce(array_length(v_prop, 1), 0) <> 0 then
    raise exception 'Proposal must collect no tracks under the version gate, got %', v_prop;
  end if;

  v_eval := public.required_tracks_for('opportunity', 'Evaluation');
  if coalesce(array_length(v_eval, 1), 0) <> 0 then
    raise exception 'Evaluation must collect no tracks under the version gate, got %', v_eval;
  end if;
end $$;

-- Architecture 10: the ledger row, in the same paste.
insert into supabase_migrations.schema_migrations (version)
values ('20260902000004')
on conflict (version) do nothing;
