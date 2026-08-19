-- Round 9 Phase 4, transition 2 of 4.
--
-- Pre-Site Assessment -> Site Assessment: add Commercial and Legal
-- approvals. This transition already carries its NDA document_status rule
-- and, until now, no approvals at all, recorded as "none yet" in Round 7
-- Phase 4. The NDA rule is untouched.
--
-- Every approval_obtained rule written this round carries
-- {"track": "<n>", "scope": "stage"}. Round 7 Phase 3.1 made an absent
-- scope default to "revision" for continuity, so omitting it is not
-- neutral, it opts into the wrong behaviour: every PATCH creates a new
-- revision, so the next field edit would void the approval and re-block
-- the gate while the tick still displayed as given. A rule missing scope
-- is a defect on the day it is written even though it appears to work.
--
-- Idempotent per CLAUDE.md Architecture rule 7, guards compare jsonb to
-- jsonb.

insert into public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
select 'test_bed', null, 'Pre-Site Assessment', 'Site Assessment',
       'approval_obtained', v.detail::jsonb
from (values
  ('{"track": "Commercial", "scope": "stage"}'),
  ('{"track": "Legal", "scope": "stage"}')
) as v(detail)
where not exists (
  select 1 from public.stage_gate_rules r
  where r.record_type = 'test_bed' and r.variant is null
    and r.from_stage = 'Pre-Site Assessment' and r.to_stage = 'Site Assessment'
    and r.requirement_type = 'approval_obtained'
    and r.requirement_detail = v.detail::jsonb
);
