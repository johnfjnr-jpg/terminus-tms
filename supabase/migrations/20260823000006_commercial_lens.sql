-- Terminus TMS: the Commercial lens, configured. Round 25 Phase 2, 2026-08-23.
--
-- Seven criteria, one lens, three stages. The first Opportunity assessment
-- configuration: before this, scoring_criteria held five rows and all five
-- were Test Bed's.
--
-- ============================================================================
-- THE ANCHOR WORDING BELOW IS PROVISIONAL. IT IS NOT SETTLED.
-- ============================================================================
--
-- The business has deliberately deferred nailing it until real deals have been
-- scored, on the grounds that anchors are configured rows and revising one is
-- a row edit rather than a build. The ends of each scale are drawn from the
-- superset's strong and weak evidence columns; THE MIDDLE IS PROVISIONAL BY
-- DESIGN and is expected to move.
--
-- This warning is repeated at the insert itself, and it is worth saying why so
-- prominently. supabase/migrations/20260819000009_scoring_model.sql carries
-- the same warning over Test Bed's fifteen anchors, in almost the same words,
-- and those anchors have been read as settled ever since: DESIGN_PRINCIPLES.md
-- records eight business hesitations about them, and Round 23 found a 5 that
-- averages several conditions joined by an implicit AND with nothing written
-- at 2 or 4 at all. A comment in a migration did not prevent that, and a
-- reader querying scoring_anchors sees no marker at all. The limit of what a
-- comment can do is recorded here rather than assumed away.
--
-- ============================================================================
--
-- WHAT THE SCALE MEASURES, because it decides what good wording is. It is
-- confidence in a DATA POINT, not progress toward a goal. The step from Our
-- hypothesis to Buyer confirmed is WHO SAID IT. The step from Buyer confirmed
-- to Verified is ONE SOURCE OR TWO. Both are checkable by someone who was not
-- in the meeting, which is what makes a score attackable in a bid review.
--
-- Not applicable carries no reason requirement, set in Round 24 Phase 3: it is
-- a complete answer that closes the question, and charging for it makes the
-- honest path the expensive one. Unknown carries it, because Unknown is the
-- gap the rule exists to make actionable.
--
-- NO assessment_current ROWS. Confirmed with the business. The rollup's
-- strictness grows as criteria are configured, so a rule inserted now would
-- require seven criteria and silently require thirty-two once the remaining
-- lenses land. It arrives when the full set exists. See OPPORTUNITY_DESIGN.md,
-- "How current is computed".
--
-- Key prefix is `assess`, not `score`. Test Bed's five are the Test Bed
-- qualification instrument and these are the Deal assessment; sharing a prefix
-- would make the two indistinguishable in a payload. Checked first that
-- nothing depends on the prefix: only INVARIANT 8 tests it, and only on
-- payload_field_required rules, which none of these are.
--
-- Written idempotently per Architecture rule 7.

-- ---------------------------------------------------------------------------
-- The seven criteria
-- ---------------------------------------------------------------------------
insert into public.scoring_criteria
  (record_type, criterion_key, name, asks, sort_order, lens_id, scale_id)
select 'opportunity', v.criterion_key, v.name, v.asks, v.sort_order, l.id, s.id
from (values
  ('assessCommBudgetConfirmed',   'Budget confirmed',
   'Is money identified and committed', 1),
  ('assessCommMetricsValue',      'Metrics and quantified value',
   'Is the value stated in the buyer''s own numbers', 2),
  ('assessCommFundingMechanism',  'Funding mechanism',
   'How would this actually be paid for', 3),
  ('assessCommPricingModelFit',   'Pricing model fit',
   'Does our commercial model match how they buy', 4),
  ('assessCommCompetition',       'Competition, including do-nothing',
   'What else are they weighing, including doing nothing', 5),
  ('assessCommRoiPayback',        'ROI and payback expectation',
   'Over what period do they expect this to pay back', 6),
  ('assessCommCommercialFit',     'Commercial fit',
   'Is this deal worth doing on these terms', 7)
) as v(criterion_key, name, asks, sort_order)
cross join (select id from public.scoring_lenses where name = 'Commercial') l
cross join (select id from public.scoring_scales where name = 'Deal evidence, five level') s
where not exists (
  select 1 from public.scoring_criteria c
  where c.record_type = 'opportunity' and c.criterion_key = v.criterion_key
);

-- ---------------------------------------------------------------------------
-- Anchors, version 1. PROVISIONAL, see the header.
-- ---------------------------------------------------------------------------
--
-- Level 1 is written per criterion rather than as one shared sentence, because
-- whether a criterion CAN be not-applicable differs: budget always applies to
-- a commercial deal, and a payback expectation genuinely does not apply to a
-- buyer funding from an existing operational line. That difference is the
-- recorded open item about two scales, four levels and five, and until it is
-- decided the wording carries the distinction rather than hiding it.
insert into public.scoring_anchors (criterion_id, version, score, wording)
select c.id, 1, v.score, v.wording
from (values
  -- Budget confirmed
  ('assessCommBudgetConfirmed', 1, 'PROVISIONAL. Rarely applicable: a commercial deal has a budget question. Use only where the buyer is funding from an existing committed line with no separate approval.'),
  ('assessCommBudgetConfirmed', 2, 'PROVISIONAL. No budget position established. Nobody has said whether money exists or where it would come from.'),
  ('assessCommBudgetConfirmed', 3, 'PROVISIONAL. Terminus believes a budget exists, from the buyer''s size, sector or prior spend. The buyer has not said so.'),
  ('assessCommBudgetConfirmed', 4, 'PROVISIONAL. A named person at the buyer has stated a budget exists and roughly what it is.'),
  ('assessCommBudgetConfirmed', 5, 'PROVISIONAL. The budget and its holder are confirmed by two independent sources, or by a document such as an approved capital plan.'),
  -- Metrics and quantified value
  ('assessCommMetricsValue', 1, 'PROVISIONAL. The buyer is not making a value case: a mandated or compliance-driven purchase.'),
  ('assessCommMetricsValue', 2, 'PROVISIONAL. No quantified value discussed. The conversation is about capability, not outcome.'),
  ('assessCommMetricsValue', 3, 'PROVISIONAL. Terminus has estimated the value from comparable deployments. The buyer has not put numbers to it.'),
  ('assessCommMetricsValue', 4, 'PROVISIONAL. The buyer has stated the value in their own numbers.'),
  ('assessCommMetricsValue', 5, 'PROVISIONAL. The buyer''s numbers are corroborated by a second source, such as their own baseline data or a second stakeholder.'),
  -- Funding mechanism
  ('assessCommFundingMechanism', 1, 'PROVISIONAL. Not applicable where the buyer has already stated the purchase route and it is not in question.'),
  ('assessCommFundingMechanism', 2, 'PROVISIONAL. How this would be paid for has not been discussed.'),
  ('assessCommFundingMechanism', 3, 'PROVISIONAL. Terminus has assumed a mechanism, typically capital or an existing operational line, from how similar buyers purchase.'),
  ('assessCommFundingMechanism', 4, 'PROVISIONAL. A named person at the buyer has stated which mechanism would be used.'),
  ('assessCommFundingMechanism', 5, 'PROVISIONAL. The mechanism is confirmed by someone with authority over it, or evidenced by a prior purchase made the same way.'),
  -- Pricing model fit
  ('assessCommPricingModelFit', 1, 'PROVISIONAL. Not applicable where only one commercial model is on the table and the buyer has accepted it.'),
  ('assessCommPricingModelFit', 2, 'PROVISIONAL. How the buyer prefers to buy has not been established.'),
  ('assessCommPricingModelFit', 3, 'PROVISIONAL. Terminus believes the model fits, from the sector norm or the buyer''s procurement style.'),
  ('assessCommPricingModelFit', 4, 'PROVISIONAL. The buyer has stated which commercial model they can accept.'),
  ('assessCommPricingModelFit', 5, 'PROVISIONAL. The model is confirmed against the buyer''s own contracting precedent, or by procurement as well as the sponsor.'),
  -- Competition, including do-nothing
  ('assessCommCompetition', 1, 'PROVISIONAL. Rarely applicable: doing nothing is always an alternative. Use only for a directed award with a stated sole-source justification.'),
  ('assessCommCompetition', 2, 'PROVISIONAL. What else the buyer is weighing is unknown, including whether they might do nothing.'),
  ('assessCommCompetition', 3, 'PROVISIONAL. Terminus has inferred the competitive position from the sector, incumbents or the buyer''s language.'),
  ('assessCommCompetition', 4, 'PROVISIONAL. The buyer has said what else they are considering, including the option of doing nothing.'),
  ('assessCommCompetition', 5, 'PROVISIONAL. The competitive position is corroborated independently, such as a published tender list or a second stakeholder describing the same field.'),
  -- ROI and payback expectation
  ('assessCommRoiPayback', 1, 'PROVISIONAL. Not applicable where the buyer is not applying a payback test, for example a safety or regulatory driver.'),
  ('assessCommRoiPayback', 2, 'PROVISIONAL. No payback expectation discussed.'),
  ('assessCommRoiPayback', 3, 'PROVISIONAL. Terminus has assumed a payback period from the sector or from comparable deployments.'),
  ('assessCommRoiPayback', 4, 'PROVISIONAL. The buyer has stated the payback period they expect.'),
  ('assessCommRoiPayback', 5, 'PROVISIONAL. The expectation is confirmed against the buyer''s own investment criteria, or stated consistently by two people.'),
  -- Commercial fit
  ('assessCommCommercialFit', 1, 'PROVISIONAL. Not applicable before terms are on the table.'),
  ('assessCommCommercialFit', 2, 'PROVISIONAL. Whether this deal is worth doing on these terms has not been assessed.'),
  ('assessCommCommercialFit', 3, 'PROVISIONAL. Terminus''s own view that the deal is worth doing, not yet tested against the buyer''s terms.'),
  ('assessCommCommercialFit', 4, 'PROVISIONAL. The buyer''s terms are known and Terminus has assessed the deal against them.'),
  ('assessCommCommercialFit', 5, 'PROVISIONAL. The assessment is confirmed against executed terms or a signed commercial position, not a draft.')
) as v(criterion_key, score, wording)
join public.scoring_criteria c
  on c.record_type = 'opportunity' and c.criterion_key = v.criterion_key
where not exists (
  select 1 from public.scoring_anchors a
  where a.criterion_id = c.id and a.version = 1 and a.score = v.score
);

-- ---------------------------------------------------------------------------
-- Visibility and requirement
-- ---------------------------------------------------------------------------
--
-- Round A settled that `required` marks the stage a criterion is answerable
-- FOR, and visibility marks the stages it can be answered AT. Those are
-- different sets here.
--
-- REQUIRED at the stage the criterion is introduced, and nowhere else. The
-- rollup is cumulative, so a criterion required at Qualification is already in
-- scope for every later rollup without a second required row.
--
-- VISIBLE from its introduction stage through Negotiating. A Qualification
-- criterion must be scoreable at Solution Alignment, because the rollup there
-- wants an entry dated at or after entry to that stage: without visibility it
-- would be required and unanswerable, which is a gate nothing can satisfy.
--
-- NOT visible before introduction, and NOT visible on the two terminal stages.
-- A closed record is not being worked, and Round 21 gives Closed Won a single
-- completed-record panel rather than the four working cards.
--
-- Twenty-eight rows: one criterion visible at five stages, five at four, one
-- at three.
insert into public.scoring_criterion_stages (criterion_id, stage, required)
select c.id, v.stage, v.required
from (values
  ('assessCommBudgetConfirmed',  'Qualification',      true),
  ('assessCommBudgetConfirmed',  'Solution Alignment', false),
  ('assessCommBudgetConfirmed',  'Proposal',           false),
  ('assessCommBudgetConfirmed',  'Evaluation',         false),
  ('assessCommBudgetConfirmed',  'Negotiating',        false),

  ('assessCommMetricsValue',     'Solution Alignment', true),
  ('assessCommMetricsValue',     'Proposal',           false),
  ('assessCommMetricsValue',     'Evaluation',         false),
  ('assessCommMetricsValue',     'Negotiating',        false),

  ('assessCommFundingMechanism', 'Solution Alignment', true),
  ('assessCommFundingMechanism', 'Proposal',           false),
  ('assessCommFundingMechanism', 'Evaluation',         false),
  ('assessCommFundingMechanism', 'Negotiating',        false),

  ('assessCommPricingModelFit',  'Solution Alignment', true),
  ('assessCommPricingModelFit',  'Proposal',           false),
  ('assessCommPricingModelFit',  'Evaluation',         false),
  ('assessCommPricingModelFit',  'Negotiating',        false),

  ('assessCommCompetition',      'Solution Alignment', true),
  ('assessCommCompetition',      'Proposal',           false),
  ('assessCommCompetition',      'Evaluation',         false),
  ('assessCommCompetition',      'Negotiating',        false),

  ('assessCommRoiPayback',       'Solution Alignment', true),
  ('assessCommRoiPayback',       'Proposal',           false),
  ('assessCommRoiPayback',       'Evaluation',         false),
  ('assessCommRoiPayback',       'Negotiating',        false),

  ('assessCommCommercialFit',    'Proposal',           true),
  ('assessCommCommercialFit',    'Evaluation',         false),
  ('assessCommCommercialFit',    'Negotiating',        false)
) as v(criterion_key, stage, required)
join public.scoring_criteria c
  on c.record_type = 'opportunity' and c.criterion_key = v.criterion_key
where not exists (
  select 1 from public.scoring_criterion_stages s
  where s.criterion_id = c.id and s.stage = v.stage
);
