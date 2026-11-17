-- ROLLBACK for supabase/migrations/20261117000001_term_pricing_price_ladder.sql.
-- TP_LADDER A2 (John, 2026-11-17): "Its rollback restores them with the values
-- read live in Phase 0." NOT A MIGRATION: it lives outside supabase/migrations
-- so the CLI never applies it. Run by hand only, and only together with a
-- revert of the v2.0 code, because the v2.0 code refuses to load without
-- COMPARE_TERM and PRICE_LADDER_BY_PRODUCT.
--
-- The values restored are the live rows read on 2026-11-16 (Phase 0, P2) and
-- read again on 2026-11-17 before the batch (scripts' read, Phase 1):
--   ANCHOR_TERM 36 (COMPARE_TERM's value, renamed back)
--   ANCHOR_MARGIN and SHORT_TERM_MARGIN {"hemir":"90","safesight":"90","air_quality":"90"}
--   PROFIT_STEP "0.00"
-- The constraint is widened FIRST, or the restored keys would be refused. Not
-- parse-checked here (CLAUDE.md rule 14). The ledger row, if one was recorded,
-- is removed by hand as a separate statement.

alter table public.term_pricing_settings drop constraint if exists term_pricing_settings_key_check;
alter table public.term_pricing_settings add constraint term_pricing_settings_key_check check (key in (
  'TERMS', 'ANCHOR_TERM', 'ANCHOR_MARGIN', 'SHORT_TERM_MARGIN', 'PROFIT_STEP',
  'VOLUME_BANDS_BY_PRODUCT', 'HW_UPFRONT_MARGIN', 'MARGIN_FLOOR', 'CURRENCY',
  -- kept only for the moment of the rollback, then narrowed below
  'COMPARE_TERM', 'PRICE_LADDER_BY_PRODUCT'));

update public.term_pricing_settings set key = 'ANCHOR_TERM'
where key = 'COMPARE_TERM'
  and not exists (select 1 from public.term_pricing_settings where key = 'ANCHOR_TERM');
delete from public.term_pricing_settings where key in ('COMPARE_TERM', 'PRICE_LADDER_BY_PRODUCT');

insert into public.term_pricing_settings (key, value)
select v.key, v.value::jsonb from (values
  ('ANCHOR_MARGIN', '{"hemir": "90", "safesight": "90", "air_quality": "90"}'),
  ('SHORT_TERM_MARGIN', '{"hemir": "90", "safesight": "90", "air_quality": "90"}'),
  ('PROFIT_STEP', '"0.00"')
) v(key, value)
where not exists (select 1 from public.term_pricing_settings s where s.key = v.key);

alter table public.term_pricing_settings drop constraint if exists term_pricing_settings_key_check;
alter table public.term_pricing_settings add constraint term_pricing_settings_key_check check (key in (
  'TERMS', 'ANCHOR_TERM', 'ANCHOR_MARGIN', 'SHORT_TERM_MARGIN', 'PROFIT_STEP',
  'VOLUME_BANDS_BY_PRODUCT', 'HW_UPFRONT_MARGIN', 'MARGIN_FLOOR', 'CURRENCY'));

do $$
begin
  if (select count(*) from public.term_pricing_settings) <> 9 then
    raise exception 'term_pricing_settings: expected 9 keys after the rollback, found %', (select count(*) from public.term_pricing_settings);
  end if;
  if not exists (select 1 from public.term_pricing_settings where key = 'ANCHOR_TERM') then
    raise exception 'ANCHOR_TERM was not restored';
  end if;
end $$;
