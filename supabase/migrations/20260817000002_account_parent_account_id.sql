-- Terminus TMS: Parent Account, a genuinely new, dedicated column
--
-- ROUND4_BUILD_BRIEF.md Phase 3 / Phase 1's own investigation. Confirmed
-- before building, not assumed: parent_record_id already has one
-- established, exclusively-used meaning today (Contact -> Account, 36
-- real rows, zero from any other record_type, confirmed by direct query).
-- Reusing it for Account -> Parent Account would recreate the exact
-- ambiguity Milestone 3 built account_id specifically to avoid the first
-- time (two different relationships sharing one column, distinguishable
-- only by which record_type row you happen to be looking at). Same
-- reasoning, same fix: a real, dedicated, self-referencing FK column.
--
-- Nullable and completely optional, per the brief - only Account Name is
-- required to create an Account, everything else including this is
-- fillable later or never. No NOT NULL, no CHECK forcing every Account to
-- have one, unlike test_bed's own account_id (a hard precondition there,
-- this is the opposite: genuinely optional, single level only for this
-- phase - a parent Account is not itself required to have a parent).
--
-- No DB-level circular-reference constraint (Postgres has no clean way to
-- express "no 2-cycle" as a CHECK constraint referencing another row of
-- the same table at write time without a trigger, and a single FK
-- reference is independently valid either direction of a potential
-- cycle - A.parent=B and B.parent=A are each individually fine
-- constraints, the problem only exists as a pair). The direct A<->B guard
-- is enforced at the application layer instead (src/routes/accounts.js),
-- same layer that already enforces "must be a real, non-deleted Account"
-- for this same field, matching this project's existing convention of
-- keeping business-rule guards in route code alongside the other checks
-- for the same write, not split across a mix of DB triggers and app code.
alter table public.records
  add column if not exists parent_account_id uuid references public.records(id);

create index if not exists records_parent_account_id_idx on public.records(parent_account_id);

comment on column public.records.parent_account_id is
  'Account -> parent Account, self-referencing, single level only for '
  'now (a parent is not itself required to have a parent). Deliberately '
  'NOT parent_record_id, which already means Contact -> Account '
  'exclusively (Round 4 Phase 1 investigation, 36 real Contact rows, '
  'zero from any other record_type). Only meaningful when the row''s own '
  'record_type is account, not enforced by a CHECK - validated at the '
  'application layer instead (must reference a real, non-deleted account '
  'record, and must not create a direct two-record cycle), same layer '
  'already responsible for the equivalent account_id validation on '
  'test_bed/opportunity.';
