-- Terminus TMS: a reason is required at both confirmation levels. Round 33
-- Phase 2, 2026-08-26.
--
-- ============================================================================
-- THE REASON DOES TWO JOBS HERE, WHICH IS WHY THIS DIFFERS FROM THE EVIDENCE
-- SCALE
-- ============================================================================
--
-- On `Deal evidence, five level` exactly one level requires a reason: Unknown.
-- The rule Round A Phase 3 replaced was "a reason is required at a score of 1
-- or 2", and the intent it carried is that a reason explains a GAP. Unknown is
-- the gap the assessment exists to surface, so it is the level that must say
-- what is missing.
--
-- ON THIS SCALE THE REASON IS NOT ONLY ABOUT GAPS. The business: "these are
-- binary but we will need evidence." On Not confirmed the reason says what is
-- outstanding; on Confirmed it says what confirms it. For a Legal criterion
-- that second job is the record actually worth having, because the licence
-- reference or the DPA clause is the thing somebody will look for later, and a
-- lens where every confirmed requirement carries its evidence is worth more
-- than one where only the gaps are explained.
--
-- THE COST IS REAL AND ACCEPTED: a Legal person confirming eight requirements
-- types eight reasons.
--
-- NOT APPLICABLE STAYS FREE, and that is the same reasoning Round 28 used for
-- the evidence scale's Not applicable. It is a complete answer that closes the
-- question, and charging for it would make the honest answer the expensive one
-- and the dishonest one cheap. The path a scorer should take is the path that
-- costs least.
--
-- ============================================================================
-- NOTHING IN CODE CHANGES
-- ============================================================================
--
-- `reason_required` is read from the level row on both sides.
-- `src/lib/score-entry.js` refuses a blank reason with 400, and
-- `frontend/app.js` computes `mustGiveReason` from the same field, so this
-- migration alters behaviour on both paths without a line of either changing.
-- That is Round A Phase 3's data-driven work paying off, the same way Round
-- 24's `allowed.includes(score)` paid off in Phase 1.
--
-- No criterion points at this scale yet, so no stored entry can be
-- retrospectively invalidated by requiring a reason. The requirement applies
-- from the first score recorded against it.
--
-- Idempotent per Architecture rule 7: guarded on the value the row is moving
-- FROM, so a replay matches nothing. No seed file carries scoring_scale_levels,
-- checked and calibrated against stage_gate_rules, which the seeds do carry.

update public.scoring_scale_levels l
set reason_required = true
from public.scoring_scales s
where l.scale_id = s.id
  and s.name = 'Requirement confirmation, three level'
  and l.value in (2, 4)
  and l.reason_required = false;
