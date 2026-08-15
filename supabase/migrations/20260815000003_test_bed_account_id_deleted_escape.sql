-- Terminus TMS: amend records_test_bed_requires_account_id to permit soft-deleted rows
--
-- Confirmed by direct test before writing this (2026-08-15): NOT VALID on
-- the original constraint (20260815000002) only skips the initial scan of
-- existing rows at ADD CONSTRAINT time. It does not exempt those rows
-- going forward - Postgres re-evaluates the CHECK against the full new
-- row image on every subsequent UPDATE, so even a soft-delete (setting
-- only deleted_at) on one of the 8 legacy null-account_id test_bed rows
-- was rejected with the same 23514 violation as any other edit.
--
-- All 8 of those rows are confirmed test/junk data, not real client
-- records, and are being soft-deleted, not backfilled with a real
-- Account. A deleted record doesn't need a real Account link - it's
-- leaving normal view, not progressing through the business process the
-- constraint exists to protect.
alter table public.records
  drop constraint records_test_bed_requires_account_id;

alter table public.records
  add constraint records_test_bed_requires_account_id
  check (record_type <> 'test_bed' or account_id is not null or deleted_at is not null)
  not valid;

comment on constraint records_test_bed_requires_account_id on public.records is
  'Test Bed Milestone 3: account_id is a hard precondition at creation '
  'for test_bed records specifically (PROTOTYPE_SPECIFICATION.md Section '
  '6, "Account link"), not a Qualification exit-gate field. Soft-deleted '
  'rows (deleted_at is not null) are exempt - a deleted record does not '
  'need a real Account link. Every other record_type is unaffected.';
