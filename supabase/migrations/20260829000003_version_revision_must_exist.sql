-- Terminus TMS: a version can only name a revision that exists. Round 38.
--
-- ─────────────────────────────────────────────────────────────
-- THE QUESTION THIS ANSWERS
-- ─────────────────────────────────────────────────────────────
--
-- version-approval.js carries a state called `inconsistent`, for a version
-- naming a revision the record has not reached. It is documented as meaning a
-- DATA FAULT rather than an ordinary outcome, and that claim needed checking
-- rather than asserting, because a state meant to signal corruption is worthless
-- if a race can produce it in normal operation.
--
-- IT CANNOT, AND THE REASONING IS SHORT. The version is stamped with a revision
-- the function has just verified is the record's current one, inside the
-- advisory lock; revision numbers only increase; therefore
-- latest_revision >= version.revision_number for anything that function writes,
-- and `inconsistent` is unreachable through it. A version born stale is
-- impossible too, for the same reason: no revision can land between the check
-- and the insert.
--
-- WHAT WAS STILL OPEN was everything that does not go through the function.
-- revision_number had to be non-null and nothing said it had to be REAL, so a
-- direct insert naming revision 999 would have produced an `inconsistent`
-- version with no data fault anywhere - the state would have been reachable by
-- an ordinary mistake, which is exactly what it must not mean.
--
-- The composite foreign key closes it. record_revisions already carries
-- unique (record_id, revision_number), so a version can only name a revision of
-- its own record that has actually been written.
--
-- NOT VALID, for the same reason as the requirement constraint: the one version
-- taken before revision_number existed carries null, and MATCH SIMPLE lets a row
-- with a null in the key satisfy the reference anyway. Nothing is backfilled and
-- nothing is validated.
--
-- ON DELETE / ON UPDATE are deliberately absent, which means NO ACTION: a
-- revision referenced by a version cannot be deleted. record_revisions has no
-- delete policy and is append-only, so this adds a second reason rather than a
-- new rule.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'deal_sheet_versions_revision_exists'
  ) then
    alter table public.deal_sheet_versions
      add constraint deal_sheet_versions_revision_exists
      foreign key (record_id, revision_number)
      references public.record_revisions (record_id, revision_number)
      not valid;
  end if;
end $$;

comment on constraint deal_sheet_versions_revision_exists on public.deal_sheet_versions is
  'A version can only name a revision of its own record that exists. Makes the '
  'version-approval `inconsistent` state unreachable by any ordinary mistake, '
  'which is what lets it keep meaning a data fault.';
