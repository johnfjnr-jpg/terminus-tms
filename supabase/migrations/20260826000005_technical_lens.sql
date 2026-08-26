-- Terminus TMS: the Technical lens, configured. Round 33 Phase 4, 2026-08-26.
--
-- Seven criteria. SIX evidence-state on `Deal evidence, five level`, and ONE
-- on `Requirement confirmation, three level`.
--
-- ============================================================================
-- THE ONLY MIXED LENS IN THE SYSTEM
-- ============================================================================
--
-- Confirmed with the business: Organisational is uniformly evidence-state,
-- Legal uniformly confirmation, Commercial uniformly evidence-state. This lens
-- is the only one holding both, and Phase 0 measured that a mixed lens is the
-- only composition whose reason column fails to align: six rows put their
-- reason at x=739 and the seventh at x=465, 274px apart, which read as a broken
-- row rather than as a different kind of criterion.
--
-- Phase 2 fixed it by giving the level group a column floor, proved on an
-- injected criterion. THIS PHASE IS WHERE THAT FIX MEETS REAL DATA.
--
-- ============================================================================
-- THREE ANCHORS ON THE CONFIRMATION CRITERION, AND THE REASONING INVERTS
-- ============================================================================
--
-- Phase 3 wrote five anchors per evidence criterion after reading the
-- Commercial seven side by side, and found level 4 the closest to generic: its
-- pattern is "the buyer has stated <the criterion>", nearly derivable from the
-- name.
--
-- ON THIS SCALE THAT INVERTS, and level 4 is the FURTHEST from generic.
--
-- The generic description reads "Confirmed, the requirement is met and
-- evidenced". It cannot say WHAT counts as evidence, and what counts differs
-- completely per requirement: a written export classification, a signed DPA, an
-- agreed pilot scope. Phase 2 made a reason mandatory at Confirmed precisely
-- because that evidence is the record worth having, so the level whose anchor
-- tells a scorer what evidence to name is the one that must not be generic.
--
-- Level 1 keeps per-criterion wording for the reason Phase 3 gave: Not
-- applicable is the free level and therefore the cheapest way to make a
-- criterion go away, so naming the conditions constrains it.
--
-- Level 2 names what is specifically outstanding, which the generic "open or
-- unmet" cannot.
--
-- So all three, and the count is three rather than five because the scale has
-- three levels, not because anything was retired.
--
-- ============================================================================
-- SORTED BY INTRODUCTION STAGE, per the rhythm Phase 3 established and
-- corrected. Need / problem definition at Qualification is 1; the six Solution
-- Alignment criteria are 2 to 7, ordered as a technical evaluation runs: what
-- they will judge on, whether we fit, what has to connect, what data moves,
-- whether we can deliver, and whether they need to see it first.
--
-- TWO NAMES WRAP, and this is expected rather than a defect. "Pilot or
-- proof-of-concept requirement" measures 247px and "Data and architecture
-- requirements" 237px against the 230px the criterion cell gives a name. The
-- business accepted the wrap in Phase 2 rather than spend the 51px of headroom
-- that exactly fits today's longest name and leaves none for the next.
--
-- No PROVISIONAL prefix. No `assessment_current` rows.
--
-- Idempotent per Architecture rule 7: every insert guarded on the natural key.
-- No seed file carries any of these three tables, checked and calibrated
-- against stage_gate_rules, which supabase/seeds/001_smoke_test.sql does carry.

-- ---------------------------------------------------------------------------
-- Six evidence-state criteria
-- ---------------------------------------------------------------------------
insert into public.scoring_criteria
  (record_type, criterion_key, name, asks, sort_order, lens_id, scale_id)
select 'opportunity', v.criterion_key, v.name, v.asks, v.sort_order, l.id, s.id
from (values
  ('assessTechNeedDefinition',       'Need / problem definition',
   'What problem are we solving, and how do they describe it', 1),
  ('assessTechDecisionCriteria',     'Decision criteria',
   'What will they judge the options on', 2),
  ('assessTechSolutionFit',          'Solution fit',
   'Does what we do meet what they actually need', 3),
  ('assessTechIntegrationComplexity','Integration complexity',
   'What has to connect, and how hard is it', 4),
  ('assessTechDataArchitecture',     'Data and architecture requirements',
   'What data moves, where must it live, and who owns it', 5),
  ('assessTechDeliveryFeasibility',  'Delivery feasibility',
   'Can we deliver this scope, on this site, to this date', 6)
) as v(criterion_key, name, asks, sort_order)
cross join (select id from public.scoring_lenses where name = 'Technical') l
cross join (select id from public.scoring_scales where name = 'Deal evidence, five level') s
where not exists (
  select 1 from public.scoring_criteria c
  where c.record_type = 'opportunity' and c.criterion_key = v.criterion_key
);

-- ---------------------------------------------------------------------------
-- One confirmation criterion, and the first anywhere in the system to point at
-- the three-level scale.
-- ---------------------------------------------------------------------------
insert into public.scoring_criteria
  (record_type, criterion_key, name, asks, sort_order, lens_id, scale_id)
select 'opportunity', 'assessTechPilotRequirement', 'Pilot or proof-of-concept requirement',
       'Do they need to see it working before they commit', 7, l.id, s.id
from (select id from public.scoring_lenses where name = 'Technical') l
cross join (select id from public.scoring_scales
            where name = 'Requirement confirmation, three level') s
where not exists (
  select 1 from public.scoring_criteria c
  where c.record_type = 'opportunity' and c.criterion_key = 'assessTechPilotRequirement'
);

-- ---------------------------------------------------------------------------
-- Stage visibility. Twenty-nine rows: one criterion at five stages, six at
-- four. `required` true at the introduction stage only.
-- ---------------------------------------------------------------------------
insert into public.scoring_criterion_stages (criterion_id, stage, required)
select c.id, v.stage, v.required
from (values
  ('assessTechNeedDefinition',        'Qualification',      true),
  ('assessTechNeedDefinition',        'Solution Alignment', false),
  ('assessTechNeedDefinition',        'Proposal',           false),
  ('assessTechNeedDefinition',        'Evaluation',         false),
  ('assessTechNeedDefinition',        'Negotiating',        false),

  ('assessTechDecisionCriteria',      'Solution Alignment', true),
  ('assessTechDecisionCriteria',      'Proposal',           false),
  ('assessTechDecisionCriteria',      'Evaluation',         false),
  ('assessTechDecisionCriteria',      'Negotiating',        false),

  ('assessTechSolutionFit',           'Solution Alignment', true),
  ('assessTechSolutionFit',           'Proposal',           false),
  ('assessTechSolutionFit',           'Evaluation',         false),
  ('assessTechSolutionFit',           'Negotiating',        false),

  ('assessTechIntegrationComplexity', 'Solution Alignment', true),
  ('assessTechIntegrationComplexity', 'Proposal',           false),
  ('assessTechIntegrationComplexity', 'Evaluation',         false),
  ('assessTechIntegrationComplexity', 'Negotiating',        false),

  ('assessTechDataArchitecture',      'Solution Alignment', true),
  ('assessTechDataArchitecture',      'Proposal',           false),
  ('assessTechDataArchitecture',      'Evaluation',         false),
  ('assessTechDataArchitecture',      'Negotiating',        false),

  ('assessTechDeliveryFeasibility',   'Solution Alignment', true),
  ('assessTechDeliveryFeasibility',   'Proposal',           false),
  ('assessTechDeliveryFeasibility',   'Evaluation',         false),
  ('assessTechDeliveryFeasibility',   'Negotiating',        false),

  ('assessTechPilotRequirement',      'Solution Alignment', true),
  ('assessTechPilotRequirement',      'Proposal',           false),
  ('assessTechPilotRequirement',      'Evaluation',         false),
  ('assessTechPilotRequirement',      'Negotiating',        false)
) as v(criterion_key, stage, required)
join public.scoring_criteria c
  on c.record_type = 'opportunity' and c.criterion_key = v.criterion_key
where not exists (
  select 1 from public.scoring_criterion_stages s
  where s.criterion_id = c.id and s.stage = v.stage
);

-- ---------------------------------------------------------------------------
-- Anchors, version 1. Thirty-three rows: six criteria at five levels, one at
-- three. The three-level criterion's scores are 1, 2 and 4, which are the
-- values that scale actually carries: each takes the value of the evidence
-- state it is ordinally equivalent to, so one rollup rule reads both scales.
-- ---------------------------------------------------------------------------
insert into public.scoring_anchors (criterion_id, version, score, wording)
select c.id, 1, v.score, v.wording
from (values
  -- Need / problem definition
  ('assessTechNeedDefinition', 1, 'Not applicable where the buyer is procuring a specified item against a written specification and the problem behind it is out of scope.'),
  ('assessTechNeedDefinition', 2, 'The problem has not been defined. What is wrong today, and for whom, has not been established.'),
  ('assessTechNeedDefinition', 3, 'Terminus has framed the problem from the site, the sector or comparable deployments. The buyer has not described it in their own terms.'),
  ('assessTechNeedDefinition', 4, 'A named person at the buyer has described the problem in their own words.'),
  ('assessTechNeedDefinition', 5, 'The problem is corroborated by the buyer''s own data or documentation, or described consistently by two people in different roles.'),

  -- Decision criteria
  ('assessTechDecisionCriteria', 1, 'Not applicable where the buyer has said they will accept a recommendation without comparing options.'),
  ('assessTechDecisionCriteria', 2, 'What the buyer will judge the options on has not been established.'),
  ('assessTechDecisionCriteria', 3, 'Terminus has assumed the criteria from the brief, or from how this sector normally evaluates. The buyer has not stated them.'),
  ('assessTechDecisionCriteria', 4, 'A named person at the buyer has stated what the decision will be judged on.'),
  ('assessTechDecisionCriteria', 5, 'The criteria are evidenced by a written evaluation framework, a scoring matrix or a tender document.'),

  -- Solution fit
  ('assessTechSolutionFit', 1, 'Not applicable before the requirement is defined well enough to assess fit against.'),
  ('assessTechSolutionFit', 2, 'Whether Terminus fits the requirement has not been assessed.'),
  ('assessTechSolutionFit', 3, 'Terminus has assessed fit against its own reading of the requirement. The buyer has not tested it.'),
  ('assessTechSolutionFit', 4, 'The buyer has confirmed that the solution meets the requirement as they understand it.'),
  ('assessTechSolutionFit', 5, 'Fit is evidenced against the buyer''s written requirement, or demonstrated in their own environment.'),

  -- Integration complexity
  ('assessTechIntegrationComplexity', 1, 'Not applicable where the deployment is standalone and connects to nothing the buyer operates.'),
  ('assessTechIntegrationComplexity', 2, 'What this has to connect to has not been established.'),
  ('assessTechIntegrationComplexity', 3, 'Terminus has estimated the integration from the systems the buyer is known to run. Nobody has confirmed the interfaces.'),
  ('assessTechIntegrationComplexity', 4, 'A named person at the buyer has described the systems involved and what has to connect.'),
  ('assessTechIntegrationComplexity', 5, 'The integration is evidenced by an interface specification, an architecture document, or access to the systems themselves.'),

  -- Data and architecture requirements
  ('assessTechDataArchitecture', 1, 'Not applicable where no buyer data is processed, moved or stored.'),
  ('assessTechDataArchitecture', 2, 'What data is involved, and where it must live, has not been established.'),
  ('assessTechDataArchitecture', 3, 'Terminus has assumed the data picture from the deployment type. The buyer''s architecture team has not been engaged.'),
  ('assessTechDataArchitecture', 4, 'A named person at the buyer has stated the data and architecture requirements.'),
  ('assessTechDataArchitecture', 5, 'The requirements are evidenced by an architecture standard, a data flow document or a completed security review.'),

  -- Delivery feasibility
  ('assessTechDeliveryFeasibility', 1, 'Not applicable where the buyer has set no delivery constraint and the scope is not yet defined.'),
  ('assessTechDeliveryFeasibility', 2, 'Whether Terminus can deliver this scope, on this site, to this date has not been assessed.'),
  ('assessTechDeliveryFeasibility', 3, 'Terminus believes delivery is feasible from comparable deployments. The specifics of this site have not been checked.'),
  ('assessTechDeliveryFeasibility', 4, 'Delivery has been assessed against the buyer''s stated constraints and confirmed with them.'),
  ('assessTechDeliveryFeasibility', 5, 'Feasibility is evidenced by a site survey, a resourced plan, or a comparable deployment delivered under the same constraints.'),

  -- Pilot or proof-of-concept requirement, on the three-level scale.
  --
  -- Confirmed covers BOTH outcomes, and that is the point of the level rather
  -- than a looseness in it: the requirement being discharged is "we know where
  -- we stand on a pilot", which is settled by an agreed pilot and equally by a
  -- written decision not to run one. A generic "the requirement is met and
  -- evidenced" could not have said that.
  ('assessTechPilotRequirement', 1, 'Not applicable where the buyer has said they will proceed on evidence from elsewhere, or where the deployment is too small to pilot meaningfully.'),
  ('assessTechPilotRequirement', 2, 'Whether a pilot is required has not been settled, or one is expected and its scope, cost and success criteria are not agreed.'),
  ('assessTechPilotRequirement', 4, 'The position is settled in writing: either no pilot is required, or its scope, duration, cost and success criteria are agreed.')
) as v(criterion_key, score, wording)
join public.scoring_criteria c
  on c.record_type = 'opportunity' and c.criterion_key = v.criterion_key
where not exists (
  select 1 from public.scoring_anchors a
  where a.criterion_id = c.id and a.version = 1 and a.score = v.score
);
