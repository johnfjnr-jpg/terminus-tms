-- Terminus TMS: two corrections to 20260831000001, both found by calibrating it.
-- Round 41, the stage approvals workflow.
--
-- ─────────────────────────────────────────────────────────────
-- 1. THE OLD UNIQUENESS STILL GOVERNS THE NEW APPROVALS, AND REFUSES THEM
-- ─────────────────────────────────────────────────────────────
--
-- `approvals` carries `unique nulls not distinct (record_id, revision_number,
-- stage, track, approver_id)`, named
-- approvals_record_revision_stage_track_approver_key and last rewritten by
-- 20260819000005. 20260831000001 added `request_id` and a second uniqueness over
-- (request_id, track), and kept `revision_number` populated on a request-bound
-- row so an approval can still say which state it approved.
--
-- THE COLUMN LIST WAS READ FROM THE MIGRATION THAT DEFINES IT, not from the
-- initial schema, and the difference mattered: the initial schema's four-column
-- version is not what is on the database, and a probe of mine that omitted
-- `stage` slipped a duplicate approval past a constraint that was working
-- correctly. Recorded in the phase report.
--
-- BOTH CONSTRAINTS THEN APPLY TO THE SAME ROW. Measured, on TT-SGP-SMARTC-003:
-- the record carries a pre-workflow Commercial approval at revision 34, so
-- opening a request at revision 34 and approving Commercial through it is
-- refused with 23505 by the OLD constraint, which knows nothing about requests.
--
-- AND THE ROUTE WOULD HAVE TURNED THAT INTO THE WALK'S OWN ERROR MESSAGE:
-- "An approval decision from you already exists for this revision and track".
-- That is the sentence the re-price-and-version walk failed on, reappearing
-- inside the workflow built to remove it, on every record that already has an
-- approval at the revision a request happens to freeze.
--
-- THE FIX IS TO SCOPE THE OLD RULE TO THE ROWS IT WAS WRITTEN FOR. Pre-workflow
-- approvals keep their uniqueness exactly. Request-bound approvals are governed
-- by (request_id, track) and by nothing else, which is the model: one approval
-- per track per request, and the revision is audit rather than a key.

alter table public.approvals
  drop constraint if exists approvals_record_revision_stage_track_approver_key;

-- Same columns, same NULLS NOT DISTINCT semantics, scoped to the rows it was
-- written for. A partial index rather than a constraint, because a table
-- constraint cannot carry a WHERE clause.
create unique index if not exists approvals_pre_workflow_unique
  on public.approvals (record_id, revision_number, stage, track, approver_id)
  nulls not distinct
  where request_id is null;

comment on index public.approvals_pre_workflow_unique is
  'approvals_record_revision_stage_track_approver_key, scoped to the 882 rows '
  'that predate the stage approvals workflow. A request-bound approval is '
  'governed by approvals_one_per_request_track instead: one per track per '
  'request, with revision_number and stage kept as audit rather than as keys.';

-- ─────────────────────────────────────────────────────────────
-- 2. THE DENORMALISED record_type CANNOT DISAGREE WITH THE RECORD
-- ─────────────────────────────────────────────────────────────
--
-- transition_requests.record_type exists so the freeze trigger and the approver
-- queue can resolve without a join. That makes it a SECOND READER of a value
-- `records` already holds, and CLAUDE.md Verification 20 is that a second reader
-- of the same value always drifts.
--
-- A CHECK CONSTRAINT CANNOT SEE ANOTHER TABLE and a trigger would be a rule that
-- runs rather than a fact that holds. A COMPOSITE FOREIGN KEY makes the
-- disagreement unrepresentable: the pair must exist in `records`, so the column
-- can only ever hold what the record holds.
--
-- records.id is already the primary key, so the unique index below is
-- structurally free and exists only to give the foreign key something to point
-- at.

create unique index if not exists records_id_record_type
  on public.records (id, record_type);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'transition_requests_record_type_matches'
  ) then
    alter table public.transition_requests
      add constraint transition_requests_record_type_matches
      foreign key (record_id, record_type)
      references public.records (id, record_type)
      on delete restrict;
  end if;
end $$;

comment on constraint transition_requests_record_type_matches on public.transition_requests is
  'record_type is denormalised for the freeze trigger and the queue. This makes '
  'it impossible for it to disagree with the record, rather than checking that '
  'it does not.';

-- Architecture 10: the ledger row, in the same paste.
insert into supabase_migrations.schema_migrations (version)
values ('20260831000002')
on conflict (version) do nothing;
