-- Round 7 Phase 3.1: approval scope becomes a property of the rule.
--
-- Problem being fixed. computeBlocking's approval_obtained branch matched
-- approvals on revision_number = the record's current revision. Every PATCH
-- creates a new revision, so any field edit silently voided every approval
-- already given and re-blocked the stage, with nothing on screen to explain
-- why. That is Rule 2 (immutable approved snapshots) applied to the wrong
-- thing: Rule 2 was written for a Deal Sheet frozen at proposal submission,
-- a one-shot event, whereas a Test Bed stage gate sits on a record that is
-- edited for weeks.
--
-- The fix is per-rule, not global. A stage_gate_rules row may now carry a
-- scope in its requirement_detail:
--
--   {"track": "Legal",      "scope": "stage"}     <- Test Bed stage gates
--   {"track": "Commercial", "scope": "revision"}  <- Deal Sheet / proposal
--
-- ABSENT scope DEFAULTS TO "revision". That is a continuity requirement,
-- not a style choice: every existing rule and every already-issued approval
-- must keep behaving exactly as it does today, with no migration of intent.
--
-- This migration only adds the column the "stage" scope needs. It is
-- nullable on purpose - an approval issued before this ran has no stage to
-- record, and inventing one by back-filling from the record's CURRENT
-- status would be fabricating history: the record has very likely moved on
-- since, so the value would be wrong in exactly the way that looks right.
-- Approvals with a null stage simply cannot satisfy a stage-scoped rule,
-- which is the correct conservative answer. (Confirmed at time of writing:
-- the approvals table holds zero rows, so no real history is affected
-- either way - but the reasoning is recorded because it would apply to any
-- future environment that does have history.)
--
-- Constraint 1 of Phase 3.1, deliberately honoured here: revision_number
-- stays NOT NULL and keeps being written even for stage-scoped approvals.
-- Gate on stage, record the revision. The column is not dropped, relaxed,
-- or made conditional, so a future pricing-history feature can still ask
-- "which revision was this approved against" for every approval ever
-- issued, including stage-scoped ones.

alter table public.approvals
  add column if not exists stage text;

comment on column public.approvals.stage is
  'The record''s stage at the moment this approval was issued, captured at '
  'insert time. Used by stage-scoped stage_gate_rules '
  '(requirement_detail.scope = "stage"), which match on this rather than on '
  'revision_number, so that editing a field does not void an approval '
  'already given. NULL for approvals issued before Round 7 Phase 3.1, which '
  'therefore cannot satisfy a stage-scoped rule - deliberately conservative, '
  'since back-filling from the record''s current status would fabricate '
  'history. revision_number is still recorded on every approval regardless '
  'of scope (Phase 3.1 constraint 1), so pricing history stays possible.';

create index if not exists approvals_record_stage_track_idx
  on public.approvals (record_id, stage, track)
  where stage is not null;
