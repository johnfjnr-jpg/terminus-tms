-- Terminus TMS: Opportunity gate rules, Round 20 Phase 5
--
-- OPPORTUNITY_DESIGN.md v1.2. The first gate rules Opportunity has ever
-- had: stage_gate_rules held zero rows for record_type 'opportunity' from
-- Milestone 2 until this migration, asserted rather than assumed at the
-- start of Round 20 Phase 0 and again immediately before this ran.
--
--   Qualification      -> Solution Alignment   3 criteria, no approvals
--   Solution Alignment -> Proposal             4 criteria, C/T/L
--   Proposal           -> Evaluation           4 criteria, C/T/L
--   Evaluation         -> Negotiating          3 criteria, C/T/L
--   Negotiating        -> Closed Won           5 criteria, C/T/L
--   any stage          -> Closed Lost          nothing at all
--
-- Closed Lost gets no rows deliberately. A deal is lost when it is lost,
-- and a gate on recording that is a gate on telling the truth. It is
-- reachable from any stage by the column added in Phase 2, and it carries
-- a reason, which is the reason-codes round rather than this one.
--
-- NO SALES LEAD TRACK, AND NO NEW TRACKS. A Sales Lead approval is the
-- sales lead approving their own transition. The transition is already
-- authenticated, attributed to a user id and timestamped in audit_log, and
-- the exit criteria above it are the governance. A signature by the actor
-- on their own act records the same fact twice. Scale-dependent in exactly
-- the way the Bid Review decision was: the moment someone other than the
-- sales lead can move a record, it becomes a real control. Recorded as
-- revisitable in OPPORTUNITY_DESIGN.md rather than as settled.
--
-- Approvals have NO required order between tracks, per DESIGN_PRINCIPLES.md
-- Section 5. Three rows on a transition means all three must be satisfied,
-- in any order, by whoever is ready first. Ordering is not expressible in
-- this table and was deliberately not reintroduced.
--
-- Verified against the live system while writing these rather than assumed:
--   1. approval_tracks is genuinely data-driven. No route or frontend
--      switch names Commercial, Technical, Legal, Internal, Finance or
--      Senior. approvals.track is a foreign key to approval_tracks, so a
--      track that does not exist cannot be recorded at all.
--   2. An ad-hoc approval on a track no gate rule requires is already
--      accepted and fully recorded: track, decision, comment, stage,
--      revision, approver id and timestamp, plus an approval_submitted
--      row in audit_log. The request-and-block workflow is deferred, but
--      the audit trail the business asked for exists today with no build.
--
-- Idempotency: every insert is guarded WHERE NOT EXISTS comparing jsonb to
-- jsonb, never through a ::text cast, which is the fault that once
-- duplicated rows on every seed run.

-- ── Exit criteria ─────────────────────────────────────────────
insert into public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
select 'opportunity', null, v.from_stage, v.to_stage, 'payload_field_required', v.detail::jsonb
from (values
  ('Qualification','Solution Alignment','{"field":"exitQualBudget","label":"Budget"}'),
  ('Qualification','Solution Alignment','{"field":"exitQualTimeline","label":"Timeline"}'),
  ('Qualification','Solution Alignment','{"field":"exitQualCommitment","label":"Commitment to move forward"}'),

  ('Solution Alignment','Proposal','{"field":"exitSolTechnicalSolution","label":"Technical solution understood"}'),
  ('Solution Alignment','Proposal','{"field":"exitSolBuyersKnown","label":"Buyers known"}'),
  ('Solution Alignment','Proposal','{"field":"exitSolKeyStakeholders","label":"Key stakeholders"}'),
  ('Solution Alignment','Proposal','{"field":"exitSolTermsReviewed","label":"Terms and conditions reviewed"}'),

  ('Proposal','Evaluation','{"field":"exitPropPricingApproved","label":"Pricing approved"}'),
  ('Proposal','Evaluation','{"field":"exitPropContractTerms","label":"Contract terms and variations approved"}'),
  ('Proposal','Evaluation','{"field":"exitPropImplSchedule","label":"Implementation schedule agreed"}'),
  ('Proposal','Evaluation','{"field":"exitPropDocumentation","label":"Proposal documentation approved"}'),

  ('Evaluation','Negotiating','{"field":"exitEvalClarificationsResponded","label":"Clarifications responded to"}'),
  ('Evaluation','Negotiating','{"field":"exitEvalRevisedPricing","label":"Revised pricing submitted if required"}'),
  ('Evaluation','Negotiating','{"field":"exitEvalTechnicalClarifications","label":"Technical clarifications completed"}'),

  ('Negotiating','Closed Won','{"field":"exitNegScopeAgreed","label":"Scope agreed"}'),
  ('Negotiating','Closed Won','{"field":"exitNegPricingAgreed","label":"Pricing agreed"}'),
  ('Negotiating','Closed Won','{"field":"exitNegLegalResolved","label":"Legal issues resolved"}'),
  ('Negotiating','Closed Won','{"field":"exitNegCommercialsApproved","label":"Commercials approved"}'),
  ('Negotiating','Closed Won','{"field":"exitNegContractExecuted","label":"Contract executed"}')
) as v(from_stage, to_stage, detail)
where not exists (
  select 1 from public.stage_gate_rules r
  where r.record_type = 'opportunity' and r.variant is null
    and r.from_stage = v.from_stage and r.to_stage = v.to_stage
    and r.requirement_type = 'payload_field_required'
    and r.requirement_detail = v.detail::jsonb
);

-- ── Approvals ─────────────────────────────────────────────────
insert into public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
select 'opportunity', null, t.from_stage, t.to_stage, 'approval_obtained',
       jsonb_build_object('scope', 'stage', 'track', k.track)
from (values
  ('Solution Alignment','Proposal'),
  ('Proposal','Evaluation'),
  ('Evaluation','Negotiating'),
  ('Negotiating','Closed Won')
) as t(from_stage, to_stage)
cross join (values ('Commercial'), ('Technical'), ('Legal')) as k(track)
where not exists (
  select 1 from public.stage_gate_rules r
  where r.record_type = 'opportunity' and r.variant is null
    and r.from_stage = t.from_stage and r.to_stage = t.to_stage
    and r.requirement_type = 'approval_obtained'
    and r.requirement_detail = jsonb_build_object('scope', 'stage', 'track', k.track)
);
