# TP_BANDS close-out

Ready for John's push: `main` at the commit carrying this file, a fast-forward from `4058c9e`.

## 1. Not done

- **The push.** It is John's (rule 18). `git push` was not run.
- **The removal migration is written, not applied.** `supabase/migrations/20261012000002_term_pricing_remove_volume_bands.sql`:
  - apply it **after** the push, because the code on `origin/main` until then still requires the `VOLUME_BANDS` row;
  - record its ledger row as a separate statement after applying (Architecture 10, corrected).
- **A real admin save was not driven from the click (ruling 0.1).** The probe proves the editor up to the request it sends; the route's success and refusal paths are proven over HTTP against a recording database (`term-pricing-route.test.mjs`), and the non-admin refusal against the live route. **John's walk step:** save one product's bands as an admin and read the row back.
- **`probe-live.mjs` was not run.** It grants a temporary admin and writes live settings, which ruling 0.1 excludes. Its band lines are re-pointed. **`probe-screen.mjs --flow`** depends on it and was not run either.
- **The 20261012000001 ledger row is unverified from here.** `supabase_migrations` is not exposed through PostgREST. The applied row itself was read back: 10 keys, `VOLUME_BANDS_BY_PRODUCT` seeded for all three products.
- **Departures from the mockup, each a position under C13 (type and colour are the estate's tokens):**
  - **No breach border on the input.** 4a draws a red border on the 30% discount input because of the floor breach. Not built: a breach is shown in its grid cell (the estate's flag chip) and in the warning. An input border is kept for a broken 3.2 rule (`aria-invalid`, `--red`), because a broken rule refuses the save and a breach does not.
  - **The refusal text** uses the estate's `.tp-error` colour, not the mockup's red panel.
  - **The note beside Add** is the generic one ("You type where each band starts; 'To' fills itself in.") for every product. 4b's "HEMIR sells in ones and twos" is illustrative.
  - **The rules list** shows to a non-admin too, as written.
- **Not built, by ruling:** 4b's "How bands differ by product (example)" card (0.4).
- **Known limit, recorded in `DESIGN_PRINCIPLES.md`:** saving one product's bands is a read-merge-write of one jsonb row, so two admins saving different products in the same instant could lose one save.
- **Queued, not mine:** `probe-live.mjs` asserts `TERMS` without 108. Live `TERMS` has carried 108 since 2026-10-03, so that line was already stale before this round.

## 2. The rulings, against what is built

| ruling | built |
|---|---|
| TB-1 | `VOLUME_BANDS_BY_PRODUCT`, one list per product, seeded 1/10/50/200 at 0/5/10/15%. The engine reads each line's own bands; a product with none is refused (`NO_PARAM`) |
| TB-2 | 2 to 6. Add is disabled at 6, the remove control at 2; the server refuses 1 and 7 |
| TB-3, TB-4 | `validateBands`: band 1 at 1, whole starts above the previous, discount 0 to below 100 with one decimal, never falling (equal allowed); To derived |
| TB-5 | Banded only, unchanged |
| TB-6, 0.6 | One validator for the editor and the server, every problem one line each in band order, spec 3.2's wording; Save disabled while any rule is broken; the server's refusal shown in the same place |
| TB-7, 0.2, 0.3, 0.4 | `bandMarginGrid`: every band at every term, exact floor comparison; the ruled warning; Save stays enabled; fee table of every band at 36/60/84/120 (less any term not offered); both cards "Fix the band rules to see the margin check." while invalid |
| TB-8, 0.5, 0.7 | Admin-only `PUT /api/term-pricing/bands/:product`, saving that product only. The Settings card's four boxes retire; Save settings keeps every other key. A non-admin reads the editor disabled, with "Only an admin can change these." and no eyebrow; an admin sees "Term Pricing · Settings · Admin edits" |
| TB-9 | The breakdown, Payment terms and Quote price on each product's own bands (BG-1 from the click: six SafeSight rows, 131,351,406.00) |

## 3. EXIT, point by point

| point | evidence |
|---|---|
| migration applied, read back | `VOLUME_BANDS_BY_PRODUCT` row present, 10 keys, the seed for all three products |
| spec v1.8 first | `9c233f3`. BG-1 to BG-3 checked by hand against the spec's own figures in Phase 0; none disagreed |
| tests fail first | 147 of 153 red against the v1.7 engine; the six green are settings claims the change does not touch, and B6. Then 158 of 158 |
| engine, settings, route calibration | 104/104 behaved (Y1 to Y24 new, J14 re-anchored). Reverted 163/163, files byte-identical |
| BG-5 | `npm run goldens`: PASS 9 checks, 4734 figures exact. `probe-screen.mjs --spec`, every mode, the same counts as TP_TABS (default 38, `--tabs` 134, `--tp2` 29, `--pc` 10, `--capex` 57) |
| probes from the click | `probe-bands.mjs`: reader ALL PASS (including the bands PUT refused 403 over HTTP and the row's fingerprint unchanged); `--admin` ALL PASS (4a with BG-3 and the warning, 4b, BG-1 priced on configured bands, the request the editor sends, drafts surviving a switch of product and of tab, Discard, 2 and 6). Captures at 1240, 1920 and 3440 opened and read |
| view calibration | 15/15 FIRED (B1 to B15). Reverted reader and admin ALL PASS; view and bundle byte-identical |
| overlap sweep | 1240 to 1920 step 40: **6264 of 6264**. The band editor at 6 bands (4a, with its warning), rule broken (4b) and 2 bands: each reached at 18 of 18 widths. Injections 3/3 FIRED |
| label contrast | census 1272 text nodes; states ALL PASS, with Save bands and Discard clearing P1 |
| full gate | all 26 stages on `462c63b` (pure 871/871, database 105/105, react 1457/1457). A first run was UNANSWERED (no browser path) and was not counted |
| merge --no-ff | `cc9a722`; tree identical to the gated branch |
| merged gate | `--round-close`, all 26 stages on `cc9a722`, after the watched server restarted from the merge (12:02:54) and answered 200 |
| ls-remote | `origin/main` is still `4058c9e`, an ancestor: a fast-forward |
| revert rehearsal | in a temporary index, reversing the merge gives exactly `4058c9e`'s tree. `git revert -m 1 cc9a722` when wanted |

`CURRENT_STATE.md` was regenerated at `4fb7ebe`. Its diff:
- the bands row;
- the new route;
- the two migration files;
- tag distances;
- fixture counts.

Live records are unchanged at 134.

**Commits, counted against the phases:**

| commit | what |
|---|---|
| `d938ea3` | brief and mockup |
| `c2ec431` | Phase 0 report, migration written |
| `5dd9008` | rulings appended, migration read back |
| `9c233f3` | spec v1.8 |
| `f6dd8dc` | engine, settings, route and tests |
| `9e618df` | engine calibration |
| `7b7c65e` | view and probes |
| `21a274e` | view calibration, probe re-points |
| `8ad6cae` | sweep fix |
| `4fb7ebe` | removal migration (written), decisions recorded |
| `462c63b` | `CURRENT_STATE.md` |
| `cc9a722` | merge |

This close-out is markdown only and rides the green merged gate (rule 48a).

## 4. What surprised

1. **The admin probe found a save that looked unsaved.**
   - After Save bands, the editor compared its draft with the bands it had just replaced until a refetch landed, so Save and Discard read enabled.
   - The fix takes the route's answer as the stored state.
   - The first attempt wrote to a query key nothing reads (the key carries `navToken`). The output was the same as before the change, which is Architecture 9's signature.
2. **A calibration came back SILENT, and the silence was the finding.** The "?" in To is the engine's, so the view's `?? '?'` fallback was dead. It was removed, and B4 re-aimed at a view deriving To itself.
3. **The first full sweep: 36 failures, all one hidden word.** The visually-hidden "Remove" column header printed over band 3 from 1600 up. It is TP_TABS's "(done)" again; the header now carries an accessible name instead.
4. **A probe died, and the harness stopped instead of scoring it.** B8's injection made a row read crash the probe. The probe now fails a missing row on its own claim and prints a verdict when it throws.
5. **Two process slips, both caught by the hook.**
   - The pre-commit fetch scan caught a direct `fetch` in the new probe; it now uses the throwing client.
   - The journal guard refused a probe edited by script rather than through `edit.mjs`; that file was then routed.
   - Re-photographed captures were restored from HEAD rather than committed unrouted. The view changes since they were taken draw nothing differently.
