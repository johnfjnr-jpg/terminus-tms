-- A version must carry a cost basis. Round 40 Phase 1b.
--
-- ── WHAT CHANGED, AND WHAT DID NOT ──────────────────────────────────────────
--
-- 20260829000004 required deal_sheet_versions.inputs to carry at least one of
-- the ten catalog rate keys. That was correct while rates lived in the payload.
--
-- Round 40 Phase 1b took them out: the record now holds the DECISION (this rate
-- was overridden, or it was not) and the version holds the PRICE (it was priced
-- at these rates). A payload therefore carries at most an override, and the old
-- constraint refuses every version taken after the change.
--
-- THE INTENT IS UNCHANGED and is the reason the floor exists at all: a version
-- with no cost basis prices every line at zero and makes the approval page's
-- bridge report the whole deal as a catalog movement. So the check moves to the
-- column that now holds the answer rather than being dropped.
--
-- NOT VALID, per Architecture rule 7 and the same reasoning as the original:
-- it binds new rows without a backfill. Existing rows pass anyway, because the
-- previous route wrote { rates: <catalog>, batches, missing, as_of } into this
-- same column, but the guarantee is that no NEW version can be born without one.
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'deal_sheet_versions_has_cost_basis'
  ) then
    alter table public.deal_sheet_versions
      drop constraint deal_sheet_versions_has_cost_basis;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'deal_sheet_versions_rates_have_cost_basis'
  ) then
    alter table public.deal_sheet_versions
      add constraint deal_sheet_versions_rates_have_cost_basis
      check (
        rates is not null
        and jsonb_typeof(rates -> 'rates') = 'object'
        and (rates -> 'rates') ?| array[
          'ssUnitCost', 'aqUnitCost', 'hemirUnitCost',
          'inSsExisting', 'inSsNew', 'inAqm', 'inHemir',
          'hoSafesight', 'hoAqm', 'hoHemir'
        ]
      )
      not valid;
  end if;
end $$;

-- ── THE LEDGER ROW, IN THE SAME FILE ────────────────────────────────────────
--
-- Set by the business 2026-08-29, Round 40, after this migration produced the
-- exact drift we had spent the hour discussing.
--
-- Applying SQL through the Supabase dashboard does not write a ledger row, so
-- by-hand application leaves the schema and supabase_migrations.schema_migrations
-- disagreeing. The reconciliation run the same day found 97 of 98 in sync and
-- this file as the only mismatch: the drift arrived while we were reading about
-- it, which is the argument for fixing it structurally rather than by care.
--
-- ONE PASTE, TWO STATEMENTS. A step that depends on somebody remembering is the
-- step that gets missed by the person who just wrote the rule about it, and this
-- session has now produced six instances of that.
--
-- Safe under BOTH paths, which is what lets it live in the file rather than in
-- a covering note: applied by hand, this records what the dashboard will not;
-- applied by `supabase db push`, the CLI writes the row itself and the ON
-- CONFLICT makes this a no-op. Same reasoning as Architecture rule 7.
insert into supabase_migrations.schema_migrations (version)
values ('20260829000007')
on conflict (version) do nothing;
