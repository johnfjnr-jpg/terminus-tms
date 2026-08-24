-- Terminus TMS: generic level wording on the scale. Round 28 Phase 3, 2026-08-24.
--
-- THE PROBLEM THE BUSINESS REPORTED. Seven Commercial criteria each carry five
-- anchor rows, and the step from one level to the next is the same sentence in
-- all seven: who said it. Thirty-five rows of near-duplicate prose, rendered as
-- a wall the scorer reads past. Measured in Round 28 Phase 0 at 189 to 222px of
-- anchor block per criterion.
--
-- THE DECISION, option C of three put to the business.
--
-- Keep every anchor row. Add generic wording to the LEVEL, and let a
-- per-criterion anchor act as an override. Display precedence is per-criterion
-- wording at this version if present, else this description.
--
-- WHY NOT DELETE THE THIRTY-FIVE. Two reasons, both measured rather than
-- assumed.
--
--   INVARIANT 9 binds them. Every stored score references a COMPLETE anchor
--   version, meaning the version carries the full set of scores that criterion
--   has anchors for at any version. Sixty-two live score entries are stamped
--   anchorVersion 1, eleven of them against five of these seven criteria.
--   Deleting the rows would leave every one of those pointing at a version
--   that no longer exists. The rows are not, as the brief put it, the
--   authority for nothing: they are the authority for the provenance of every
--   judgement already recorded.
--
--   scoring_anchors has no delete policy at all, deliberately. Its own table
--   comment says immutability is enforced by the absence of update and delete
--   policies rather than by convention.
--
-- WHY THIS NEVER RELAXES THE ANCHOR MANDATE. POST /scores refuses a criterion
-- with no anchor row with a 409, and reads only `version` from that row, never
-- `wording`. Since every row stays, a version still exists to stamp, and the
-- write path needs no change. What a future criterion with no anchors does is
-- deliberately left open: it still 409s, which is correct until someone needs
-- otherwise.
--
-- THE DEFAULT SCALE IS NOT ROWS AND ITS WORDING IS NOT HERE. A criterion with a
-- null scale_id is scored against the legacy 1 to 5 in src/lib/scoring-levels.js.
-- Every Test Bed criterion is in that state, confirmed against the live data
-- before writing this: five criteria, all with scale_id null. So Test Bed has
-- no scale row to fall back to and can only ever render its own anchors, which
-- is a stronger guarantee that it is unchanged than the precedence rule alone
-- would give.
--
-- Written idempotently per Architecture rule 7.

alter table public.scoring_scale_levels
  add column if not exists description text;

comment on column public.scoring_scale_levels.description is
  'Generic wording for this level, shared by every criterion on the scale. A '
  'per-criterion scoring_anchors row at the criterion''s current version '
  'OVERRIDES it; this is what renders when there is no such row. Null means '
  'the scale offers no generic wording, which is the correct state for a scale '
  'whose levels differ meaningfully per criterion. Criteria with no scale use '
  'the default in src/lib/scoring-levels.js, which carries no descriptions, so '
  'they render their own anchors and nothing else.';

-- ---------------------------------------------------------------------------
-- The five, as agreed with the business
-- ---------------------------------------------------------------------------
--
-- Reconciles with the seed of these rows in 20260823000002_scoring_scales.sql,
-- per Architecture rule 4. That migration inserts the levels with label only
-- and runs before this one on a fresh database, so the two converge on the
-- same end state rather than disagreeing.
--
-- Guarded with `is distinct from` so a replay is a no-op, and so a wording
-- edit made later by hand is not silently reverted by an unguarded rerun.
update public.scoring_scale_levels l
set description = v.description
from public.scoring_scales s,
     (values
       (1, 'Not applicable'),
       (2, 'Unknown at this time'),
       (3, 'Our hypothesis, a Terminus assumption'),
       (4, 'Buyer confirmed, stated by a named person'),
       (5, 'Verified, evidenced, corroborated or documented')
     ) as v(value, description)
where l.scale_id = s.id
  and s.name = 'Deal evidence, five level'
  and l.value = v.value
  and l.description is distinct from v.description;

-- Binary confirmation is left null on both levels, deliberately.
--
-- No criterion points at it, the business supplied wording for the five-level
-- scale only, and writing generic prose for a scale nobody uses would be this
-- migration inventing wording. That is the line the anchors are on the other
-- side of, and the same line 20260823000003 drew for reason_required.
