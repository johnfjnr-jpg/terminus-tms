-- Terminus TMS: Organisational sorts by introduction stage. Round 33 Phase 3,
-- 2026-08-26.
--
-- Round 25 orders the Commercial seven strictly by the stage each is
-- introduced at: Budget confirmed at Qualification is 1, the five Solution
-- Alignment criteria are 2 to 6, and Commercial fit at Proposal is 7. Nothing
-- states that as a rule, and looking at the configured Organisational lens is
-- what surfaced it: Internal pain owner, introduced at Solution Alignment, sat
-- third between two Qualification criteria.
--
-- It matters at the deeper stages, where every criterion is visible at once. A
-- reader scanning Proposal sees eight rows in one list, and stage order is the
-- only ordering the list can carry that means anything: the criteria have no
-- other rank.
--
-- PHASE 3 SETS THE RHYTHM FOR PHASES 4 AND 5, which is the reason this is
-- corrected now rather than noted. An inconsistent convention established here
-- is one two more lenses would inherit.
--
-- A separate migration rather than an edit to 20260826000003, because that one
-- is applied. Editing an applied migration is how a ledger drifts from the
-- schema, and this project has recorded that drift happening silently.
--
-- Idempotent: guarded on the value each row is moving from, so a replay
-- matches nothing.

update public.scoring_criteria c
set sort_order = v.sort_order
from (values
  ('assessOrgEconomicBuyer',   1),
  ('assessOrgChampion',        2),
  ('assessOrgPrioritisation',  3),
  ('assessOrgTriggerTimeline', 4),
  ('assessOrgPainOwner',       5),
  ('assessOrgBuyingCommittee', 6),
  ('assessOrgDecisionProcess', 7),
  ('assessOrgPolitics',        8)
) as v(criterion_key, sort_order)
where c.record_type = 'opportunity'
  and c.criterion_key = v.criterion_key
  and c.sort_order is distinct from v.sort_order;
