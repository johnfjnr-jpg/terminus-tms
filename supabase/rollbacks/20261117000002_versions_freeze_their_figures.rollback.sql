-- ROLLBACK for supabase/migrations/20261117000002_versions_freeze_their_figures.sql.
-- NOT A MIGRATION: outside supabase/migrations so the CLI never applies it. Run
-- by hand only, together with a revert of the FROZEN_FIGURES code, because the
-- issue route writes frozen_figures and the approval page reads it.
--
-- The column is DROPPED, which destroys every frozen snapshot taken since the
-- apply: the figures approvers signed would be gone and could not be recomputed
-- as they were. Decide that before running it. Not parse-checked (rule 14).

drop trigger if exists deal_sheet_versions_born_draft_trg on public.deal_sheet_versions;
drop function if exists public.deal_sheet_versions_born_draft();

-- The immutability trigger and the raise as they stood before (20260829000001
-- and 20260908000002): restore them by re-running those definitions from the
-- repository at 488f779, which this file does not copy, so there is ONE
-- source for each (a copy here would be a second one to drift).
--   git show 488f779:supabase/migrations/20260829000001_version_carries_its_revision.sql
--   git show 488f779:supabase/migrations/20260908000002_writes_are_owner_scoped.sql
-- Run only the `create or replace function` statements for
-- deal_sheet_versions_immutable and raise_transition_request from those files.

alter table public.deal_sheet_versions drop constraint if exists deal_sheet_versions_figures_only_when_issued;
alter table public.deal_sheet_versions drop column if exists frozen_figures;
