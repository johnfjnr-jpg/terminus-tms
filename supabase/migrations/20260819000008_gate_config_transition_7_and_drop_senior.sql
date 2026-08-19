-- Round 9 Phase 5, transition 7 of 7, plus section 5.1.
--
-- Decommissioning -> Closed: the Site Decommissioning Report, plus
-- Technical, Commercial and Legal approvals. The existing
-- approval_obtained {"track": "Senior"} rule is REPLACED, not
-- supplemented, and is deleted here and from supabase/seeds/003_test_bed.sql
-- in the same change.
--
-- WHAT WAS REMOVED AND WHY, recorded here rather than only in git,
-- matching how 003_test_bed.sql keeps its own removals visible.
--
--   record_type 'test_bed', from 'Decommissioning', to 'Closed',
--   requirement_type 'approval_obtained', requirement_detail
--   {"track": "Senior"}
--
-- Confirmed with the business: the final transition is gated by
-- Technical, Commercial and Legal, the same three tracks as the two
-- preceding transitions.
--
-- REPORTED BEFORE DELETING, as Phase 5.1 requires, and the finding went
-- the other way to the one the brief anticipated. `Senior` IS a real
-- approval_tracks row, with the description "Senior-tier sign-off,
-- required for Test Bed closure. Tier to be defined when routing_rules is
-- built." So this was not a string no approval could be recorded against;
-- the rule genuinely blocked, and the track was genuinely tickable once a
-- record reached Decommissioning. Zero approvals were ever recorded
-- against it, which is a fact about a lifecycle no record had yet
-- completed rather than about the mechanism.
--
-- What WAS unbacked is the tier half. routing_rules has always held zero
-- rows, so the escalation the track's own description promises has no
-- data behind it; the approval_obtained branch only ever asked whether an
-- approved Senior decision existed. After this migration routing_rules is
-- referenced by nothing anywhere in the system.
--
-- The Senior row STAYS in approval_tracks, deliberately, now
-- unreferenced. The tier concept may return, and deleting an admin-
-- managed vocabulary row to tidy up after removing its only consumer
-- would discard a business decision rather than a dead reference.
--
-- Idempotent per CLAUDE.md Architecture rule 7, guards compare jsonb to
-- jsonb, never via a ::text cast.

delete from public.stage_gate_rules
where record_type = 'test_bed'
  and variant is null
  and from_stage = 'Decommissioning'
  and to_stage = 'Closed'
  and requirement_type = 'approval_obtained'
  and requirement_detail = '{"track": "Senior"}'::jsonb;

insert into public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
select 'test_bed', null, 'Decommissioning', 'Closed',
       'document_status', '{"status": "approved", "document": "Site Decommissioning Report"}'::jsonb
where not exists (
  select 1 from public.stage_gate_rules r
  where r.record_type = 'test_bed' and r.variant is null
    and r.from_stage = 'Decommissioning' and r.to_stage = 'Closed'
    and r.requirement_type = 'document_status'
    and r.requirement_detail = '{"status": "approved", "document": "Site Decommissioning Report"}'::jsonb
);

insert into public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
select 'test_bed', null, 'Decommissioning', 'Closed',
       'approval_obtained', v.detail::jsonb
from (values
  ('{"track": "Technical", "scope": "stage"}'),
  ('{"track": "Commercial", "scope": "stage"}'),
  ('{"track": "Legal", "scope": "stage"}')
) as v(detail)
where not exists (
  select 1 from public.stage_gate_rules r
  where r.record_type = 'test_bed' and r.variant is null
    and r.from_stage = 'Decommissioning' and r.to_stage = 'Closed'
    and r.requirement_type = 'approval_obtained'
    and r.requirement_detail = v.detail::jsonb
);
