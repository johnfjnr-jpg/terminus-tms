-- Terminus TMS: bid and proposal currency become initial values. Round 41 W3.
--
-- ─────────────────────────────────────────────────────────────
-- THE FINDING THIS CLOSES
-- ─────────────────────────────────────────────────────────────
--
-- An opportunity created on the walk carried no currency at all. Revision 1 held
-- six keys and neither currency was among them, so the person had to choose the
-- bid currency by hand and never chose a proposal currency, which then recorded
-- as an explicit null.
--
-- `eaec36a` removed the read-time fallback `p.bidCurrency || 'USD'`, correctly:
-- it was prefilling a currency nobody chose and the next save recorded it. The
-- same commit wrote a comment saying "USD is written at CREATION for new
-- records" AND DID NOT ADD THAT WRITE. Architecture 9's fourth variant with the
-- sharpest provenance available: a plan recorded in the same voice as a fact, in
-- the commit that created the need for it.
--
-- ─────────────────────────────────────────────────────────────
-- WHY THIS IS MORE THAN TWO INSERTS, WHICH THE RULING DID NOT ANTICIPATE
-- ─────────────────────────────────────────────────────────────
--
-- `system_defaults.value` is `numeric not null`. THE TABLE CANNOT HOLD 'USD' AT
-- ALL, and `readSystemDefaults` discards anything `Number()` cannot make finite,
-- so even a coerced value would be dropped on the way out. The defaults
-- mechanism was built for numbers and every key it has ever held is one.
--
-- Reported to the business rather than worked around, because widening a column
-- is not what "add two rows" authorises.
--
-- TEXT, NOT JSONB, AND NOT A SECOND COLUMN.
--
--   A second `text_value` column would be two columns of which one is always
--   null, and two places to look for one value. Verification 20 by construction.
--
--   jsonb types the value properly and changes every consumer, for a table of
--   seven rows whose values are a number or a currency code.
--
--   `text` holds '36' and 'USD' alike. `Number('36')` is 36, so every existing
--   consumer keeps the number it already got, and the reader decides per row.
--   The one line that changes is the coercion in readSystemDefaults, which now
--   keeps a non-numeric value instead of dropping it.
--
-- NOT NULL IS KEPT. An absent default is an absent ROW, which initialPayload
-- already handles by writing nothing for that key. A null value would be a
-- third state meaning the same thing.
--
-- ─────────────────────────────────────────────────────────────
-- NO BACKFILL
-- ─────────────────────────────────────────────────────────────
--
-- Architecture 11: a default does not reach records created before it. Three
-- live opportunities carry no currency and one carries a recorded null; all four
-- stay as they are. Changing them would be this migration deciding what somebody
-- else's deal is priced in.

-- ---------------------------------------------------------------------------
-- 1. The value column widens to text
-- ---------------------------------------------------------------------------
--
-- Guarded on the current type rather than run unconditionally: `alter column
-- type` rewrites the table every time it runs, and a migration that has already
-- been applied should cost nothing to replay. Architecture 7.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'system_defaults'
      and column_name = 'value' and data_type = 'numeric'
  ) then
    alter table public.system_defaults
      alter column value type text using value::text;
  end if;
end $$;

comment on column public.system_defaults.value is
  'Text, so a default may be a number (''36'') or a currency code (''USD''). '
  'readSystemDefaults coerces to a number when Number() gives a finite one and '
  'keeps the string otherwise.';

-- ---------------------------------------------------------------------------
-- 2. The two currency defaults
-- ---------------------------------------------------------------------------
insert into public.system_defaults (key, value, note)
select v.key, v.value, v.note
from (values
  ('bidCurrency', 'USD',
   'Currency the bid is stated in. Written at creation; a person may change it.'),
  ('proposalCurrency', 'USD',
   'Currency the proposal is issued in. Written at creation; a person may change it.')
) as v(key, value, note)
where not exists (
  select 1 from public.system_defaults d where d.key = v.key
);

-- Architecture 10: the ledger row, in the same paste.
insert into supabase_migrations.schema_migrations (version)
values ('20260831000007')
on conflict (version) do nothing;
