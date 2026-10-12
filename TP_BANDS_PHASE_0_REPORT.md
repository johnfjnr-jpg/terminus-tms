# TP_BANDS Phase 0 report

Branch `tp-bands` off `origin/main` at `4058c9e`, confirmed by `git ls-remote`. First commit
`d938ea3`: the brief, verbatim, and the mockup. Phase 0 is investigation only: no engine, route or
view code has changed. One file is written and NOT applied: the migration (section 2).

## 0. Needs a ruling before Phase 1 (read this first)

1. **The "admin edit" probe cannot be run by this session.** The brief asks for probes from the
   click of "an admin edit". The probe account (john+test) has no `system_roles` admin row, and
   the route refuses its writes with 403. TP_TABS met the same wall and proved the admin LAYOUT
   only, by setting `isAdmin` in the browser's copy of the GET response. An admin edit is also a
   write to the LIVE settings, so it changes live pricing until it is put back. Options:
   - **(a) Recommended.** You grant john+test an admin row for the round and revoke it at the
     close. The probe saves a band set and restores the seed, both read back from the database.
     This is a live-data and access change, so it is your call.
   - **(b)** The probe proves the editor up to the request it sends (PUT intercepted in the
     browser). The server's refusals and its success path are proven over HTTP by a test that
     calls the route's own validation. A real admin save is then never driven from the click,
     and the close-out says so.
2. **The mockup's warning (4a) makes a claim the engine does not make.** "You can still save;
   quotes in this band and term will show the floor flag for approval." The floor flag is on the
   WHOLE-DEAL margin (spec 4.4). A grid cell is the worst case, with every unit at that band's
   fee. A quote with 1,000 SafeSight units at 120 months blends six bands and will usually sit
   well above the floor, so it shows no flag. That makes the sentence false for most of the
   quotes it describes (Verification 52: a warning is a claim). Proposed: "You can still save. A
   quote is flagged for approval only when its whole-deal margin falls below the floor." Your
   wording governs. I will not ship the mockup's sentence without a ruling, because the HTML is
   binding on content.
3. **The fee table (B-7) and the mockup disagree.** B-7 says "fee per unit per month for **each
   band**". 4a shows bands 1, 4 and 6 of six. Proposed: every band, as B-7's text says. Which
   governs?
4. **4b has a card the brief does not name:** "How bands differ by product (example)". In 4b it
   sits where the fee table goes, while the set is invalid. Proposed: do not build it. Its
   figures are invented ("Example band starts only"), and a hard-coded example table is a claim
   with a shelf life (Architecture 9). While the set is invalid, the fee table shows the same
   "Fix the band rules" state as the grid. Build it, or not?
5. **Two Save buttons in one card.** B-8 puts the editor in the Settings card. That card already
   has "Save settings". The mockup gives the editor its own "Save bands" and "Discard".
   Proposed: the editor keeps its own Save bands and Discard, as drawn, and they save only the
   bands of the product shown. The card's band-discount table (four discount boxes, today's only
   band editor) is retired, so no band can be edited in two places. "Save settings" keeps every
   other key. Accept?
6. **The rulings' numbering collides with the spec's test cases.** The spec v1.7 section 11.3
   already has test cases **B-1 to B-6** (the per-band totals), cited by name in
   `scripts/tests/term-pricing.test.mjs` and `probe-screen.mjs`. This brief's rulings are also
   B-1 to B-9. A spec v1.8 that cites "B-3" would be ambiguous, which is how a coverage claim
   goes wrong. Proposed: in the spec, the code and the reports, the rulings are cited as **TB-1 to
   TB-9**, and the brief stays verbatim. Accept, or another prefix?
7. **The editor's mockup says "Admin only"** ("Term Pricing · Settings · Admin only"). B-8 says
   everyone can read. Proposed: a non-admin sees the same editor read-only, with the line "Only
   an admin can change these." used by the card today. The mockup's eyebrow becomes "Admin edits"
   for an admin and is dropped for everyone else. Accept?

## 1. Where bands live today, and every reader

**Storage.** One global list in `term_pricing_settings`, key `VOLUME_BANDS`. The live row is
`[{from 1, "0"}, {from 10, "5"}, {from 50, "10"}, {from 200, "15"}]`, unchanged since 2026-10-02
(`CURRENT_STATE.md` line 422). It was seeded by `20261001000002_term_pricing_settings.sql`. The
table's key allowlist is a column CHECK.

**The spec.** `docs/pricing-spec.md`:
- section 3 (`VOLUME_BANDS`, "see 3.1");
- 3.1, the four bands, one table for every product;
- 4.2 (`band_fee`) and the 4.3 sums;
- 4.3's per-band totals (v1.7);
- 10.2 and 10.3, four band columns;
- T2 to T8 (band edges);
- T23 (AQ band fees);
- B-1 to B-6.

**Every reader.** These are code hits for `VOLUME_BANDS|.bands|bands[` across the repository,
docs and briefs excluded. The search is shown working by its hits. Two hits are a different
concept, the cost-basis staleness bands (`src/lib/cost-basis.js` and its two tests), and are
excluded.

| reader | what it does with the bands |
|---|---|
| `src/lib/term-pricing.js` `normaliseParams` (141-150) | validates one list: band 1 at 1, ascending starts; derives `to`. It does NOT check the count, whole-number discounts, falling discounts or below 100% |
| `src/lib/term-pricing.js` `bandFeeCents`, `splitIntoBands`, `unitEconomics` (225-260), the quote line build (367-407) | price every product on the ONE list `p.bands` |
| `src/lib/term-pricing.d.ts` line 17 | `VOLUME_BANDS: Array<{ from; discountPct }>` |
| `src/lib/term-pricing-settings.js` | `SETTING_KEYS` (nine keys), `buildParams`, and `mergeSettingsChange`. The last validates a change by running the engine's `normaliseParams`, so the server's band rules today are exactly the engine's |
| `src/routes/term-pricing.js` | GET serves the row; PUT is admin-only (403), merge, then upsert, counting rows |
| `frontend-react/src/term-pricing/TermPricingView.tsx` 535 | breakdown rows, from the engine's per-line `bands` (already generic in the count) |
| same file, 1044, 1060-1062, 1116 | the Settings card's band table: one discount box per existing band; starts are NOT editable, and bands cannot be added or removed |

## 2. Proposed storage, and the migration (written, NOT applied)

`supabase/migrations/20261012000001_term_pricing_bands_per_product.sql`:

- **A new key, `VOLUME_BANDS_BY_PRODUCT`,** not a new shape for `VOLUME_BANDS`. The brief has you
  apply before the merge. Until the merge, the screen runs `origin/main`, whose engine calls
  `.map` on `VOLUME_BANDS` and whose settings card calls `.forEach` on it. Reshaping that row
  would break every Term Pricing screen in that window. The new key is additive.
- **The shape:** `{ "<product>": [ { "from": n, "discountPct": "d" }, ... ] }`, keyed by product
  as `ANCHOR_MARGIN` is.
  - `from` is kept, not renamed `start`. It is the name the engine, its outputs (`from`, `to`)
    and the stored row already use, and a rename is churn with no reader (Architecture 6).
  - The editor's column still says "From", as the mockup does.
- **The seed (B-1):** 1/10/50/200 at 0/5/10/15 for safesight, air_quality and hemir. The insert is
  guarded, so a replay never overwrites an admin's change.
- **A stop before seeding.** The file raises an exception if the live `VOLUME_BANDS` is no longer
  the B-1 bands, rather than quietly discarding an admin's change.
- **The constraint:** the key allowlist is dropped and re-added with `VOLUME_BANDS_BY_PRODUCT`.
  - The band RULES are NOT written as a SQL CHECK. A second copy of the rules in SQL is a second
    reader (Verification 20). The route, through the engine, is the authority (B-6).
  - As today, RLS lets an admin write the table directly and skip the route. That is the existing
    posture for every key, unchanged.
- **Self-checks:** ten keys, and a list for each of the three products.
- **The old key.** `VOLUME_BANDS` stays, unread once this round merges. A second migration
  removing it is written at the close, to apply AFTER your push, because the deployed code reads
  it until then.
- **Not parse-checked** (rule 14). It writes no ledger row (Architecture 10, corrected). After
  applying, record it as a separate statement:
  `insert into supabase_migrations.schema_migrations (version) values ('20261012000001') on conflict (version) do nothing;`
- **One assumption I cannot verify from here:** that the column CHECK's generated name is
  `term_pricing_settings_key_check`, which is Postgres's default for a column check. If it is
  not, the drop is a no-op, the old check stays, and the seed insert fails LOUDLY on it. It does
  not fail silently. PostgREST does not expose `pg_constraint`, so I cannot look.

## 3. Proposed engine API

Both are pure and in `src/lib/term-pricing.js`, so the editor and the route produce the SAME
wording from one function (B-6). The screen does no money arithmetic (B-7).

**`validateBands(bands)`** returns `{ ok, problems: [{ band, field, message }] }` and never
throws. It reports every broken rule, not just the first. `normaliseParams` calls it for each
product and throws `BAD_PARAM` with the first message, so the route's 400 carries the same
sentence the editor shows. The messages, each naming the fix, with the mockup's own wording for
the overlap:

| BG-4 refusal | message |
|---|---|
| band 1 start not 1 | Band 1 always starts at 1. Fix this to save. |
| a start not above the previous | Band 4 must start above 5, where band 3 starts. Bands cannot overlap. Fix this to save. *(mockup 4b, verbatim)* |
| a non-whole start | Band 3 must start at a whole number of units. Fix this to save. |
| 1 band | A product needs at least 2 bands. Add a band to save. |
| 7 bands | A product can have at most 6 bands. Remove a band to save. |
| a falling discount | Band 4's discount must be at least 10.0%, band 3's. Discounts never fall as volume rises. Fix this to save. |
| a discount of 100 or more | Band 6's discount must be below 100%. Fix this to save. |
| not one decimal place, blank or negative (not in BG-4, needed by B-3) | Band 2's discount must be a number from 0 to below 100, with at most one decimal place. Fix this to save. |

In the editor, Add is disabled at 6 bands ("+ Add band (6 of 6)", as drawn) and ✕ at 2, so 1 and
7 are reachable only through the route. The server still refuses both.

**`bandMarginGrid(product, bands, params)`** returns:

```
{ floor, terms, rows: [{ band, from, to, discountPct,
                          cells: [{ termMonths, feeCents, margin, belowFloor }] }],
  breaches: [{ band, termMonths, feeCents, margin }] }
```

It is `unitEconomics` (spec 10.3: every unit at that band's fee, margin on price) evaluated on the
CANDIDATE bands for every term in `TERMS`. `belowFloor` is the engine's exact comparison against
`MARGIN_FLOOR`, so a cell showing "25.0" that is really 24.96% is flagged, and the screen does
not round its way out of the flag. The fee table (36, 60, 84 and 120) reads `feeCents` from the
same rows; it is not a second calculation. If an admin has removed one of those four terms from
`TERMS`, that column is not shown.

**Per-product params.** `normaliseParams` takes `VOLUME_BANDS_BY_PRODUCT`, and `p.bands` becomes
`p.bands[product]`. `splitIntoBands`, `unitEconomics` and the line build read the line's own
product. A product priced with no bands is refused (`NO_PARAM`), as a missing `ANCHOR_MARGIN` is
today. In `term-pricing-settings.js` the key joins `SETTING_KEYS` and `PER_PRODUCT_KEYS`, in
place of `VOLUME_BANDS`.

## 4. Everything that assumes four fixed bands

Censused by grep (`200+`, `from: 200`, band labels, `tp-band-`, `BAND.`, `VOLUME_BANDS`,
`discountPct`) over `scripts/**`. The positive case is the hits below. Each needs a disposition
in the build.

| file | assumption | disposition |
|---|---|---|
| `scripts/tests/term-pricing.test.mjs` 31-35 (`SPEC_PARAMS.VOLUME_BANDS`) | one global list | re-shape to per product with the seed. **Every v1.7 golden then runs unchanged: this is BG-5** |
| same, 399-403 (`flow: VOLUME_BANDS change the banded fees`) | edits the global list | re-point to one product's list, and assert the OTHER products did not move (TB-1) |
| `scripts/tests/term-pricing-settings.test.mjs` 22, 55 | the fixture row; `SETTING_KEYS.length === 9` | the new key; the count stays 9 (one key replaced by another) |
| `scripts/term-pricing/probe-live.mjs` 83 | reads `VOLUME_BANDS` discounts | re-point to the new key (it is `--flow`'s helper, which writes live settings: see 0.1) |
| `scripts/term-pricing/probe-screen.mjs` 479-486, 749 | breakdown rows "1 to 9" ... "200+" | unchanged under the seed. They are the seed-equivalence check from the click |
| `scripts/term-pricing/probe-screen.mjs` 195-199 | the non-admin settings view | extended: the band editor read-only |
| `scripts/term-pricing/probe-overlap.mjs` 302-340 | the settings card open and closed | add the band editor at 2 and 6 bands, valid and invalid, admin and non-admin (brief) |
| `scripts/label-contrast/states.mjs`, `census.mjs` | the disabled Save settings | add the disabled Save bands, Add band at 6, and ✕ at 2 (new disabled controls) |
| `scripts/term-pricing/calibrate.mjs` anchors at 45, 88, 214 | engine lines in band code | re-checked against the new engine; each anchor must still be unique |
| `docs/pricing-spec.md` 3, 3.1, 10.2, 10.3, T2 to T8 | one table of four bands | v1.8: the four bands become "the seed for every product"; the figures are unchanged |
| `src/lib/term-pricing.d.ts` 17 | the type | the new shape |

**Not affected, checked:**
- **G1 to G5** (`npm run goldens`, the deal-sheet goldens). `golden-deals-check` does not import
  the term-pricing engine; only `term-pricing-settings.js` and the engine itself do.
- **`state-dump.mjs`.** It prints the settings rows generically, with no fixed key list.

## 5. Conflicts, and the brief's own figures

**The brief's goldens agree with the spec as written.** I checked them by hand from the spec's
own figures, never from the code under test:
- **BG-1:**
  - SafeSight at 60 months is HW 8,000 + 200 × 60 = 20,000 a unit, and list fee 2,613.33.
  - The 20% and 30% fees are 2,090.67 and 1,829.33.
  - The units 9/40/150/300/500/1 sum to 1,000.
  - Monthly is 2,189,190.10, TCV 131,351,406.00, and margin 111,351,406 / 131,351,406 = 84.77%.
  - Every figure matches.
- **BG-2:**
  - HEMIR is 100,000 / 500 (spec line 425), so 10H + 384h = 1,192,000 and the fee is 19,866.67.
  - The 5% fee is 18,873.33, monthly 38,740.00 and TCV 2,324,400.00.
  - Cost is 260,000, so the margin is 88.81%.
  - Every figure matches.
- **BG-3:**
  - 12 months: 6,066.67, margin 85.71%.
  - 36 months: 2,955.56, margin 85.71%.
  - 60 months: 1,829.33, margin 81.78%.
  - 120 months: 984.67 (price 168,800 / 120 × 0.7), margin 72.92%.
  - Every figure matches.

No stop is triggered.

**Other conflicts:**
- **The mockup's grid figures** are at a 64.8% anchor. The brief puts this out of scope, so the
  built grid uses the live settings (anchor 90). A probe can check 4a's structure and wording,
  but not its figures. 4a's figures check nothing about the build.
- **4b shows "?"** in band 3's "To" while band 4's start is invalid. B-3 says nothing about it.
  Proposed: "To" shows "?" whenever next start − 1 would fall below the band's own start, as
  drawn.
- **Several problems at once.** The mockup shows one message. Proposed: one line per problem, in
  band order, each naming its fix.
- **CLAUDE.md, no conflict.** Rule 18 holds: no push. Architecture 14: bands stay parameters; the
  engine holds no band constant beyond reading the seed from data. Rule 14: not parse-checked,
  stated above.

## 6. What this report does not establish

- **The migration has not run** anywhere. Its constraint name is assumed (section 2).
- **The API is a proposal.** No test of it exists yet. Tests fail first after your rulings.
- **The figures I checked by hand** are checked against the spec's own numbers. The engine has not
  been run on BG-1 to BG-3.

STOP. Waiting for rulings on section 0, and your review of the migration.
