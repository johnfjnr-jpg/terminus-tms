-- ROLLBACK for supabase/migrations/20261120000001_term_quotes_versions_carry_a_kind.sql.
-- NOT A MIGRATION: outside supabase/migrations so the CLI never applies it. Run
-- by hand only, wrapped in begin/commit, together with a revert of the
-- TERM_QUOTES code, because the version route writes kind and every reader
-- branches on it. Not parse-checked (CLAUDE.md build discipline 14).
--
-- IT REFUSES IF ANY term_quote VERSION EXISTS. Dropping the column would leave
-- such a row looking like a Commercials version, with no rates.rates for
-- calculateDeal to price from: every reader would misprice it and nothing would
-- say so. Decide what happens to those rows first, then run this.
--
-- STEP 0, IN THE SAME TRANSACTION, BEFORE THIS FILE: re-run two definitions
-- from the repository, which this rollback does not copy so there is ONE
-- source for each (a copy here would be a second one to drift). Neither
-- references kind, so both are safe while the column still exists:
--   supabase/migrations/20261117000002_versions_freeze_their_figures.sql
--     only `create or replace function public.deal_sheet_versions_immutable()`
--   supabase/migrations/20260829000002_atomic_version_insert.sql
--     only `create or replace function public.insert_deal_sheet_version(...)`
--     and its `comment on function` (not the revision_required block)

do $$
begin
  if exists (select 1 from public.deal_sheet_versions where kind = 'term_quote') then
    raise exception 'rollback refused: % term_quote version(s) exist; dropping kind would relabel them Commercials',
      (select count(*) from public.deal_sheet_versions where kind = 'term_quote');
  end if;
end $$;

-- 5. The Closed Won trigger.
drop trigger if exists deal_sheet_versions_closed_won_trg on public.deal_sheet_versions;
drop function if exists public.deal_sheet_versions_closed_won();

-- 4. The insert function: the ten-argument form goes. The nine-argument one
-- was restored in step 0, so for the length of this transaction both exist,
-- which no caller can observe.
drop function if exists public.insert_deal_sheet_version(uuid, integer, text, jsonb, jsonb, jsonb, uuid, uuid, text, text);

-- 3. The immutability guard was restored in step 0.

-- 2. The cost basis, as 20260829000007 left it.
alter table public.deal_sheet_versions drop constraint if exists deal_sheet_versions_rates_have_cost_basis;
alter table public.deal_sheet_versions add constraint deal_sheet_versions_rates_have_cost_basis
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

-- 1. The kind. Must come AFTER 2 and 3, which reference it.
alter table public.deal_sheet_versions drop constraint if exists deal_sheet_versions_kind_known;
alter table public.deal_sheet_versions drop column if exists kind;

-- Then the ledger row, by hand, as a separate statement:
--   delete from supabase_migrations.schema_migrations where version = '20261120000001';
