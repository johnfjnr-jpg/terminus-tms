-- Terminus TMS: a version cannot be created without a cost basis. Round 38.
--
-- ─────────────────────────────────────────────────────────────
-- THE ASYMMETRY THIS DEPENDS ON, STATED HERE BECAUSE IT IS NOT OBVIOUS
-- ─────────────────────────────────────────────────────────────
--
--   The record holds what the deal decided.
--   The catalog holds what things cost.
--   A version holds both, frozen.
--
-- PATCH /opportunities/:id refuses the ten catalog rate keys, so a record never
-- stores a rate. A version does, because readPayload() writes the resolved
-- catalog into `inputs`. That is policy rather than artefact: a live deal sheet
-- SHOULD price at today's costs, and an approved version SHOULD price at the
-- costs it was approved against.
--
-- A version's self-sufficiency is a consequence of that, not a coincidence:
-- inputs carries the decision and the costs together, so buildDealInputs(inputs)
-- reproduces exactly what was signed.
--
-- ─────────────────────────────────────────────────────────────
-- WHAT WAS STILL CREATABLE
-- ─────────────────────────────────────────────────────────────
--
-- A version whose inputs carry NO rate keys prices every line at zero. Measured
-- while building the approval page: the bridge reported the entire value of the
-- deal, $1.7m of contract net, as though the catalog had moved. It had not; the
-- baseline had no catalog in it.
--
-- The page detects that and refuses the comparison, which is right and is not
-- enough. `inconsistent` was made unreachable by a constraint rather than by
-- care, and the same test applies here: any caller could POST inputs without
-- rates, so non-comparable versions were creatable by ordinary mistake and the
-- caveat path would have been a permanent feature rather than a legacy
-- accommodation.
--
-- NAMED DEBT IS FINE. CREATABLE DEBT IS NOT.
--
-- AT LEAST ONE RATE KEY, NOT ALL TEN, and the reason is that all ten is wrong.
-- catalogToRates emits keys only for products that HAVE a current batch
-- (PRODUCT_RATE_KEYS: unit cost and hosting always, install keys per product),
-- so a genuinely missing batch legitimately produces fewer. Requiring all ten
-- would refuse a version the business can and should still take, and the
-- approval page already reports a missing batch as an absent cost rather than a
-- free product.
--
-- The route enforces the exact rule, because only the route knows which products
-- resolved: every key the catalog produced must be present in inputs. This
-- constraint is the floor beneath it, and the floor is what makes the
-- non-comparable case uncreatable rather than merely discouraged.
--
-- NOT VALID: the one version taken before any of this carries no rates and is
-- `issued`, which the immutability trigger refuses to alter. It stays the only
-- one, which is exactly the point.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'deal_sheet_versions_has_cost_basis'
  ) then
    alter table public.deal_sheet_versions
      add constraint deal_sheet_versions_has_cost_basis
      check (inputs ?| array[
        'ssUnitCost', 'aqUnitCost', 'hemirUnitCost',
        'inSsExisting', 'inSsNew', 'inAqm', 'inHemir',
        'hoSafesight', 'hoAqm', 'hoHemir'
      ])
      not valid;
  end if;
end $$;

comment on constraint deal_sheet_versions_has_cost_basis on public.deal_sheet_versions is
  'A version carries the costs it was priced at, or it is not reproducible and '
  'cannot be compared against. At least one catalog rate key must be present; '
  'the route requires every key the catalog actually resolved.';
