-- Restores audit_log.record_id -> records(id) ON DELETE RESTRICT, the
-- identical constraint dropped in 20260815000013 - but NOT VALID, so it
-- doesn't attempt to validate the 390 historical rows now sitting there,
-- all of which genuinely point at records that no longer exist, by
-- design (the 2026-08-15 full data wipe, audit_log deliberately excluded
-- from it and left as history).
--
-- Same NOT VALID reasoning already established this session (see
-- 20260815000002's account_id constraint): skips checking existing rows
-- at ADD CONSTRAINT time, enforces fully for every INSERT and UPDATE
-- from this point forward. Full referential protection is restored for
-- any real record deletion that happens after today - proven, not just
-- asserted, by a real rejected insert immediately after this migration
-- applies.
alter table public.audit_log
  add constraint audit_log_record_id_fkey
  foreign key (record_id) references public.records(id) on delete restrict
  not valid;
