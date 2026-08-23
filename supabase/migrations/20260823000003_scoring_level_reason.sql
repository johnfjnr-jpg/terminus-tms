-- Terminus TMS: reason required, per level. Round 24 Phase 3, 2026-08-23.
--
-- Replaces a rule written inline in the write path as `score <= 2`, which is
-- correct for a five-point scale where 1 and 2 are the low end, and arbitrary
-- for any other shape. On a two-level scale it fires on the confirmed state.
--
-- WHY THIS COLUMN IS ON THE LEVEL AND NOT ON THE ANCHOR. The anchor is the
-- other per-level record and was the obvious home, and it cannot work: Test
-- Bed has NO ANCHOR ROW AT 2, which is one of the two levels the rule it
-- replaces fires on. A flag on anchors could not express today's behaviour at
-- all. Confirmed against the data before choosing: 15 anchor rows across five
-- criteria, at scores 1, 3 and 5 only.
--
-- THE DEFAULT SCALE IS NOT ROWS AND ITS FLAGS ARE NOT HERE. A criterion with a
-- null scale_id is scored against the legacy 1 to 5, defined in
-- src/lib/scoring-levels.js with reason_required true at 1 and 2. That
-- reproduces the replaced rule exactly, and it holds for a criterion created
-- long after this migration rather than only for rows that existed when it
-- ran.
--
-- Written idempotently per Architecture rule 7.

alter table public.scoring_scale_levels
  add column if not exists reason_required boolean not null default false;

comment on column public.scoring_scale_levels.reason_required is
  'Whether choosing this level obliges the scorer to say why. Replaces an '
  'inline `score <= 2` test, which is meaningful only on a five-point scale. '
  'Criteria with no scale use the default set in src/lib/scoring-levels.js, '
  'which carries this flag at 1 and 2 and reproduces the previous behaviour.';

-- ---------------------------------------------------------------------------
-- The Deal evidence scale
-- ---------------------------------------------------------------------------
--
-- Level 2, Unknown, requires a reason. Level 1, Not applicable, does not.
--
-- STATED AS A DEPARTURE RATHER THAN INHERITED. A literal port of `score <= 2`
-- would flag both, because on this scale they happen to occupy 1 and 2. They
-- are not the same kind of answer. "Not applicable" is a COMPLETE answer that
-- closes the question, and demanding an explanation for it makes the honest
-- path the expensive one, which is how a scale acquires a dishonest default.
-- "Unknown" is the gap, and the gap is what the rule exists to make
-- actionable.
--
-- Nothing consumes this today: no criterion points at this scale yet, so this
-- changes no behaviour and is a row the business can flip if it disagrees.
-- Flagged for confirmation rather than treated as settled.
update public.scoring_scale_levels l
set reason_required = true
from public.scoring_scales s
where l.scale_id = s.id
  and s.name = 'Deal evidence, five level'
  and l.value = 2
  and l.reason_required is distinct from true;

-- Binary confirmation carries no reason requirement on either level. Test
-- Bed's existing binary, measurabilityConfirmed, has never required one: its
-- endpoint takes an optional comment and nothing else. Matching that rather
-- than inventing a stricter rule for a criterion type that already exists.
