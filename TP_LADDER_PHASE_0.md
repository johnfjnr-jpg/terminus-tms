# TP_LADDER: Phase 0 report (investigate, no build)

**Branch `tp-ladder`, from main at `a5b8e80`.** ls-remote origin main read `a5b8e80b592511e173e2243e67fc801e2a4a86a6`, and `b5f2b7c` is its ancestor (`git merge-base --is-ancestor`, exit 0). Your ruling 3 holds, so the round runs from that commit.

| commit | what | hook |
|---|---|---|
| `ebc89b3` | brief verbatim, with the precondition ruling appended | pure PASS 5.0s, typecheck PASS; react and database NOT RUN (M1, markdown only) |
| this commit | this report | M1 again |

**Nothing is built, applied or pushed.** No engine, route, screen or test file changed. No live setting was written; every live read below used the service key, read only. The draft migration is in this report only (P10), and no file was written to `supabase/migrations`.

**Ruling 4's report edit is done:** the stop report's last question was reworded and recopied (OneDrive copy compared identical).

## Decisions needed before the build (each detailed under P11)

1. **L-7 on the formula: 74 warnings appear on products nobody changed.** Recommend the two new checks apply only where the term is ladder priced.
2. **"Calculated" (L-6) must stop reading termLadder,** which supersedes M-8's basis. Recommend the formula fee at one camera, read directly.
3. **No way to remove a product's ladder.** Recommend no removal route this round, said in the spec.
4. **The added output fields fail FA-8 by design.** Recommend extending its allowlist; it then proves L-10 too.
5. **L-8's fallback is about three times its neighbours.** The fallback works as ruled; this is said so it is a known outcome rather than a surprise.

## P1. Where the list fee is taken today, and where the ladder goes

**One site.** `src/lib/term-pricing.js`:
- `priceAt(p, product, T)` at line 319 is the section 4.1 formula;
- `listFeeAt = (p, product, T) => div(priceAt(...), fromInt(T))` at line 327 is the only path from the formula to a fee.

**Every reader of the fee goes through `listFeeAt`:**

| caller | line | what it reads |
|---|---|---|
| `unitEconomics` | 349, 356 | the fee at T, and at the anchor (saving) |
| `quoteCore` (`priceQuote`, `capexAllocation`) | 681, 714 | each line's fee, and its saving at the anchor |
| `termLadder` | via `priceQuote` | every term |
| `manualLadder` "Calculated" | via `termLadder` (line 1410) | every term at one camera |
| `bandMarginGrid` | via `unitEconomics` | every band at every term |

`bandFeeCents` (line 331) then applies the band discount and rounds half-up to cents. That is L-2 exactly, unchanged.

**The proposal, with R-TP1 intact (the engine imports nothing):**
- the ladder arrives in params as `PRICE_LADDER_BY_PRODUCT`;
- `normaliseParams` turns it into `p.priceLadder[product][T]`, an exact fraction, with `{}` when the key is absent;
- `listFeeAt` returns the ladder price when one exists for (product, T), otherwise the formula;
- a sibling `priceSourceAt` returns `'ladder'`, `'formula'`, or `'formula-fallback'` (the product has a ladder but no price at T, L-8);
- a formula-only reader serves L-6's "Calculated".

The isolation test (`term-pricing-isolation.test.mjs`) needs no change, because no import is added.

**Factoring, CAPEX and costs need no change, read but not tested.** `factoringPlan` and `vendorPlan` take the hardware cost, the CAPEX default takes the hardware value, and `costAt` is HW plus hosting times T. None reads the fee. The CAPEX subscription and CPI run off the band fees, which is the brief's intent. The build's tests will measure this rather than rely on the reading.

## P2. The settings loader with the key absent, and with an unknown key present

`src/lib/term-pricing-settings.js`:
- **`settingsFromRows`** requires every key in `SETTING_KEYS` and throws `SETTINGS_MISSING` otherwise. **So `PRICE_LADDER_BY_PRODUCT` must NOT join that required list.** It is an optional key, read as `{}` when absent. That is what makes L-10 hold, and it is a departure from the bands pattern that L-4 names. Bands are required for every product; a ladder is optional for every product.
- **An unknown row present** (for example, the migration applied before this code is pushed) is carried into `settings` and dropped by `buildParams`, which names its keys. The screen's settings card (`draftFrom`, `changesFrom`) also reads named keys only. A `PUT /settings` naming an unknown key is refused (`unknown setting`). **So the migration and the code can land in either order.**

**Live, read today:**
- 9 keys;
- `TERMS` `[12,24,36,48,60,72,84,96,108,120]`, `ANCHOR_TERM` 36;
- `ANCHOR_MARGIN` and `SHORT_TERM_MARGIN` 90 for all three products, `PROFIT_STEP` 0.00, floor 25, USD;
- every product on the seed bands;
- catalog SafeSight 8,000.00 and 200.00, the spec costs.

## P3. The VOLUME_BANDS_BY_PRODUCT pattern, and the proposal for the ladder

**How bands work today:**

| part | today's bands | proposed ladder |
|---|---|---|
| storage | one jsonb row, `{ product: [{ from, discountPct }] }`, decimals as strings | one jsonb row, `{ product: { "12": "2500.00", ... } }`: keyed by term, prices as decimal strings (this table's convention) |
| required | every catalog product (`PER_PRODUCT_KEYS`) | **optional per product**; only SafeSight is seeded |
| validator | `validateBands` in the engine, shared by editor and server, sentences per problem (TB-6) | `validateLadder(prices, terms)` in the engine, shared the same way (L-5) |
| merge | `mergeBandsChange(current, product, bands, costs)` | `mergeLadderChange(current, product, prices, costs)`: product must be a catalog product |
| route | `PUT /api/term-pricing/bands/:product`: `readState`, 403 unless admin, 400 with `problems`, `writeKeys`, re-read | `PUT /api/term-pricing/ladder/:product`, the same shape, body `{ prices }`. Reads `system_roles` through the caller's client and never writes it |
| RLS | admin insert and update policies on the table | inherited unchanged; no policy change |
| screen | `BandEditor` in the Settings card: product picker, per-product drafts, live margin grid, refusal list | a ladder editor alongside it, **placed only by the mockup** (L-13) |

**L-5 positions, revisitable:**
- refused on save: every term in TERMS has a price; each price is above 0 with at most 2 decimals; **a price for a term NOT in TERMS is refused** (L-5 is silent on this; a stray term is a typo);
- warnings only: the floor, client total and profit checks at every band of that product, from the same grid as L-7, on the prices as typed;
- `PUT /settings` refuses `PRICE_LADDER_BY_PRODUCT`, so the key has one write path.

## P4. What prices SafeSight by the formula, and what it reads

**Wired, in the pure suite, all from frozen fixtures and never live settings:**
- `term-pricing.test.mjs`: the T-series and per-product tests, `SPEC_PARAMS` with no ladder key;
- `term-factoring-parity.test.mjs`;
- `term-pricing-settings.test.mjs`;
- `term-pricing-route.test.mjs`: a recording database, ruling 0.1;
- `term-pricing-isolation.test.mjs`.

L-10 keeps every one unchanged by construction.

**G1 to G5 do not touch this engine.** Their 4,734 figures are the Commercials `deal-calculator`, and no Commercials or approval file imports `term-pricing.js`. Its only importer is `TermPricingView.tsx`.

**FA-8 WILL FIRE, by design, and this must be said before the build** (decision 4). It compares every captured output field by field, and allows only the factoring fields to be added. Adding `priceSource` to quote lines, unit economics and ladder rows fails it, as it should.
- Recommendation: extend `ALLOWED` with the source fields and assert their "absent ladder" value (`'formula'`). FA-8 then becomes the L-10 proof as well: with no ladder, every captured figure is identical.

**Unwired browser probes read LIVE settings,** and they go stale the moment the migration is applied:

| probe | formula-shaped assertions |
|---|---|
| `probe-screen.mjs` | 13 |
| `probe-manual.mjs` | 12 |
| `probe-bands.mjs` | 2 |
| `probe-factoring.mjs` | 1 |
| `probe-overlap.mjs` | 1 |

The counts are matches of the formula's figures or the per-camera, Calculated and band-fee test ids; `calibrate-view.mjs` and `calibrate.mjs` also match 1 and 2. **None is a gate stage.** "Probes from the click" will re-point what this round needs.

## P5. Persisted figures, and whether a live ladder changes any live record

**Nothing stores a term-pricing price.** The calculator runs in the browser; its only writes are `PUT /settings` and `PUT /bands/:product`. Opportunities, Commercials and versions price through `deal-calculator`.

**Measured on the 134 live records** (test_bed 12, document 66, contact 17, unit 13, opportunity 19, account 7; walked 134 of an exact count of 134):
- all 164,647 `record_revisions` were walked (exact count matched), and the 612 belonging to live records were scanned;
- **0 carry a term-pricing-shaped key.** The matcher was calibrated: true on `{listFee}`, false on a plain payload.

**So a live ladder changes no live record retroactively: 0 of 134.** What it does change is the next price anyone reads on the Term Pricing screen.

## P6. Where TERMS lives, and how L-8 fits

TERMS lives in `term_pricing_settings`, row `TERMS` (live: ten terms). It is parsed in `normaliseParams` (line 221, ascending and containing the anchor), offered by `requireTerm`, and edited in the Settings card.

**L-8 sits in `listFeeAt`.** A term in TERMS with no ladder price takes the formula, with source `'formula-fallback'` and the label "Formula: no ladder price for this term".

**How a missing term can arise, since the route refuses it at save (L-5):**
- an admin adds a term to TERMS after the ladder was saved;
- an engine test such as LG-7.

**A term removed from TERMS** leaves its ladder price stored and unread. Position: harmless; it is not deleted.

**LG-7, as asked (1 SafeSight, 108 months, 108 removed from the ladder, live and spec parameters, the engine's `priceQuote` today):**
- fee **1,540.74**;
- Base TCV **166,399.92**;
- margin **82.2%**.

## P7. bandMarginGrid, and how L-7 adds two checks

`bandMarginGrid` (line 387) builds a band-by-term grid from `unitEconomics` with the bands as typed, flagging only `margin < MARGIN_FLOOR`.

**L-7 adds, per band row, walking TERMS in order:**
- `'total'`: the band's client total (fee x T) below the previous term's;
- `'profit'`: the band's profit below the previous term's.

These are `manualLadder`'s checks, with its wording ("Client total below N months", "Profit below N months"), so one meaning serves both cards. The grid reads the price through `listFeeAt`, so it uses the product's live source with no second reader.

**The same grid serves the ladder editor's warnings** (L-5), given the typed ladder in place of the saved one: one function, two callers.

**Brief arithmetic, checked independently in integer cents:**
- **LG-1 to LG-6 reproduce exactly**, including LG-6's eight "Profit below" flags and the floor at 120 (fee 350.00, 23.8%);
- LG-5's boundary is exact: 25.0% at 21,000.00, below at 21,000.01.

## P8. Every screen that shows a price or "Calculated"

All on the Term Pricing screen (`TermPricingView.tsx`), the engine's only consumer.

| surface | where | source label |
|---|---|---|
| term ladder table: per-camera fee and the year-1 monthly by term | ~687, `tp-ladder-percam-T` | per row |
| price breakdown: fee per band, per product line | ~726 | per line |
| the price card and "What the client pays": totals | 756, 1039 | position: the label sits where a list fee shows (per line), not on totals derived from it; **the mockup decides** |
| manual comparison card: "Calculated, 1 camera", "Fill from calculated" | 300, 324, 705 | "Calculated" is the formula (L-6); "Fill from price ladder" is added (L-9) |
| band editor: margin grid fee table and breach sentences | 1574, 1587 | per cell or per row, mockup |
| new: the ladder editor | none yet | mockup |

**The word "Calculated" already means something else on this screen.** "Monthly subscription", with the note "Calculated: the rest of the price." (line 906), uses it for the CAPEX remainder. Under L-6, "Calculated" also means the formula. Recommend the mockup word one of them differently.

**And "ladder" already names the term ladder** (spec 4.5, `termLadder`, `tp-ladder-*` test ids). Position: the new thing is always the "price ladder" (`priceLadder` in code, `PRICE_LADDER_BY_PRODUCT` stored), never bare "ladder".

## P9. Does probe-live.mjs's stale TERMS assertion block the gate

**No.** It is unwired: named in neither `package.json` nor `scripts/verify-all.mjs`, and its header says so.
- Its line 94 expects `TERMS` `[12,24,36,48,60,72,84,96,120]` (live has 108). It also asserts 9 settings, which goes stale after the migration.
- **It WRITES live configuration** (a temporary admin row and an `ANCHOR_MARGIN` change, by an old ruling), so **under L-11 this round does not run it.** Re-pointing it stays in the probe-triage queue.

## P10. The draft migration, NOT applied

**Not parse-checked here** (CLAUDE.md rule 14: this session reaches Postgres only through PostgREST).
- Idempotent: the constraint is dropped and re-added by name, and the seed is a guarded insert.
- **It does not write its own ledger row** (Architecture 10, corrected 2026-09-08). If you apply it by hand, record the row as a separate statement afterwards (below).
- The proposed file name is `20261116000001_term_pricing_price_ladder.sql`. It goes into `supabase/migrations` only after your review.

```sql
-- Term pricing: a per-product PRICE LADDER (TP_LADDER, L-4, L-10, L-11).
-- DRAFT FOR REVIEW, NOT APPLIED. John applies it after his push.
--
-- Shape: { "<product>": { "<term months>": "<monthly price, 2dp>", ... } }.
-- OPTIONAL per product: a product absent from the object is priced by the
-- formula, and the code works with the whole row absent (L-10). The rules
-- (every term in TERMS, above 0, at most 2 decimals, no term outside TERMS)
-- are the engine's validateLadder, which the route runs before writing; they
-- are NOT restated as a CHECK (a second copy drifts, Verification 20). The only
-- constraint change is the key allowlist. RLS unchanged: the admin insert and
-- update policies already cover every key.

-- STOP rather than seed a ladder that does not cover TERMS.
do $$
declare v_terms jsonb;
begin
  select value into v_terms from public.term_pricing_settings where key = 'TERMS';
  if v_terms is distinct from '[12, 24, 36, 48, 60, 72, 84, 96, 108, 120]'::jsonb then
    raise exception 'TERMS is not the ten terms the seed prices (found %); stop and rule on the seed.', v_terms;
  end if;
end $$;

alter table public.term_pricing_settings drop constraint if exists term_pricing_settings_key_check;
alter table public.term_pricing_settings add constraint term_pricing_settings_key_check check (key in (
  'TERMS', 'ANCHOR_TERM', 'ANCHOR_MARGIN', 'SHORT_TERM_MARGIN', 'PROFIT_STEP',
  'VOLUME_BANDS_BY_PRODUCT', 'PRICE_LADDER_BY_PRODUCT', 'HW_UPFRONT_MARGIN', 'MARGIN_FLOOR', 'CURRENCY'));

-- The SafeSight seed, USD per camera per month. Guarded, so a replay never
-- overwrites an admin's later change.
insert into public.term_pricing_settings (key, value)
select 'PRICE_LADDER_BY_PRODUCT', '{
  "safesight": {
    "12": "2500.00", "24": "1500.00", "36": "1080.00", "48": "875.00", "60": "750.00",
    "72": "665.00", "84": "605.00", "96": "560.00", "108": "525.00", "120": "500.00"
  }
}'::jsonb
where not exists (select 1 from public.term_pricing_settings where key = 'PRICE_LADDER_BY_PRODUCT');

-- Self-check: ten keys, and SafeSight's ladder prices exactly the terms in TERMS.
-- Shape only, not the literal, so a replay after an admin's change still passes.
do $$
declare v_ladder jsonb;
begin
  if (select count(*) from public.term_pricing_settings) <> 10 then
    raise exception 'term_pricing_settings: expected 10 keys, found %',
      (select count(*) from public.term_pricing_settings);
  end if;
  select value -> 'safesight' into v_ladder from public.term_pricing_settings where key = 'PRICE_LADDER_BY_PRODUCT';
  if v_ladder is null or jsonb_typeof(v_ladder) <> 'object' then
    raise exception 'PRICE_LADDER_BY_PRODUCT has no SafeSight ladder';
  end if;
  if exists (
    select 1 from jsonb_array_elements_text((select value from public.term_pricing_settings where key = 'TERMS')) as t(term)
    where not (v_ladder ? t.term)
  ) then
    raise exception 'the SafeSight ladder lacks a price for a term in TERMS';
  end if;
  if (select count(*) from jsonb_object_keys(v_ladder)) <>
     (select jsonb_array_length(value) from public.term_pricing_settings where key = 'TERMS') then
    raise exception 'the SafeSight ladder prices a term not in TERMS';
  end if;
end $$;
```

**Rollback.** Safe with the new code deployed, because the key is optional (L-10). The row goes before the constraint is narrowed, or the narrowed check would refuse it.

```sql
delete from public.term_pricing_settings where key = 'PRICE_LADDER_BY_PRODUCT';

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
  if exists (select 1 from public.term_pricing_settings where key = 'PRICE_LADDER_BY_PRODUCT') then
    raise exception 'term_pricing_settings: PRICE_LADDER_BY_PRODUCT is still present';
  end if;
end $$;
```

The ledger row, as a separate statement, by hand only (the CLI writes its own):

```sql
insert into supabase_migrations.schema_migrations (version) values ('20261116000001') on conflict (version) do nothing;
```

## P11. Conflicts with L-1 to L-13, each with a recommendation

**1. L-7 on the formula: 74 warnings on products nobody changed (decision 1).**

Measured: `unitEconomics` today, live parameters, and the manual card's checks per band. **The formula itself triggers L-7's profit check 74 times** across the three products:
- the discounted bands (2 to 4) fall about $60 to $900 at every step from 48 months;
- band 1 wobbles by cents (−0.12 to −0.48) from fee rounding.

These falls are real. With `PROFIT_STEP` 0.00, a discount on a fee whose profit part is flat takes a little more as cost grows with T. But warnings for air_quality and hemir that no ladder decision caused would teach people to ignore the amber, which is the cost Verification 52 names. LG-6's "no flags at any band" is true on the price ladder only. SafeSight shows 23 of these until the migration is applied.

**Recommendation: the two new checks apply to cells whose term AND previous term are both ladder priced.** The floor check stays everywhere, as today. Record the formula's discounted-profit fall as a queued finding about `PROFIT_STEP` 0. The alternative is to show all 74 as true.

**2. L-6 against M-8: what "Calculated" reads (decision 2).**

`manualLadder`'s Calculated is "termLadder's per-camera fee at ONE camera" (M-8, spec 4.6). With a price ladder, termLadder returns the ladder price, so Calculated would quietly become the ladder.

**Recommendation:** Calculated reads the formula fee at one camera (band 1) directly, which honours L-6. M-8's basis is superseded for this, left visible in the spec. T31 is unchanged (no ladder).

**3. No route removes a product's ladder (decision 3).**

L-4 gives a PUT that sets prices, and L-5 refuses an empty set. Nothing returns SafeSight to the formula short of SQL.

**Recommendation:** none this round, and the spec says so. The other route is out of scope.

**4. FA-8 fires on the added fields (decision 4).** See P4. **Recommendation:** extend its allowlist and assert the absent-ladder value.

**5. L-8's fallback is about three times its neighbours (decision 5).**

The formula at one SafeSight camera, live parameters:

| term | formula | price ladder | ratio |
|---|---|---|---|
| 12 | 8,666.67 | 2,500.00 | 3.47 |
| 24 | 5,333.33 | 1,500.00 | 3.56 |
| 36 | 4,222.22 | 1,080.00 | 3.91 |
| 48 | 3,216.67 | 875.00 | 3.68 |
| 60 | 2,613.33 | 750.00 | 3.48 |
| 72 | 2,211.11 | 665.00 | 3.32 |
| 84 | 1,923.81 | 605.00 | 3.18 |
| 96 | 1,708.33 | 560.00 | 3.05 |
| 108 | 1,540.74 | 525.00 | 2.93 |
| 120 | 1,406.67 | 500.00 | 2.81 |

A fallback term is therefore about three times its neighbours. In LG-7 the 120-month client total (60,000.00) falls below 108's (166,399.92), and the ladder checks will say so. This works as ruled, and the L-8 label says it. Raised so it is a known outcome rather than a surprise.

**6. L-4 says "same pattern" as bands, but the ladder must be optional.** See P2. This is not a conflict with the intent; it is where the pattern has to differ for L-10 to hold.

**7. Verification 40 against L-11: the admin success path.**

The admin PUT cannot be driven over HTTP against live settings without an automated write to them. **Recommendation, TP_BANDS's precedent (ruling 0.1):**
- the success path over HTTP against the recording database in `term-pricing-route.test.mjs`;
- the live probe as the non-admin (403, nothing landed);
- the admin save answered in the browser, as `probe-bands.mjs` does.

**8. "Every price on screen carries its source" (L-1): totals versus fees.** See P8. **Recommendation:** label where a fee shows, not totals. The mockup governs.

**9. Two words already in use: "Calculated" and "ladder".** See P8. **Recommendation:** word them apart in the mockup and spec.

**No conflict found with L-2, L-3, L-9, L-10 (given 6), L-11, L-12 or L-13.**
- **L-12's records:** the decision of record lives in spec v1.6 section 6's principle ("OPEX sets the price") and section 4.1; v2.0 amends 4.1 and 3. Spec section 10 says "the implementation must reproduce these exactly", so v2.0 states its tables are with no price ladder.
- **L-13:** `prototypes/term-pricing-ladder.html` is not in the repo yet, as briefed.

## What this does not establish

- **The engine proposal is read, not built.** No figure here comes from ladder code, because none exists. LG-1 to LG-6 were checked by independent integer arithmetic. LG-7 and the formula figures come from today's engine.
- **The migration has not been parsed by Postgres.**
- **The factoring, CAPEX and CPI paths are untouched by a ladder by reading only.** The build's tests measure it.
- **COMMERCIALS_FACTORING is still open, awaiting its Phase 2 sign-off,** on `commercials-factoring`. This branch now holds the checkout, so that round's work is off the served tree until it resumes. Nothing in the two rounds touches the same file.

**STOPPED, as briefed. No build work before the rulings and the mockup.**
