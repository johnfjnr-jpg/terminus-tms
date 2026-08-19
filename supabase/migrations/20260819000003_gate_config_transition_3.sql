-- Round 9 Phase 4, transition 3 of 4.
--
-- Site Assessment -> Installation and Commissioning: three documents and
-- three approvals. This transition had no rules at all before now.
--
-- ONE document_status row PER DOCUMENT, never one row naming several. The
-- requirement_detail shape is copied from transition 2's existing NDA row
-- read directly out of the live database, {"status": "approved",
-- "document": "<name>"}, rather than reconstructed from the brief.
--
-- Document gates use requirement_type = 'document_status', never
-- child_record_status. Only document_status is read by
-- completable_documents in test-beds.js, which is what renders the
-- Confirm control an operator clicks to satisfy the gate. A
-- child_record_status rule naming a document blocks correctly and offers
-- no way to satisfy it from inside the product, which is worse than a
-- wrong gate because everything looks configured.
--
-- All three document names were confirmed present as
-- stage_reference_docs rows for record_type 'test_bed' at stage_name
-- 'Site Assessment', by exact byte match, before this migration was
-- written. Nothing in the schema joins those two tables, so the names
-- being identical in all three places (here, the catalogue, and the seed)
-- is the only thing making these gates satisfiable.
--
-- All three approvals carry scope "stage". See transition 2's migration
-- for why an absent scope is a defect rather than a default.
--
-- Idempotent per CLAUDE.md Architecture rule 7, guards compare jsonb to
-- jsonb.

insert into public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
select 'test_bed', null, 'Site Assessment', 'Installation and Commissioning',
       'document_status', v.detail::jsonb
from (values
  ('{"status": "approved", "document": "Site Assessment Report"}'),
  ('{"status": "approved", "document": "Compliance and Data Protection"}'),
  ('{"status": "approved", "document": "Partnership and Test Bed Agreement"}')
) as v(detail)
where not exists (
  select 1 from public.stage_gate_rules r
  where r.record_type = 'test_bed' and r.variant is null
    and r.from_stage = 'Site Assessment' and r.to_stage = 'Installation and Commissioning'
    and r.requirement_type = 'document_status'
    and r.requirement_detail = v.detail::jsonb
);

insert into public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
select 'test_bed', null, 'Site Assessment', 'Installation and Commissioning',
       'approval_obtained', v.detail::jsonb
from (values
  ('{"track": "Commercial", "scope": "stage"}'),
  ('{"track": "Technical", "scope": "stage"}'),
  ('{"track": "Legal", "scope": "stage"}')
) as v(detail)
where not exists (
  select 1 from public.stage_gate_rules r
  where r.record_type = 'test_bed' and r.variant is null
    and r.from_stage = 'Site Assessment' and r.to_stage = 'Installation and Commissioning'
    and r.requirement_type = 'approval_obtained'
    and r.requirement_detail = v.detail::jsonb
);
