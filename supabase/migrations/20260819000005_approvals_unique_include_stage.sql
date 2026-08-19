-- Round 9 Phase 4A.2: add `stage` to the approvals unique constraint.
--
-- The constraint being replaced is
--   UNIQUE (record_id, revision_number, track, approver_id)
-- written in Milestone 1, before approvals had any concept of stage.
-- Round 7 Phase 3.1 added approvals.stage and made stage-scoped gate
-- rules match on it, but did not revisit this constraint.
--
-- THE DEFECT THAT FOLLOWED, reproduced against the live endpoint in Round
-- 9 Phase 4 rather than inferred from the schema: a track that has
-- already approved at an earlier stage cannot approve again at the next
-- one unless some field edit has advanced the revision in between. The
-- endpoint returns
--   409 An approval decision from you already exists for this revision and track
-- This is not cosmetic. Commercial gates transitions 1, 2, 3 and 4, and
-- Phase 5 adds it to 5, 6 and 7, so the same track legitimately approves
-- at seven consecutive stages. During Phase 4's walkthrough this fired
-- twice and had to be worked around by making a real field edit, which is
-- plausible operator behaviour but in no way guaranteed: an operator who
-- progresses two stages without editing anything simply cannot tick the
-- box, and sees an unexplained failure.
--
-- BOTH KEYS ARE RETAINED, so a new decision is admitted when EITHER the
-- revision or the stage moves. Dropping revision_number would have been
-- the smaller-looking change and is wrong: Round 7 Phase 3.1 constraint 1
-- requires approvals to keep recording the revision even when gated on
-- stage, so that a future pricing-history view over record_revisions
-- stays possible.
--
-- NULLS NOT DISTINCT is required, not incidental. approvals.stage is
-- nullable and pre-3.1 rows carry null by design, deliberately
-- un-backfilled because reconstructing a historical approval's stage from
-- the record's current status would fabricate history. Under Postgres's
-- default NULLS DISTINCT, two null-stage approvals for the same record,
-- revision, track and approver would no longer collide with each other,
-- silently weakening the constraint for exactly the historical rows it
-- already protects. Requires Postgres 15 or later; this database is 17.6.
--
-- Confirmed directly before writing this, rather than relying on Phase
-- 0's zero-null measurement continuing to hold: src/routes/approvals.js
-- is the ONLY insert path into this table in the whole of src/, and it
-- writes `stage: record.status` where records.status is NOT NULL. So
-- every approval written from here on carries a stage as a property of
-- the code, not as a property of today's data.

alter table public.approvals
  drop constraint if exists approvals_record_id_revision_number_track_approver_id_key;

alter table public.approvals
  drop constraint if exists approvals_record_revision_stage_track_approver_key;

alter table public.approvals
  add constraint approvals_record_revision_stage_track_approver_key
  unique nulls not distinct (record_id, revision_number, stage, track, approver_id);

comment on constraint approvals_record_revision_stage_track_approver_key on public.approvals is
  'One decision per approver per track, per revision AND per stage. Stage '
  'was added in Round 9 Phase 4A.2: without it, a track that approved at '
  'an earlier stage was refused at the next one until a field edit moved '
  'the revision. NULLS NOT DISTINCT so pre-Round-7 null-stage rows still '
  'collide with each other as they did before.';
