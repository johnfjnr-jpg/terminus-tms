-- Terminus TMS: the confirmation scale gains Not applicable. Round 33 Phase 1,
-- 2026-08-26.
--
-- ============================================================================
-- THIS REVERSES A DECISION, AND THE REASONING IS THE POINT
-- ============================================================================
--
-- Round 24 recorded "Binary criteria remain two-state" as a decision. This
-- migration makes the scale three-state and renames it, and the reason is a
-- consequence Round 24 could not have seen: the lens rollups did not exist
-- until Round 32.
--
-- A rollup is satisfied when every criterion in a lens at a stage is at Not
-- applicable, Buyer confirmed or Verified. A two-state scale has no Not
-- applicable, so a criterion that genuinely does not apply to a deal has
-- nowhere to say so and reads as UNSATISFIED FOR THE LIFE OF THE RECORD.
--
-- Nine criteria are on this scale and eight of them are Legal: export control
-- on a domestic deal, local content where there is no offset regime,
-- anti-corruption diligence where there is no intermediary. A Legal rollup
-- that can never reach 8 of 8 stops being read, which is the failure Round 26
-- chose a manual tick over a computed rollup to avoid.
--
-- SECOND REASON, INDEPENDENT OF THE ROLLUP. A row says a criterion is
-- unassessed BY SILENCE: no segment is filled. Against five levels silence can
-- only mean "no judgement". Against "Not confirmed / Confirmed" silence reads
-- as "not confirmed", which is a claim the record has not made. A third level
-- restores the distinction, because silence is again none of the three.
--
-- WHY NOW. scoring_anchors is append only. Nine criteria configured against a
-- two-level scale and migrated afterwards is nine criteria rows, eighteen
-- anchors and a version bump. Done before anything points at the scale it is
-- one migration and no anchors to supersede.
--
-- ============================================================================
-- THE VALUES ARE 1, 2 AND 4, AND THE GAPS ARE THE DESIGN
-- ============================================================================
--
-- Each state takes the value of the five-level state it is ordinally
-- equivalent to, so ONE RULE IS CORRECT FOR BOTH SCALES with no special case:
--
--   1  Not applicable   = the five-level scale's Not applicable
--   2  Not confirmed    = the five-level scale's Unknown, no confirmation held
--   4  Confirmed        = the five-level scale's Buyer confirmed, a named source
--
-- The satisfying set the rollup reads is {1, 4, 5}. Numbered 1, 2, 3 instead,
-- CONFIRMED WOULD NOT SATISFY IT, because 3 is Our hypothesis. That is a real
-- trap: the obvious numbering is the one that silently breaks the rollup, and
-- it would have broken it in the direction that reports work as outstanding.
--
-- The gaps at 3 and 5 are true statements about this scale: a requirement has
-- no hypothesis state, and nothing beyond confirmed to verify.
--
-- SAFE ON THREE COUNTS, each checked rather than assumed:
--   * scoring_scale_levels declares unique (scale_id, value) and no contiguity
--     constraint, and its own comment says the scales are ordinal and "the
--     order is the point". 1 < 2 < 4 preserves order.
--   * scoring_anchors.score carries check (score between 1 and 5). All three
--     values are inside it.
--   * src/lib/score-entry.js validates with `levels.map(l => l.value)` and
--     `allowed.includes(score)`, so it accepts exactly the configured values
--     rather than a range. Round 24's "score <= 2 made data-driven" is why
--     this is safe.
--
-- ============================================================================
-- ORDER, AND IDEMPOTENCE
-- ============================================================================
--
-- The renumber runs HIGHEST FIRST. Moving Not confirmed 1 -> 2 while Confirmed
-- still sits at 2 would violate unique (scale_id, value), so Confirmed goes
-- 2 -> 4 first and leaves 2 free.
--
-- Every statement matches on the label AND the value it is moving from, so a
-- replay matches nothing and changes nothing, per Architecture rule 7.
--
-- NOTHING POINTS AT THIS SCALE YET. Verified before writing: zero rows in
-- scoring_criteria carry this scale_id, so no score entry, no anchor and no
-- gate rule can reference these values. The renumber cannot orphan anything.
--
-- No seed file carries scoring_scales or scoring_scale_levels, checked and
-- calibrated against stage_gate_rules, which supabase/seeds/001_smoke_test.sql
-- does carry. Architecture rule 4 has nothing to reconcile.
--
-- reason_required is left false on all three levels, unchanged. Whether Not
-- confirmed should require a reason the way Unknown does is a business
-- decision this migration does not take.

-- 1. The scale is no longer binary, so it is no longer called binary. The name
--    mirrors "Deal evidence, five level" and says what kind of claim it makes.
update public.scoring_scales
set name = 'Requirement confirmation, three level'
where name = 'Binary confirmation';

-- 2. Confirmed 2 -> 4, before anything else needs value 2.
update public.scoring_scale_levels l
set value = 4
from public.scoring_scales s
where l.scale_id = s.id
  and s.name = 'Requirement confirmation, three level'
  and l.label = 'Confirmed'
  and l.value = 2;

-- 3. Not confirmed 1 -> 2, now that 2 is free.
update public.scoring_scale_levels l
set value = 2
from public.scoring_scales s
where l.scale_id = s.id
  and s.name = 'Requirement confirmation, three level'
  and l.label = 'Not confirmed'
  and l.value = 1;

-- 4. Not applicable at 1.
insert into public.scoring_scale_levels (scale_id, value, label)
select s.id, 1, 'Not applicable'
from public.scoring_scales s
where s.name = 'Requirement confirmation, three level'
  and not exists (
    select 1 from public.scoring_scale_levels l
    where l.scale_id = s.id and l.value = 1
  );

-- 5. The descriptions, which this scale has never had.
--
-- PROPOSED BY THE BUILD FOR THE BUSINESS TO CORRECT, which is the standing
-- rule for wording: "Code can write it, we can correct later."
--
-- The five-level set grades HOW STRONGLY SOMETHING IS EVIDENCED, and rises
-- through who said it: a Terminus assumption, then a named person, then a
-- document. This scale asks a different question. It is about a REQUIREMENT
-- and whether it has been discharged, so the wording names the requirement
-- rather than the source of belief, and each level says which of the three
-- things is true of it: not raised, raised and open, or met.
--
-- Guarded with `is distinct from` so a replay is a no-op and a later wording
-- correction made by hand is not silently reverted by a rerun. That is the
-- same guard 20260824000002 used, and for the same reason.
update public.scoring_scale_levels l
set description = v.description
from public.scoring_scales s,
     (values
       (1, 'Not applicable, this deal does not raise the requirement'),
       (2, 'Not confirmed, the requirement is open or unmet'),
       (4, 'Confirmed, the requirement is met and evidenced')
     ) as v(value, description)
where l.scale_id = s.id
  and s.name = 'Requirement confirmation, three level'
  and l.value = v.value
  and l.description is distinct from v.description;
