-- Terminus TMS: the version gate begins at Proposal exit. Internal review
-- item 4, ruled by the business 2026-09-02.
--
-- ─────────────────────────────────────────────────────────────
-- WHAT THIS CHANGES, AND WHAT IT DELIBERATELY DOES NOT
-- ─────────────────────────────────────────────────────────────
--
-- Up to and including Solution Alignment -> Proposal, the model is UNCHANGED:
-- stage-gated, freeze-and-wait, auto-transition on the last approval. That is
-- the Bid/No Bid decision and it is meant to stop the deal dead until three
-- people agree.
--
-- From Proposal EXIT onward the model becomes version-gated: approvals attach
-- to a major pricing version rather than to a stage, they do not freeze the
-- record, and the transition is a CHECK against them rather than a wait for
-- them.
--
-- ─────────────────────────────────────────────────────────────
-- THIS IS CONFIGURATION, AND IT CORRECTS A DISAGREEMENT
-- ─────────────────────────────────────────────────────────────
--
-- 20260829000005 made the Commercial track version-scoped on EVERY transition,
-- including Solution Alignment -> Proposal. That was found by reading the rows
-- rather than the documents, and it disagreed with the model the business had
-- described in two directions at once:
--
--   Solution Alignment -> Proposal   Commercial was version, should be STAGE
--   Proposal -> Evaluation           Technical and Legal were stage, should be VERSION
--   Evaluation -> Negotiating        same
--   Negotiating -> Closed Won        same
--
-- It never MATTERED, because `approvalSatisfiesRule` short-circuits on the
-- workflow's request approvals before it reaches the version branch, so every
-- scope read the same for an Opportunity. The accompanying code change makes
-- the branch reachable, which is what turns this row from decoration into
-- behaviour - so the two must land together.
--
-- Nothing in supabase/seeds/ carries these rows: they are migration-created
-- (20260829000005 and its predecessors), checked rather than assumed, so there
-- is no seed to reconcile under Architecture 4.

-- ── 1. Solution Alignment -> Proposal goes back to all-stage ──────────────
update public.stage_gate_rules
   set requirement_detail = jsonb_build_object('scope', 'stage', 'track', 'Commercial')
 where record_type = 'opportunity'
   and requirement_type = 'approval_obtained'
   and from_stage = 'Solution Alignment'
   and to_stage = 'Proposal'
   and requirement_detail->>'track' = 'Commercial'
   and requirement_detail->>'scope' is distinct from 'stage';

-- ── 2. From Proposal onward, ALL THREE tracks are version-scoped ──────────
--
-- Guarded on the value rather than blanket-set, so a replay is a no-op
-- (Architecture 7) and so the row count reported below is the real change.
update public.stage_gate_rules
   set requirement_detail = jsonb_build_object('scope', 'version', 'track', requirement_detail->>'track')
 where record_type = 'opportunity'
   and requirement_type = 'approval_obtained'
   and from_stage in ('Proposal', 'Evaluation', 'Negotiating')
   and requirement_detail->>'scope' is distinct from 'version';

-- ── The state this leaves, asserted rather than described ─────────────────
--
-- A migration that silently did nothing would be indistinguishable from one
-- that worked, so it refuses to finish in the wrong state.
do $$
declare
  v_sa_version int;
  v_after_stage int;
  v_after_total int;
begin
  select count(*) into v_sa_version from public.stage_gate_rules
   where record_type = 'opportunity' and requirement_type = 'approval_obtained'
     and from_stage = 'Solution Alignment' and requirement_detail->>'scope' = 'version';
  if v_sa_version <> 0 then
    raise exception 'Solution Alignment still carries % version-scoped approval rule(s); it must stay stage-gated', v_sa_version;
  end if;

  select count(*) into v_after_stage from public.stage_gate_rules
   where record_type = 'opportunity' and requirement_type = 'approval_obtained'
     and from_stage in ('Proposal', 'Evaluation', 'Negotiating')
     and requirement_detail->>'scope' is distinct from 'version';
  if v_after_stage <> 0 then
    raise exception '% approval rule(s) from Proposal onward are not version-scoped', v_after_stage;
  end if;

  select count(*) into v_after_total from public.stage_gate_rules
   where record_type = 'opportunity' and requirement_type = 'approval_obtained'
     and from_stage in ('Proposal', 'Evaluation', 'Negotiating');
  -- Three transitions, three tracks each. A count that has drifted means a
  -- track was added or lost and the model above no longer describes the data.
  if v_after_total <> 9 then
    raise exception 'expected 9 approval rules from Proposal onward, found %', v_after_total;
  end if;
end $$;

-- ── PART 3 IS NOT IN THIS FILE, AND THAT IS DELIBERATE ───────────────────
--
-- This migration was applied by hand carrying parts 1 and 2 only. The third
-- part, excluding version-scoped rules from `required_tracks_for`, was written
-- afterwards and is 20260902000004.
--
-- It was NOT folded back in here. This file's version is already in
-- `supabase_migrations.schema_migrations`, so a reader reconciling the
-- directory against the ledger would see it present in both and conclude that
-- THIS content had been applied. It had not. Architecture 10 exists to stop the
-- schema and the ledger disagreeing, and quietly editing an applied file is the
-- same disagreement with better manners.

-- Architecture 10: the ledger row, in the same paste.
insert into supabase_migrations.schema_migrations (version)
values ('20260902000003')
on conflict (version) do nothing;
