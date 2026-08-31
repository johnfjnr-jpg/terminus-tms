-- Terminus TMS: an approval row can say that it decides nothing. Round 41 item A.
--
-- ═════════════════════════════════════════════════════════════
-- WHICH MECHANISM, AND WHY THIS ONE
-- ═════════════════════════════════════════════════════════════
--
-- The business asked for the five self-approval rows to be marked and named two
-- candidates: an audit_log entry per row, or a column on approvals reusable for
-- the 882 pre-workflow rows. This file is the second, and the argument against
-- the first is already written in this repository.
--
-- 20260823000006, over the scoring anchors, records exactly this choice being
-- made the other way and what it cost:
--
--   "This warning is repeated at the insert itself, and it is worth saying why
--    so prominently ... those anchors have been read as settled ever since ...
--    A comment in a migration did not prevent that, and A READER QUERYING
--    scoring_anchors SEES NO MARKER AT ALL."
--
-- An audit_log entry is history about a row. It is correct, it is immutable, and
-- NOBODY QUERYING approvals WOULD SEE IT. The rows would keep reading as
-- ordinary approvals to every person and every query that does not think to join
-- a second table, which is the same fault in a different table.
--
-- So the marker travels with the row.
--
-- ═════════════════════════════════════════════════════════════
-- IT IS DOCUMENTARY. NOTHING MAY BRANCH ON IT.
-- ═════════════════════════════════════════════════════════════
--
-- This is the condition of adding it, and it is the risk the column carries:
-- a nullable "does this count" field beside an approval is one refactor away
-- from becoming a second mechanism for deciding whether an approval counts,
-- sitting beside approvalSatisfiesRule and drifting from it. Verification 20 at
-- design level, and Verification 23's remedy applies - one of the two would have
-- to become a caller of the other, and the answer here is that there is only
-- ever one.
--
-- WHAT ACTUALLY MAKES THESE ROWS INERT is unchanged and is not this column: for
-- a workflow record type approvalSatisfiesRule returns requestApprovals.has(track)
-- and never reaches the stage or revision branches, so a row with a null
-- request_id satisfies nothing. This column SAYS SO to a reader. It does not
-- cause it.
--
-- scripts/tests/config-invariants.test.mjs asserts that no evaluator reads it.
--
-- ═════════════════════════════════════════════════════════════
-- TWENTY-FIVE ROWS, NOT FIVE, AND THE WIDENING IS REPORTED
-- ═════════════════════════════════════════════════════════════
--
-- The business named five: the walk's own self-approvals. Measured, the
-- population that is inert FOR THE SAME REASON is 25, on three live
-- opportunities:
--
--   TT-SGP-MANUFI-002   12 rows, all by the owner
--   TT-SGP-SMARTC-003    5 rows, all by the owner
--   TT-SGP-SMARTC-108    8 rows: the 5 the business named, plus 3 by an
--                        approver who does NOT own the record
--
-- MARKING FIVE AND LEAVING TWENTY IDENTICAL ROWS UNMARKED WOULD REPRODUCE THE
-- FAULT THE COLUMN EXISTS TO PREVENT: a reader querying approvals would see some
-- inert rows labelled and others not, and would reasonably conclude the unlabelled
-- ones count.
--
-- The predicate is therefore what makes them inert rather than who wrote them:
-- a null request_id on a record type that uses the workflow. The owner clause is
-- carried in the REASON, not in the selection, because 4 of the 25 are inert
-- without it.
--
-- LIVE RECORDS ONLY. 942 request-less approvals exist; 917 sit on soft-deleted
-- probe fixtures and on Test Beds, which do not use the workflow. Marking those
-- would be labelling test residue and a record type where the rows are correct.
--
-- The 882 pre-workflow rows are NOT marked here. They were correct under the
-- model they were written in, and whether they are inert is a question about
-- that model rather than about the rows. The column exists for them when that is
-- decided; deciding it inside a migration about a walk finding would be the
-- ruling nobody asked for.

alter table public.approvals
  add column if not exists inert_reason text;

comment on column public.approvals.inert_reason is
  'Documentary only, Round 41 item A. Why this approval decides nothing. NOTHING '
  'BRANCHES ON IT: what makes a row inert is approvalSatisfiesRule, which reads '
  'requestApprovals for a workflow record type and never reaches the stage or '
  'revision branches. A test asserts no evaluator reads this column.';

-- Identified by what they ARE rather than by id, so replaying this cannot mark a
-- row that later happens to occupy the same id, and so a row written tomorrow
-- through the same superseded path is caught by re-running rather than missed.
--
-- The record type is written as a literal here rather than read from
-- WORKFLOW_RECORD_TYPES, because SQL cannot import it. That is a second reader
-- of the list, so it is named as one: when Test Bed joins the workflow, this
-- migration does not retroactively cover it and a new one says so.
update public.approvals a
set inert_reason =
  'Recorded through POST /records/:id/approvals, a route the stage approvals workflow '
  'superseded for this record type. It carries no request_id, so approvalSatisfiesRule '
  'never reads it: for a workflow record type that function returns '
  'requestApprovals.has(track) and never reaches the stage or revision branches.'
  || case when a.approver_id = r.owner_id
       then ' It was also recorded by the record''s own owner, who may not approve their own transition.'
       else '' end
from public.records r
where r.id = a.record_id
  and a.request_id is null
  and r.record_type = 'opportunity'
  and r.deleted_at is null
  and a.inert_reason is null;

-- Architecture 10: the ledger row, in the same paste.
insert into supabase_migrations.schema_migrations (version)
values ('20260831000009')
on conflict (version) do nothing;
