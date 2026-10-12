-- Term pricing: retire the single VOLUME_BANDS row. TP_BANDS round, ruling on
-- Phase 0 ("storage, new key and later removal migration ACCEPTED as
-- proposed"; John, 2026-10-12). WRITTEN AT THE ROUND'S CLOSE, NOT APPLIED.
--
-- ── APPLY ONLY AFTER JOHN'S PUSH OF TP_BANDS ─────────────────────────────
--
-- Until TP_BANDS is on main, the code serving the screen reads VOLUME_BANDS
-- (one list for every product) and refuses to load without it:
-- settingsFromRows requires every key in its SETTING_KEYS. Deleting the row
-- first would break every Term Pricing screen until the merge is deployed. From
-- TP_BANDS on, nothing reads it: SETTING_KEYS names VOLUME_BANDS_BY_PRODUCT in
-- its place, and a change naming VOLUME_BANDS is refused as unknown.
--
-- ── WHAT IT DOES ─────────────────────────────────────────────────────────
--
-- 1. Refuses to run unless VOLUME_BANDS_BY_PRODUCT holds a list for each of
--    the three products, so the retired row is never the only bands there are.
-- 2. Deletes the VOLUME_BANDS row.
-- 3. Narrows the key allowlist to the nine keys TP_BANDS reads.
-- 4. Checks itself: nine keys, none of them VOLUME_BANDS.
--
-- AFTER 20261012000001. Idempotent: the delete finds nothing on a replay and
-- the constraint is dropped and re-added with the same name. The constraint
-- name is Postgres's default for the inline check of 20261001000002, and
-- 20261012000001's apply proved it: its drop of that name let the new key in.
-- Does NOT write its own ledger row (Architecture 10, corrected 2026-09-08);
-- record it as a separate statement after applying. Not parse-checked here
-- (CLAUDE.md rule 14).

do $$
begin
  if not exists (
    select 1 from public.term_pricing_settings
    where key = 'VOLUME_BANDS_BY_PRODUCT'
      and jsonb_typeof(value -> 'safesight') = 'array'
      and jsonb_typeof(value -> 'air_quality') = 'array'
      and jsonb_typeof(value -> 'hemir') = 'array'
  ) then
    raise exception 'VOLUME_BANDS_BY_PRODUCT lacks a list for every product; VOLUME_BANDS is not removed.';
  end if;
end $$;

delete from public.term_pricing_settings where key = 'VOLUME_BANDS';

alter table public.term_pricing_settings drop constraint if exists term_pricing_settings_key_check;
alter table public.term_pricing_settings add constraint term_pricing_settings_key_check check (key in (
  'TERMS', 'ANCHOR_TERM', 'ANCHOR_MARGIN', 'SHORT_TERM_MARGIN', 'PROFIT_STEP',
  'VOLUME_BANDS_BY_PRODUCT', 'HW_UPFRONT_MARGIN', 'MARGIN_FLOOR', 'CURRENCY'));

do $$
begin
  if (select count(*) from public.term_pricing_settings) <> 9 then
    raise exception 'term_pricing_settings: expected 9 keys, found %',
      (select count(*) from public.term_pricing_settings);
  end if;
  if exists (select 1 from public.term_pricing_settings where key = 'VOLUME_BANDS') then
    raise exception 'term_pricing_settings: VOLUME_BANDS is still present';
  end if;
end $$;
