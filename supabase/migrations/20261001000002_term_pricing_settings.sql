-- Term pricing settings: the spec section 3 parameters, as data. TERM_PRICING
-- round, rulings R-TP3 and R-TP6 (John, 2026-10-01).
--
-- docs/pricing-spec.md v1.2.2 section 3, and CLAUDE.md Architecture rule 14:
-- no hard-coded parameters. HW_COST and HOSTING_MONTHLY are NOT here: they are
-- read from base_cost_batches, the TMS catalog (R-TP3).
--
-- NOT system_defaults. That table is initial values written into deals
-- (Architecture 11) and the deal sheet reads it; R-TP5 says nothing there
-- changes.
--
-- ── VALUES ARE JSONB, AND EVERY DECIMAL IS A JSON STRING ─────────────────
--
-- "90", "0.00", never 90 or 0.9. The engine accepts decimals only as strings
-- (R-TP2), so a float cannot exist in this table, in transit, or in the
-- engine. Integers that are not money (terms, band starts) are JSON numbers.
--
-- ── WHO MAY WRITE: ADMIN ONLY, ENFORCED TWICE (R-TP6) ────────────────────
--
-- The route answers 403 to a non-admin. These policies are the second line:
-- insert and update require the caller's own system_roles admin row, and
-- `updated_by` must be the caller, so the attribution cannot be claimed for
-- somebody else (Architecture 12's reasoning, applied to a policy). No delete
-- policy: a parameter is changed, never removed.
--
-- An RLS refusal of an UPDATE returns success with zero rows (Verification 8),
-- which is why the route checks the role itself and counts the rows it wrote.
--
-- ── APPLY ────────────────────────────────────────────────────────────────
--
-- AFTER 20261001000001. Does NOT write its own ledger row (Architecture 10).
-- Not parse-checked here (CLAUDE.md rule 14).

create table if not exists public.term_pricing_settings (
  key         text primary key check (key in (
                'TERMS', 'ANCHOR_TERM', 'ANCHOR_MARGIN', 'SHORT_TERM_MARGIN', 'PROFIT_STEP',
                'VOLUME_BANDS', 'HW_UPFRONT_MARGIN', 'MARGIN_FLOOR', 'CURRENCY')),
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id)
);

comment on table public.term_pricing_settings is
  'docs/pricing-spec.md section 3 parameters for the term pricing calculator. '
  'Decimals are JSON strings. Admin-only writes (system_roles). Costs are read '
  'from base_cost_batches, not stored here.';

alter table public.term_pricing_settings enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
      and tablename = 'term_pricing_settings' and policyname = 'term_pricing_settings_select') then
    create policy term_pricing_settings_select on public.term_pricing_settings
      for select to authenticated using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public'
      and tablename = 'term_pricing_settings' and policyname = 'term_pricing_settings_insert_admin') then
    create policy term_pricing_settings_insert_admin on public.term_pricing_settings
      for insert to authenticated
      with check (
        updated_by = auth.uid()
        and exists (select 1 from public.system_roles r where r.user_id = auth.uid() and r.role = 'admin')
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public'
      and tablename = 'term_pricing_settings' and policyname = 'term_pricing_settings_update_admin') then
    create policy term_pricing_settings_update_admin on public.term_pricing_settings
      for update to authenticated
      using (exists (select 1 from public.system_roles r where r.user_id = auth.uid() and r.role = 'admin'))
      with check (
        updated_by = auth.uid()
        and exists (select 1 from public.system_roles r where r.user_id = auth.uid() and r.role = 'admin')
      );
  end if;
end $$;

-- Seeded with spec section 3 as written (v1.2.2). One guarded insert per key,
-- so a replay adds nothing and never overwrites an admin's later change.
insert into public.term_pricing_settings (key, value)
select v.key, v.value
from (values
  ('TERMS',             '[12, 24, 36, 48, 60, 72, 84, 96, 120]'::jsonb),
  ('ANCHOR_TERM',       '36'::jsonb),
  ('ANCHOR_MARGIN',     '{"safesight": "90", "air_quality": "90", "hemir": "90"}'::jsonb),
  ('SHORT_TERM_MARGIN', '{"safesight": "90", "air_quality": "90", "hemir": "90"}'::jsonb),
  ('PROFIT_STEP',       '"0.00"'::jsonb),
  ('VOLUME_BANDS',      '[{"from": 1, "discountPct": "0"}, {"from": 10, "discountPct": "5"}, {"from": 50, "discountPct": "10"}, {"from": 200, "discountPct": "15"}]'::jsonb),
  ('HW_UPFRONT_MARGIN', '"20"'::jsonb),
  ('MARGIN_FLOOR',      '"25"'::jsonb),
  ('CURRENCY',          '"USD"'::jsonb)
) as v(key, value)
where not exists (select 1 from public.term_pricing_settings s where s.key = v.key);

-- Self-check: all nine keys present.
do $$
begin
  if (select count(*) from public.term_pricing_settings) <> 9 then
    raise exception 'term_pricing_settings: expected 9 keys, found %',
      (select count(*) from public.term_pricing_settings);
  end if;
end $$;
