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
