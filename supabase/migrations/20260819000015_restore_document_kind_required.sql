-- Restores records_document_kind_required, dropped by
-- 20260819000014_temp_drop_document_kind_required.sql so invariant 10 could be
-- proven capable of failing against a real row rather than a reasoned one.
--
-- Restored IDENTICALLY, including NOT VALID and the deleted_at escape. The
-- escape is not decoration: a NOT VALID CHECK added against existing data once
-- locked a batch of legacy Test Beds out of being edited at all, including out
-- of soft-delete, because NOT VALID defers the initial scan and exempts nothing
-- afterwards.
--
-- Restoration is confirmed as real ENFORCEMENT rather than mere presence, by a
-- genuine rejected write afterwards, matching how 20260815000014 confirmed the
-- audit_log FK.
alter table public.records
  drop constraint if exists records_document_kind_required;
alter table public.records
  add constraint records_document_kind_required
  check (record_type <> 'document' or document_kind is not null or deleted_at is not null)
  not valid;
