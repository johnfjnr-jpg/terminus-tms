-- Terminus TMS: "Proposal issued" becomes a visible exit criterion.
-- Round 41, seventh walk W-J.
--
-- ═════════════════════════════════════════════════════════════
-- THE PRECONDITION EXISTS AND IS INVISIBLE
-- ═════════════════════════════════════════════════════════════
--
-- Proposal -> Evaluation already requires an ISSUED Deal Sheet version.
-- needsIssuedVersion() names the transition and issuedProposal() enforces it, so
-- a request is refused until a version has been issued at the current revision.
--
-- NOTHING ON THE EXIT CRITERIA LIST SAYS SO. The panel lists the three payload
-- fields and the assessment review, all of them tickable, and a person completes
-- every visible criterion and is then refused for a rule that was never shown.
-- The walk met it as a recurring message it read as an error, which is W-K.
--
-- ═════════════════════════════════════════════════════════════
-- WHY payload_field_required RATHER THAN A NEW TYPE
-- ═════════════════════════════════════════════════════════════
--
-- A new requirement_type would need a branch in computeBlocking, a branch in
-- buildStageTracks, a message, and a tick path - four places, to express
-- something the engine can already say.
--
-- THIS ROW IS A LABEL, NOT A SECOND ENFORCEMENT. The field it names is never
-- written, so the criterion reads UNMET until the version is issued and the
-- transition is requested. It exists to make the rule VISIBLE in the list beside
-- the others; issuedProposal remains the only thing that decides.
--
-- THE RISK, NAMED. A criterion nobody can tick is a criterion that looks broken.
-- The label carries the action - "Proposal issued (issue the latest draft)" -
-- so the list says what to do rather than offering a box that does nothing, and
-- the client renders an approval-style row rather than a tickable one because
-- OPP_EXIT_CRITERION_KEYS does not contain this key.
--
-- Two things follow that are deliberate: it cannot be ticked by hand, which is
-- correct because issuing is the act; and it cannot be satisfied by a draft,
-- which is exactly the confusion W-K exists to remove.
--
-- ═════════════════════════════════════════════════════════════
-- SCOPE: PROPOSAL ONLY
-- ═════════════════════════════════════════════════════════════
--
-- needsIssuedVersion is Proposal -> Evaluation and nothing else, so this row is
-- Proposal -> Evaluation and nothing else. Adding it to every stage would be
-- asserting a rule that does not exist on four of them.

insert into public.stage_gate_rules
  (record_type, from_stage, to_stage, requirement_type, requirement_detail)
select 'opportunity', 'Proposal', 'Evaluation', 'payload_field_required',
  jsonb_build_object(
    'field', 'proposalIssued',
    'label', 'Proposal issued (issue the latest draft)')
where not exists (
  select 1 from public.stage_gate_rules
  where record_type = 'opportunity' and from_stage = 'Proposal'
    and requirement_type = 'payload_field_required'
    and requirement_detail->>'field' = 'proposalIssued'
);

-- Architecture 10: the ledger row, in the same paste.
insert into supabase_migrations.schema_migrations (version)
values ('20260901000001')
on conflict (version) do nothing;
