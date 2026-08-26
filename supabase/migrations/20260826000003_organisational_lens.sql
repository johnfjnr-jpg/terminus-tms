-- Terminus TMS: the Organisational lens, configured. Round 33 Phase 3,
-- 2026-08-26.
--
-- Eight criteria, all evidence-state, on `Deal evidence, five level`. Four
-- introduced at Qualification and four at Solution Alignment. The second
-- Opportunity lens to be configured, after Commercial's seven in Round 25.
--
-- ============================================================================
-- THE WORDING IS DRAFTED AND THE BUSINESS CORRECTS IT
-- ============================================================================
--
-- The standing rule, confirmed: "Code can write it, we can correct later."
-- That is what happened to the Commercial seven, which were seeded in Round 25,
-- read against a real deal, and judged in Round 30.
--
-- NO `PROVISIONAL` PREFIX. Round 31 retired it from all 35 Commercial anchors
-- as version 2, on the business's decision, because on a hover popup it was the
-- first word read every time. Reintroducing it here would put back the marker
-- that round removed.
--
-- ============================================================================
-- FIVE ANCHORS PER CRITERION, AND THIS DEPARTS FROM THE BRIEF
-- ============================================================================
--
-- Round C's brief describes "Round 30's split" as the template: per-criterion
-- wording at Not applicable and Verified, the middle three retired to the
-- scale's generic descriptions, on the reasoning that the step from hypothesis
-- to confirmed is who said it and that is the same for every criterion.
--
-- THAT SPLIT DOES NOT EXIST. Read from the live table before drafting: all
-- seven Commercial criteria carry anchors at all five scores, at both
-- versions, 35 rows at version 2. The claim travelled from Round 31's brief
-- ("Round 30's retirement decision kept 15") into Round C's, and Round 31
-- Phase 2 reversioned all 35 and reported doing so, so the data was never
-- wrong; the claim about it was.
--
-- READ SIDE BY SIDE, the split also comes out differently from the brief's:
--
--   * Level 2 is the most per-criterion of the middle three, not the least.
--     "No budget position established. Nobody has said whether money exists or
--     where it would come from" names WHAT is unestablished, and the generic
--     "Unknown at this time" cannot. Unknown is the level the gate exists to
--     surface, so it is the worst one to make vague.
--   * Level 3 names the BASIS of the assumption, which differs per criterion:
--     the buyer's size and prior spend for budget, comparable deployments for
--     value.
--   * Level 4 is the closest to generic. Its pattern is "the buyer has stated
--     <the criterion>", which is nearly derivable from the name. It is the one
--     level where the brief's argument holds, and retiring one level of five
--     saves eight rows here and leaves a ragged pattern.
--
-- So: five per criterion, matching the rhythm the business has actually read
-- and judged. The split remains available on both scales and has never been
-- used; that is recorded in DESIGN_PRINCIPLES.md as a capability rather than a
-- precedent.
--
-- ============================================================================
-- NOT APPLICABLE IS A JUDGEMENT PER CRITERION
-- ============================================================================
--
-- Two of the Commercial seven open with "Rarely applicable", which constrains
-- the level where the dishonest answer is most tempting: Not applicable
-- requires no reason, so it is the cheapest way to make a criterion go away.
--
-- Two here take the same treatment, and they are the two the business named:
-- ECONOMIC BUYER IDENTIFIED, because somebody must release money, and CHAMPION
-- IDENTIFIED, because a deal nobody inside is carrying is a deal in trouble
-- rather than a deal where the question does not arise.
--
-- ============================================================================
-- WHAT THE SCALE MEASURES, carried over from Round 25 because it decides what
-- good wording is: confidence in a DATA POINT, not progress toward a goal. The
-- step from Our hypothesis to Buyer confirmed is WHO SAID IT. The step from
-- Buyer confirmed to Verified is ONE SOURCE OR TWO. Both are checkable by
-- someone who was not in the meeting.
--
-- Level 5 is the superset's Strong evidence column rewritten as a state, so it
-- names what corroboration means for THAT criterion: a delegation of
-- authority, a contract expiry, an attendee list.
--
-- ============================================================================
-- NO `assessment_current` ROWS, unchanged from Round 25 and Round 32.
-- OPPORTUNITY_DESIGN.md records why: such a rule resolves its set at
-- evaluation time, so one written today would silently tighten as this round
-- and the next configure more criteria.
--
-- Idempotent per Architecture rule 7: every insert is guarded on the natural
-- key. No seed file carries scoring_criteria, scoring_criterion_stages or
-- scoring_anchors, checked and calibrated against stage_gate_rules, which
-- supabase/seeds/001_smoke_test.sql does carry.

-- ---------------------------------------------------------------------------
-- Eight criteria
-- ---------------------------------------------------------------------------
insert into public.scoring_criteria
  (record_type, criterion_key, name, asks, sort_order, lens_id, scale_id)
select 'opportunity', v.criterion_key, v.name, v.asks, v.sort_order, l.id, s.id
from (values
  ('assessOrgEconomicBuyer',   'Economic Buyer identified',
   'Who can say yes and release the money', 1),
  ('assessOrgChampion',        'Champion identified',
   'Who inside is selling this when we are not there', 2),
  ('assessOrgPainOwner',       'Internal pain owner',
   'Whose problem is this, and what does it cost them', 3),
  ('assessOrgPrioritisation',  'Prioritisation',
   'Where does this sit against everything else they are funding', 4),
  ('assessOrgTriggerTimeline', 'Trigger event / timeline',
   'What is forcing a decision, and by when', 5),
  ('assessOrgBuyingCommittee', 'Buying committee mapped',
   'Who else has a say, and what does each of them want', 6),
  ('assessOrgDecisionProcess', 'Decision process',
   'What are the actual steps from here to a signature', 7),
  ('assessOrgPolitics',        'Political dynamics',
   'Who gains and who loses if this goes ahead', 8)
) as v(criterion_key, name, asks, sort_order)
cross join (select id from public.scoring_lenses where name = 'Organisational') l
cross join (select id from public.scoring_scales where name = 'Deal evidence, five level') s
where not exists (
  select 1 from public.scoring_criteria c
  where c.record_type = 'opportunity' and c.criterion_key = v.criterion_key
);

-- ---------------------------------------------------------------------------
-- Stage visibility. Introduced once, then visible through Negotiating.
--
-- Thirty-six rows: four criteria at five stages, four at four. `required` is
-- true at the introduction stage only, matching Round 25's pattern.
-- ---------------------------------------------------------------------------
insert into public.scoring_criterion_stages (criterion_id, stage, required)
select c.id, v.stage, v.required
from (values
  ('assessOrgEconomicBuyer',   'Qualification',      true),
  ('assessOrgEconomicBuyer',   'Solution Alignment', false),
  ('assessOrgEconomicBuyer',   'Proposal',           false),
  ('assessOrgEconomicBuyer',   'Evaluation',         false),
  ('assessOrgEconomicBuyer',   'Negotiating',        false),

  ('assessOrgChampion',        'Qualification',      true),
  ('assessOrgChampion',        'Solution Alignment', false),
  ('assessOrgChampion',        'Proposal',           false),
  ('assessOrgChampion',        'Evaluation',         false),
  ('assessOrgChampion',        'Negotiating',        false),

  ('assessOrgPrioritisation',  'Qualification',      true),
  ('assessOrgPrioritisation',  'Solution Alignment', false),
  ('assessOrgPrioritisation',  'Proposal',           false),
  ('assessOrgPrioritisation',  'Evaluation',         false),
  ('assessOrgPrioritisation',  'Negotiating',        false),

  ('assessOrgTriggerTimeline', 'Qualification',      true),
  ('assessOrgTriggerTimeline', 'Solution Alignment', false),
  ('assessOrgTriggerTimeline', 'Proposal',           false),
  ('assessOrgTriggerTimeline', 'Evaluation',         false),
  ('assessOrgTriggerTimeline', 'Negotiating',        false),

  ('assessOrgBuyingCommittee', 'Solution Alignment', true),
  ('assessOrgBuyingCommittee', 'Proposal',           false),
  ('assessOrgBuyingCommittee', 'Evaluation',         false),
  ('assessOrgBuyingCommittee', 'Negotiating',        false),

  ('assessOrgDecisionProcess', 'Solution Alignment', true),
  ('assessOrgDecisionProcess', 'Proposal',           false),
  ('assessOrgDecisionProcess', 'Evaluation',         false),
  ('assessOrgDecisionProcess', 'Negotiating',        false),

  ('assessOrgPainOwner',       'Solution Alignment', true),
  ('assessOrgPainOwner',       'Proposal',           false),
  ('assessOrgPainOwner',       'Evaluation',         false),
  ('assessOrgPainOwner',       'Negotiating',        false),

  ('assessOrgPolitics',        'Solution Alignment', true),
  ('assessOrgPolitics',        'Proposal',           false),
  ('assessOrgPolitics',        'Evaluation',         false),
  ('assessOrgPolitics',        'Negotiating',        false)
) as v(criterion_key, stage, required)
join public.scoring_criteria c
  on c.record_type = 'opportunity' and c.criterion_key = v.criterion_key
where not exists (
  select 1 from public.scoring_criterion_stages s
  where s.criterion_id = c.id and s.stage = v.stage
);

-- ---------------------------------------------------------------------------
-- Anchors, version 1. Forty rows: eight criteria at five levels.
-- ---------------------------------------------------------------------------
insert into public.scoring_anchors (criterion_id, version, score, wording)
select c.id, 1, v.score, v.wording
from (values
  -- Economic Buyer identified
  ('assessOrgEconomicBuyer', 1, 'Rarely applicable: somebody has to release the money. Use only where the buyer has delegated the decision entirely to the sponsor and no separate approval exists.'),
  ('assessOrgEconomicBuyer', 2, 'No economic buyer identified. Who signs, and who releases the funds, has not been established.'),
  ('assessOrgEconomicBuyer', 3, 'Terminus has inferred the economic buyer from the organisation''s structure or the size of the spend. Nobody at the buyer has confirmed it.'),
  ('assessOrgEconomicBuyer', 4, 'A named person at the buyer has said who holds the budget decision.'),
  ('assessOrgEconomicBuyer', 5, 'The economic buyer is confirmed by two independent sources, or evidenced by a delegation of authority or a prior signature at the same level.'),

  -- Champion identified
  ('assessOrgChampion', 1, 'Rarely applicable: a deal nobody inside is carrying is a deal in trouble rather than one where the question does not arise. Use only where the buyer''s process forbids an internal sponsor, such as a sealed tender.'),
  ('assessOrgChampion', 2, 'No champion identified. Nobody inside the buyer is known to be advancing this.'),
  ('assessOrgChampion', 3, 'Terminus believes a contact is acting as champion, from their engagement or their language. They have not said so and have not acted for us unprompted.'),
  ('assessOrgChampion', 4, 'A named person has said they are advocating for this internally.'),
  ('assessOrgChampion', 5, 'The champion is evidenced by action taken without us: a meeting they convened, a paper they wrote, or a second stakeholder describing them as the sponsor.'),

  -- Internal pain owner
  ('assessOrgPainOwner', 1, 'Not applicable where the purchase is driven by an external obligation rather than an internal problem, such as a regulatory mandate.'),
  ('assessOrgPainOwner', 2, 'Whose problem this solves has not been established.'),
  ('assessOrgPainOwner', 3, 'Terminus has inferred the pain owner from the operation affected. Nobody has claimed the problem as theirs.'),
  ('assessOrgPainOwner', 4, 'A named person has said the problem is theirs and described what it costs them.'),
  ('assessOrgPainOwner', 5, 'The pain is corroborated by the buyer''s own data, or by a second person in the same function describing it the same way.'),

  -- Prioritisation
  ('assessOrgPrioritisation', 1, 'Not applicable where the buyer runs no competing portfolio for this budget, such as a single mandated programme.'),
  ('assessOrgPrioritisation', 2, 'Where this sits against the buyer''s other commitments has not been discussed.'),
  ('assessOrgPrioritisation', 3, 'Terminus has judged the priority from the pace of engagement or the seniority involved. The buyer has not ranked it.'),
  ('assessOrgPrioritisation', 4, 'The buyer has said where this sits against their other commitments.'),
  ('assessOrgPrioritisation', 5, 'The priority is corroborated by a second source, or evidenced by a published plan or a funded position on a roadmap.'),

  -- Trigger event / timeline
  ('assessOrgTriggerTimeline', 1, 'Not applicable where the buyer is running a continuous programme with no dated decision point.'),
  ('assessOrgTriggerTimeline', 2, 'No trigger or date established. Why now, and by when, has not been discussed.'),
  ('assessOrgTriggerTimeline', 3, 'Terminus has inferred the timing from a contract end, a season or a public commitment. The buyer has not stated it.'),
  ('assessOrgTriggerTimeline', 4, 'A named person at the buyer has stated the trigger and the date it drives.'),
  ('assessOrgTriggerTimeline', 5, 'The date is evidenced by a document such as a contract expiry, a regulatory deadline or a board-approved plan.'),

  -- Buying committee mapped
  ('assessOrgBuyingCommittee', 1, 'Not applicable where the buyer has stated a single decision maker and no other party holds a veto.'),
  ('assessOrgBuyingCommittee', 2, 'Who else has a say has not been established.'),
  ('assessOrgBuyingCommittee', 3, 'Terminus has assembled the likely committee from comparable deals or the organisation chart. The buyer has not confirmed it.'),
  ('assessOrgBuyingCommittee', 4, 'A named person at the buyer has described who else is involved and what each of them wants.'),
  ('assessOrgBuyingCommittee', 5, 'The committee is corroborated by a second stakeholder, or evidenced by an attendee list, a governance paper or a procurement notice.'),

  -- Decision process
  ('assessOrgDecisionProcess', 1, 'Not applicable where the buyer has already begun a defined process whose steps are published, such as a formal tender.'),
  ('assessOrgDecisionProcess', 2, 'The steps between here and a signature have not been established.'),
  ('assessOrgDecisionProcess', 3, 'Terminus has assumed the process from how this buyer, or this sector, normally buys. The buyer has not walked it through.'),
  ('assessOrgDecisionProcess', 4, 'A named person at the buyer has described the steps and who is involved at each.'),
  ('assessOrgDecisionProcess', 5, 'The process is confirmed against the buyer''s own documented procedure, or described consistently by two people.'),

  -- Political dynamics
  ('assessOrgPolitics', 1, 'Not applicable where the change affects one team with no reallocation of budget, headcount or responsibility.'),
  ('assessOrgPolitics', 2, 'Who gains and who loses from this has not been considered.'),
  ('assessOrgPolitics', 3, 'Terminus has formed a view of the internal positions from what has been said and who has been absent. The buyer has not discussed it.'),
  ('assessOrgPolitics', 4, 'A named person at the buyer has described the internal positions, including who is opposed.'),
  ('assessOrgPolitics', 5, 'The reading is corroborated by a second stakeholder, or evidenced by a decision the buyer has already taken on similar ground.')
) as v(criterion_key, score, wording)
join public.scoring_criteria c
  on c.record_type = 'opportunity' and c.criterion_key = v.criterion_key
where not exists (
  select 1 from public.scoring_anchors a
  where a.criterion_id = c.id and a.version = 1 and a.score = v.score
);
