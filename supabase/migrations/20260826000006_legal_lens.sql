-- Terminus TMS: the Legal lens, configured. Round 33 Phase 5, 2026-08-26.
--
-- Eight criteria, all on `Requirement confirmation, three level`. The last of
-- Round C's twenty-three, and the only lens where a reader sees no five-segment
-- control at all.
--
-- ============================================================================
-- THIS LENS IS WHY THE SCALE GAINED A THIRD LEVEL
-- ============================================================================
--
-- Phase 1 added Not applicable to a two-state scale, and the argument was made
-- about these eight: export control on a deal that crosses no border, local
-- content outside the jurisdictions that impose it, anti-corruption diligence
-- where no intermediary and no state entity is involved. On a two-state scale
-- those had nowhere to say so and would have read as unsatisfied for the life
-- of the record, making a Legal rollup that could never reach 8 of 8 and would
-- therefore stop being read.
--
-- SO LEVEL 1 IS THE MOST VALUABLE ANCHOR ON THIS LENS, and each is written to
-- say WHEN, specifically. "Not applicable, this deal does not raise the
-- requirement" is true and useless; "no personal data is processed,
-- transmitted or stored at any point in the deployment or its support" is a
-- test somebody can apply and be wrong about.
--
-- Not applicable also requires no reason, which makes it the cheapest way to
-- make a criterion go away. ONE CRITERION TAKES THE "Rarely applicable"
-- TREATMENT for that reason, following the two Commercial and two
-- Organisational criteria that carry it: Liability insurance and indemnity,
-- because a deal that delivers anything carries liability.
--
-- ============================================================================
-- CONFIRMED NAMES THE DOCUMENT, PER PHASE 4
-- ============================================================================
--
-- Phase 4 found the reasoning that gave five anchors on the evidence scale
-- inverting here: level 4 is the closest to generic there and the furthest
-- from generic on this scale, because "the requirement is met and evidenced"
-- cannot say what counts as evidence.
--
-- Eight criteria, eight different kinds of document: a framework named by
-- procurement, an executed master agreement, an export classification, a data
-- processing agreement, a certificate of insurance, a written offset
-- acceptance, a completed screening file, executed IP terms. Phase 2 made a
-- reason mandatory at Confirmed so the reference is recorded against the
-- score; these anchors are what tell a scorer which reference to record.
--
-- ============================================================================
-- SORTED BY INTRODUCTION STAGE, per Phase 3's rhythm. Procurement route at
-- Qualification is 1, the six Solution Alignment criteria are 2 to 7, and IP
-- ownership at Proposal is 8.
--
-- FOUR NAMES WRAP: Procurement route and compliance at 236px, Export control
-- and licensing status at 232px, Local content or offset requirements at
-- 241px, and Anti-corruption and integrity due diligence at 281px, against the
-- 230px the criterion cell gives a name. Accepted in Phase 2 with the
-- reasoning recorded: the cell can grow by exactly the 51px the widest needs
-- and no more, and a cell with no slack is how this started.
--
-- No PROVISIONAL prefix. No `assessment_current` rows.
--
-- Idempotent per Architecture rule 7: every insert guarded on the natural key.
-- No seed file carries any of these three tables, checked and calibrated
-- against stage_gate_rules, which supabase/seeds/001_smoke_test.sql does carry.

insert into public.scoring_criteria
  (record_type, criterion_key, name, asks, sort_order, lens_id, scale_id)
select 'opportunity', v.criterion_key, v.name, v.asks, v.sort_order, l.id, s.id
from (values
  ('assessLegalProcurementRoute',  'Procurement route and compliance',
   'How must they buy this, and what rules bind that route', 1),
  ('assessLegalPaperProcess',      'Paper process',
   'Whose contract do we sign, and what passes through legal', 2),
  ('assessLegalExportControl',     'Export control and licensing status',
   'Can this be shipped and supported lawfully', 3),
  ('assessLegalDataProtection',    'Data protection and residency',
   'What personal data is involved, and where must it live', 4),
  ('assessLegalLiabilityIndemnity','Liability insurance and indemnity',
   'What are we on the hook for, and are we covered for it', 5),
  ('assessLegalLocalContent',      'Local content or offset requirements',
   'Does this jurisdiction require local participation', 6),
  ('assessLegalAntiCorruption',    'Anti-corruption and integrity due diligence',
   'Who stands between us and the buyer, and have we checked them', 7),
  ('assessLegalIpOwnership',       'IP ownership and licensing terms',
   'Who owns what is created, and on what terms is ours licensed', 8)
) as v(criterion_key, name, asks, sort_order)
cross join (select id from public.scoring_lenses where name = 'Legal') l
cross join (select id from public.scoring_scales
            where name = 'Requirement confirmation, three level') s
where not exists (
  select 1 from public.scoring_criteria c
  where c.record_type = 'opportunity' and c.criterion_key = v.criterion_key
);

-- Thirty-two stage rows: one criterion at five stages, six at four, one at
-- three. IP ownership is introduced at Proposal, so it is visible at three.
insert into public.scoring_criterion_stages (criterion_id, stage, required)
select c.id, v.stage, v.required
from (values
  ('assessLegalProcurementRoute',  'Qualification',      true),
  ('assessLegalProcurementRoute',  'Solution Alignment', false),
  ('assessLegalProcurementRoute',  'Proposal',           false),
  ('assessLegalProcurementRoute',  'Evaluation',         false),
  ('assessLegalProcurementRoute',  'Negotiating',        false),

  ('assessLegalPaperProcess',      'Solution Alignment', true),
  ('assessLegalPaperProcess',      'Proposal',           false),
  ('assessLegalPaperProcess',      'Evaluation',         false),
  ('assessLegalPaperProcess',      'Negotiating',        false),

  ('assessLegalExportControl',     'Solution Alignment', true),
  ('assessLegalExportControl',     'Proposal',           false),
  ('assessLegalExportControl',     'Evaluation',         false),
  ('assessLegalExportControl',     'Negotiating',        false),

  ('assessLegalDataProtection',    'Solution Alignment', true),
  ('assessLegalDataProtection',    'Proposal',           false),
  ('assessLegalDataProtection',    'Evaluation',         false),
  ('assessLegalDataProtection',    'Negotiating',        false),

  ('assessLegalLiabilityIndemnity','Solution Alignment', true),
  ('assessLegalLiabilityIndemnity','Proposal',           false),
  ('assessLegalLiabilityIndemnity','Evaluation',         false),
  ('assessLegalLiabilityIndemnity','Negotiating',        false),

  ('assessLegalLocalContent',      'Solution Alignment', true),
  ('assessLegalLocalContent',      'Proposal',           false),
  ('assessLegalLocalContent',      'Evaluation',         false),
  ('assessLegalLocalContent',      'Negotiating',        false),

  ('assessLegalAntiCorruption',    'Solution Alignment', true),
  ('assessLegalAntiCorruption',    'Proposal',           false),
  ('assessLegalAntiCorruption',    'Evaluation',         false),
  ('assessLegalAntiCorruption',    'Negotiating',        false),

  ('assessLegalIpOwnership',       'Proposal',           true),
  ('assessLegalIpOwnership',       'Evaluation',         false),
  ('assessLegalIpOwnership',       'Negotiating',        false)
) as v(criterion_key, stage, required)
join public.scoring_criteria c
  on c.record_type = 'opportunity' and c.criterion_key = v.criterion_key
where not exists (
  select 1 from public.scoring_criterion_stages s
  where s.criterion_id = c.id and s.stage = v.stage
);

-- ---------------------------------------------------------------------------
-- Anchors, version 1. Twenty-four rows: eight criteria at three levels, at the
-- values this scale carries, which are 1, 2 and 4.
-- ---------------------------------------------------------------------------
insert into public.scoring_anchors (criterion_id, version, score, wording)
select c.id, 1, v.score, v.wording
from (values
  -- Procurement route and compliance
  ('assessLegalProcurementRoute', 1, 'Not applicable where the buyer is a private entity purchasing at its own discretion, with no procurement policy, framework or regulated route governing a purchase of this kind.'),
  ('assessLegalProcurementRoute', 2, 'The route has not been established, or it is known and the rules binding it have not been checked.'),
  ('assessLegalProcurementRoute', 4, 'The route is confirmed in writing: a framework or contract vehicle named by procurement, a published tender notice, or a written statement that the buyer may award directly.'),

  -- Paper process
  ('assessLegalPaperProcess', 1, 'Not applicable where an executed master agreement already covers this scope and no new paper is required to transact.'),
  ('assessLegalPaperProcess', 2, 'Whose paper this runs on has not been agreed, or it has and the review steps and their owners are not known.'),
  ('assessLegalPaperProcess', 4, 'The paper position is settled: the governing agreement identified by name and version, and the review path and its owners confirmed by the buyer''s legal function.'),

  -- Export control and licensing status
  ('assessLegalExportControl', 1, 'Not applicable where nothing crosses a border: the deal is delivered and supported wholly within one jurisdiction and no controlled technology is transferred.'),
  ('assessLegalExportControl', 2, 'No classification has been made, or one exists and a licence it requires is outstanding or its status is unknown.'),
  ('assessLegalExportControl', 4, 'A written export classification is on file, and any licence it requires is granted and current, with its reference recorded.'),

  -- Data protection and residency
  ('assessLegalDataProtection', 1, 'Not applicable where no personal data is processed, transmitted or stored at any point in the deployment or its support.'),
  ('assessLegalDataProtection', 2, 'The applicable regime has not been identified, or it has and the residency position or the processing terms are unresolved.'),
  ('assessLegalDataProtection', 4, 'The position is documented: the applicable regime named, a data processing agreement executed, and the residency of each data flow recorded.'),

  -- Liability insurance and indemnity
  ('assessLegalLiabilityIndemnity', 1, 'Rarely applicable: a deal that delivers anything carries liability. Use only where Terminus is not a party to the agreement, such as a pass-through resale by a partner who contracts with the buyer directly.'),
  ('assessLegalLiabilityIndemnity', 2, 'The liability position has not been assessed, or caps, exclusions and indemnities are proposed and not agreed.'),
  ('assessLegalLiabilityIndemnity', 4, 'The agreed position is recorded against executed terms, and the cover required to meet it is evidenced by a current certificate of insurance.'),

  -- Local content or offset requirements
  ('assessLegalLocalContent', 1, 'Not applicable where the buyer''s jurisdiction imposes no local content, offset or industrial participation obligation on a purchase of this kind and size.'),
  ('assessLegalLocalContent', 2, 'Whether an obligation applies has not been established, or it applies and the means of meeting it is not agreed.'),
  ('assessLegalLocalContent', 4, 'The position is confirmed in writing by the buyer or the responsible authority: either no obligation applies, or the obligation and the plan to meet it are documented and accepted.'),

  -- Anti-corruption and integrity due diligence
  ('assessLegalAntiCorruption', 1, 'Not applicable where the sale is direct to a commercial buyer with no intermediary, agent or reseller, and no state entity, state-owned enterprise or public official is a party to or a beneficiary of the transaction.'),
  ('assessLegalAntiCorruption', 2, 'Diligence has not been carried out, or it has been started and the findings are open.'),
  ('assessLegalAntiCorruption', 4, 'Diligence is complete and recorded: screening performed on the counterparty and any intermediary, the findings documented, and any agent engaged under a written agreement carrying anti-bribery terms.'),

  -- IP ownership and licensing terms
  ('assessLegalIpOwnership', 1, 'Not applicable where nothing is created for the buyer and the offer is delivered wholly as a standard product under standard terms the buyer has already accepted.'),
  ('assessLegalIpOwnership', 2, 'Ownership and licensing have not been discussed, or terms are proposed and the position on foreground IP, background IP or data rights is unresolved.'),
  ('assessLegalIpOwnership', 4, 'The position is settled in executed terms: ownership of foreground IP stated, the licence over Terminus material scoped, and any data or derived-data rights recorded.')
) as v(criterion_key, score, wording)
join public.scoring_criteria c
  on c.record_type = 'opportunity' and c.criterion_key = v.criterion_key
where not exists (
  select 1 from public.scoring_anchors a
  where a.criterion_id = c.id and a.version = 1 and a.score = v.score
);
