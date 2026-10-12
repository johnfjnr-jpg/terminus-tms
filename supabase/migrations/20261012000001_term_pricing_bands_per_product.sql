-- Term pricing: volume discount bands PER PRODUCT. TP_BANDS round, rulings B-1
-- to B-3 and B-8 (John, 2026-10-12). WRITTEN IN PHASE 0, NOT APPLIED: John
-- applies it in the SQL editor after review.
--
-- ── WHY A NEW KEY, NOT A NEW SHAPE FOR VOLUME_BANDS ──────────────────────
--
-- The brief's order is "migration applied by John -> ... -> merge". Between the
-- apply and the merge, the code serving the screen is origin/main, which reads
-- VOLUME_BANDS as ONE ARRAY: the engine's normaliseParams calls `.map` on it and
-- the settings card calls `.forEach`. Reshaping that row in place would break
-- every Term Pricing screen from the apply until the merge. A new key is
-- additive: the old code never reads it, and the new code never reads the old
-- key.
--
-- VOLUME_BANDS is LEFT IN PLACE here and is not read once TP_BANDS merges.
-- Removing it is a second migration, written at the round's close, to apply
-- after John's push (a row the deployed code still reads must not be deleted
-- first).
--
-- ── THE SHAPE ────────────────────────────────────────────────────────────
--
--   { "<product>": [ { "from": 1, "discountPct": "0" }, ... ], ... }
--
-- One ordered list per catalog product, keyed as ANCHOR_MARGIN is. `from` is
-- the band's start (a JSON number, a whole count of units), the same name the
-- engine and VOLUME_BANDS already use; "To" is derived and never stored (B-3).
-- `discountPct` is a decimal STRING, as every decimal in this table is.
--
-- ── RULES: THE ROUTE AND THE ENGINE, NOT SQL ─────────────────────────────
--
-- B-3, B-4 and B-2 (band 1 at 1, ascending whole starts, discounts never
-- falling, below 100% to one decimal, 2 to 6 bands) are enforced by the
-- engine's validator, which the route runs before writing (B-6: the server is
-- the authority). They are NOT restated as a CHECK here: a second copy of the
-- rules in SQL is a second reader that will drift (Verification 20). The only
-- constraint change is the key allowlist.
--
-- ── APPLY ────────────────────────────────────────────────────────────────
--
-- AFTER 20261001000002. Idempotent: the constraint is dropped and re-added
-- with the same name, and the seed is a guarded insert. Does NOT write its own
-- ledger row (Architecture 10, corrected 2026-09-08). Not parse-checked here
-- (CLAUDE.md rule 14).

-- STOP rather than seed over a change: B-1 seeds every product with today's
-- bands, and the seed below is those bands written out. If an admin has changed
-- VOLUME_BANDS since, the literal would quietly discard that change.
do $$
begin
  if exists (select 1 from public.term_pricing_settings where key = 'VOLUME_BANDS')
     and (select value from public.term_pricing_settings where key = 'VOLUME_BANDS') <>
         '[{"from": 1, "discountPct": "0"}, {"from": 10, "discountPct": "5"}, {"from": 50, "discountPct": "10"}, {"from": 200, "discountPct": "15"}]'::jsonb
  then
    raise exception 'VOLUME_BANDS is not the B-1 seed; it was changed by an admin. Stop and rule on which bands to seed.';
  end if;
end $$;

alter table public.term_pricing_settings drop constraint if exists term_pricing_settings_key_check;
alter table public.term_pricing_settings add constraint term_pricing_settings_key_check check (key in (
  'TERMS', 'ANCHOR_TERM', 'ANCHOR_MARGIN', 'SHORT_TERM_MARGIN', 'PROFIT_STEP',
  'VOLUME_BANDS', 'VOLUME_BANDS_BY_PRODUCT', 'HW_UPFRONT_MARGIN', 'MARGIN_FLOOR', 'CURRENCY'));

-- B-1: every product starts on today's bands. Guarded, so a replay never
-- overwrites an admin's later change.
insert into public.term_pricing_settings (key, value)
select 'VOLUME_BANDS_BY_PRODUCT', '{
  "safesight":   [{"from": 1, "discountPct": "0"}, {"from": 10, "discountPct": "5"}, {"from": 50, "discountPct": "10"}, {"from": 200, "discountPct": "15"}],
  "air_quality": [{"from": 1, "discountPct": "0"}, {"from": 10, "discountPct": "5"}, {"from": 50, "discountPct": "10"}, {"from": 200, "discountPct": "15"}],
  "hemir":       [{"from": 1, "discountPct": "0"}, {"from": 10, "discountPct": "5"}, {"from": 50, "discountPct": "10"}, {"from": 200, "discountPct": "15"}]
}'::jsonb
where not exists (select 1 from public.term_pricing_settings where key = 'VOLUME_BANDS_BY_PRODUCT');

-- Self-check: ten keys, and the new one holds a list for each of the three
-- products the catalog prices today.
do $$
begin
  if (select count(*) from public.term_pricing_settings) <> 10 then
    raise exception 'term_pricing_settings: expected 10 keys, found %',
      (select count(*) from public.term_pricing_settings);
  end if;
  if not exists (
    select 1 from public.term_pricing_settings
    where key = 'VOLUME_BANDS_BY_PRODUCT'
      and jsonb_typeof(value -> 'safesight') = 'array'
      and jsonb_typeof(value -> 'air_quality') = 'array'
      and jsonb_typeof(value -> 'hemir') = 'array'
  ) then
    raise exception 'term_pricing_settings: VOLUME_BANDS_BY_PRODUCT lacks a list for every product';
  end if;
end $$;
