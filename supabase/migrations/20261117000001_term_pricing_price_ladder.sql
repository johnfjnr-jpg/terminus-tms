-- Term pricing: THE FORMULA IS REMOVED; every product prices from its price
-- ladder. TP_LADDER, Phase 0 addendum A1 and A2 and the Q1 ruling (John,
-- 2026-11-17). WRITTEN IN PHASE 1. APPLIED BEFORE THE PUSH, on John's ruling
-- (Phase 1 sign-off, 2026-11-17): applied by John, wrapped in begin/commit,
-- with the ledger row recorded by hand as a separate statement, so that Phase 2
-- could be proved from the click on the migrated settings while tp-ladder was
-- the served tree. SUPERSEDED, left visible: "NOT APPLIED. John applies it
-- after his push."
--
-- ── WHAT IT DOES ─────────────────────────────────────────────────────────
--
-- 1. Refuses to run unless TERMS is the ten terms the seed prices.
-- 2. Renames ANCHOR_TERM to COMPARE_TERM, value kept (Q1). COMPARE_TERM derives
--    no price; it only sets the "vs N months" column.
-- 3. Drops ANCHOR_MARGIN, SHORT_TERM_MARGIN and PROFIT_STEP (A1). Nothing
--    reads them once the formula is gone. HW_UPFRONT_MARGIN STAYS: CAPEX's
--    hardware value reads it (src/lib/term-pricing.js, spec 6.1).
-- 4. Seeds PRICE_LADDER_BY_PRODUCT with the three ladders John set (A2), USD
--    per unit per month. Guarded, so a replay never overwrites an admin's
--    later change.
-- 5. Narrows the key allowlist to the seven keys v2.0 reads.
-- 6. Checks itself: seven keys; each product's ladder prices exactly the terms
--    in TERMS; every price a positive amount to the cent; COMPARE_TERM in TERMS.
--
-- The ladder's rules are the engine's validateLadder, which the route runs
-- before writing; the only constraint change is the key allowlist (a second
-- copy of the rules drifts, Verification 20). RLS unchanged: the admin insert
-- and update policies already cover every key.
--
-- ── ORDER AGAINST THE CODE ───────────────────────────────────────────────
--
-- The v1.10 code on main refuses to load without ANCHOR_TERM, ANCHOR_MARGIN,
-- SHORT_TERM_MARGIN and PROFIT_STEP, and the v2.0 code refuses to load without
-- COMPARE_TERM and PRICE_LADDER_BY_PRODUCT (settingsFromRows requires every
-- key). So between John's push and this apply the Term Pricing screen shows
-- SETTINGS_MISSING, and nothing else in TMS reads this table. Apply it straight
-- after the push. (SUPERSEDED: it was applied BEFORE the push, above. While it
-- stood applied and main was not yet pushed, main's v1.10 Term Pricing screen
-- would have read SETTINGS_MISSING had main been served; it was not, because
-- tp-ladder held the one checkout.)
--
-- AFTER 20261012000002. Idempotent: the rename and the deletes find nothing on
-- a replay, the seed is guarded, and the constraint is dropped and re-added
-- with the same name. Does NOT write its own ledger row (Architecture 10,
-- corrected 2026-09-08); record it as a separate statement after applying.
-- Not parse-checked here (CLAUDE.md rule 14). Rollback:
-- supabase/rollbacks/20261117000001_term_pricing_price_ladder.rollback.sql.

do $$
declare v_terms jsonb;
begin
  select value into v_terms from public.term_pricing_settings where key = 'TERMS';
  if v_terms is distinct from '[12, 24, 36, 48, 60, 72, 84, 96, 108, 120]'::jsonb then
    raise exception 'TERMS is not the ten terms the seed prices (found %); stop and rule on the seed.', v_terms;
  end if;
end $$;

alter table public.term_pricing_settings drop constraint if exists term_pricing_settings_key_check;

-- Q1: the rename, value kept. Only when COMPARE_TERM is not there yet.
update public.term_pricing_settings set key = 'COMPARE_TERM'
where key = 'ANCHOR_TERM'
  and not exists (select 1 from public.term_pricing_settings where key = 'COMPARE_TERM');
delete from public.term_pricing_settings where key = 'ANCHOR_TERM';

-- A1: the formula's own settings.
delete from public.term_pricing_settings where key in ('ANCHOR_MARGIN', 'SHORT_TERM_MARGIN', 'PROFIT_STEP');

-- A2: the three price ladders, USD per unit per month.
insert into public.term_pricing_settings (key, value)
select 'PRICE_LADDER_BY_PRODUCT', '{
  "safesight": {
    "12": "2500.00", "24": "1500.00", "36": "1080.00", "48": "875.00", "60": "750.00",
    "72": "665.00", "84": "605.00", "96": "560.00", "108": "525.00", "120": "500.00"
  },
  "air_quality": {
    "12": "1000.00", "24": "600.00", "36": "432.00", "48": "350.00", "60": "300.00",
    "72": "266.00", "84": "242.00", "96": "224.00", "108": "210.00", "120": "200.00"
  },
  "hemir": {
    "12": "15000.00", "24": "9000.00", "36": "6480.00", "48": "5250.00", "60": "4500.00",
    "72": "3990.00", "84": "3630.00", "96": "3360.00", "108": "3150.00", "120": "3000.00"
  }
}'::jsonb
where not exists (select 1 from public.term_pricing_settings where key = 'PRICE_LADDER_BY_PRODUCT');

alter table public.term_pricing_settings add constraint term_pricing_settings_key_check check (key in (
  'TERMS', 'COMPARE_TERM', 'PRICE_LADDER_BY_PRODUCT',
  'VOLUME_BANDS_BY_PRODUCT', 'HW_UPFRONT_MARGIN', 'MARGIN_FLOOR', 'CURRENCY'));

-- Self-check. Shape, not the literal, so a replay after an admin's change passes.
do $$
declare
  v_terms jsonb;
  v_ladders jsonb;
  v_product text;
  v_ladder jsonb;
begin
  if (select count(*) from public.term_pricing_settings) <> 7 then
    raise exception 'term_pricing_settings: expected 7 keys, found %', (select count(*) from public.term_pricing_settings);
  end if;
  if exists (select 1 from public.term_pricing_settings where key in ('ANCHOR_TERM', 'ANCHOR_MARGIN', 'SHORT_TERM_MARGIN', 'PROFIT_STEP')) then
    raise exception 'term_pricing_settings: a formula key is still present';
  end if;
  select value into v_terms from public.term_pricing_settings where key = 'TERMS';
  if not exists (
    select 1 from public.term_pricing_settings c
    where c.key = 'COMPARE_TERM' and exists (select 1 from jsonb_array_elements(v_terms) t(term) where t.term = c.value)
  ) then
    raise exception 'COMPARE_TERM is missing or not one of TERMS';
  end if;
  select value into v_ladders from public.term_pricing_settings where key = 'PRICE_LADDER_BY_PRODUCT';
  foreach v_product in array array['safesight', 'air_quality', 'hemir'] loop
    v_ladder := v_ladders -> v_product;
    if v_ladder is null or jsonb_typeof(v_ladder) <> 'object' then
      raise exception 'PRICE_LADDER_BY_PRODUCT has no % ladder', v_product;
    end if;
    if exists (select 1 from jsonb_array_elements_text(v_terms) t(term) where not (v_ladder ? t.term)) then
      raise exception 'the % ladder lacks a price for a term in TERMS', v_product;
    end if;
    if (select count(*) from jsonb_object_keys(v_ladder)) <> jsonb_array_length(v_terms) then
      raise exception 'the % ladder prices a term not in TERMS', v_product;
    end if;
    if exists (
      select 1 from jsonb_each_text(v_ladder) e(term, price)
      where price !~ '^[0-9]+(\.[0-9]{1,2})?$' or price::numeric <= 0
    ) then
      raise exception 'the % ladder holds a price that is not a positive amount to the cent', v_product;
    end if;
  end loop;
end $$;
