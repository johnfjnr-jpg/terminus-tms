-- TEMPORARY, for the full data-wipe requested 2026-08-15 - reverted (as
-- NOT VALID) by a follow-up migration in this same session.
--
-- audit_log.record_id references public.records(id) on delete restrict
-- (20260801000000). With every audit_log row (390) referencing a record
-- about to be hard-deleted, this constraint would reject the deletion
-- outright - found by checking foreign keys directly before touching
-- anything, not assumed. Explicit decision: keep every audit_log row's
-- record_id unchanged, as history, even once it points at a record that
-- no longer exists. That state is legal once this constraint is gone,
-- and only once it's gone.
alter table public.audit_log
  drop constraint audit_log_record_id_fkey;
