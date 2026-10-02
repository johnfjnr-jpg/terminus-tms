# TERM_PRICING Phase 3: built, STOPPED for the migrations (and two rulings)

## NOT YET DONE OR PROVEN (read this first)

- **The two R-TP6 migrations are written and NOT APPLIED.** Until they are, the screen shows its
  load error and the route answers 500 ("Could not find the table 'public.term_pricing_settings'").
  That was measured on the running server.
- **E2 (on-screen T1, T6, T14, T15, T16, an error case, the ladder): not run.** It needs the
  settings table. **T14 needs a ruling** (item 2 below).
- **E3 (ANCHOR_MARGIN 80% flows through; non-admin refused 403 over HTTP): not run.** The 403 path
  needs the tables. **The admin path needs a ruling** (item 3 below).
- **E4: done except the screenshots.** The isolation guard is green and calibrated, and the estate
  guards are green. Screenshots at 1240 and 1920 under OPEX and CAPEX need the live screen.
- **The database suite has not run on any Phase 3 commit**: "no live session". It belongs to the
  round-close gate (rule 16).
- **Close:** not started. No full gate, no merge, nothing pushed.

## For John: apply the migrations

Both files are on branch `term-pricing` (`148cca2`). They cannot be parse-checked from this session
(CLAUDE.md rule 14). Neither writes its own ledger row (Architecture 10, corrected 2026-09-08).
**Choose ONE path.**

**Path A, Supabase dashboard SQL editor (by hand):**

1. Open `supabase/migrations/20261001000001_system_roles.sql`, paste the whole file into the SQL
   editor, and Run. It creates `system_roles` (select-only RLS, own row only), seeds you as the one
   admin (`75425a02-...`), and self-checks. If the check fails it raises
   "expected exactly one admin, John".
2. Open `supabase/migrations/20261001000002_term_pricing_settings.sql`, paste the whole file, and
   Run. It creates `term_pricing_settings`, adds the select policy plus the admin-only insert and
   update policies, seeds the nine section 3 parameters, and self-checks that there are 9 keys.
3. Then, **as a separate statement**, record both in the ledger:

   ```sql
   insert into supabase_migrations.schema_migrations (version)
   values ('20261001000001'), ('20261001000002')
   on conflict (version) do nothing;
   ```

**Path B, `supabase db push`:** it writes both ledger rows itself. **Do not run step 3.**

Order matters: file 1 before file 2, because file 2's policies reference `system_roles`.

**After applying**, tell me and I will verify:

- both tables exist;
- the 9 settings rows read back with decimals as strings;
- exactly one admin row, yours;
- a non-admin's direct PostgREST write is refused;

and then run E2 to E4.

## Rulings needed

1. **(No ruling needed if you apply as above.)** The order and paths are as stated.
2. **T14 cannot be shown on screen as written.** T14 is T6 plus T13, and T13 uses `TEST-B`, a test
   fixture the spec says is "not a real product". The catalog has no TEST-B and the screen prices
   only catalog products. Options:
   - **(a)** prove T14 on screen as **SafeSight 120 plus AQ 30 at 60 months**. Its expected TCV is
     derived from the spec's formulas and the catalog's AQ costs, and the report shows the
     derivation. It is not a spec figure.
   - **(b)** keep T14 as an engine golden only (it already passes there), and prove a multi-product
     quote on screen without a spec figure.

   Recommendation: (a), with the derivation in the report.
3. **The admin HTTP path has no admin session here.** R-TP6 seeds YOUR account only. Your account
   signs in with Google, so `scripts/sign-in.js` (password prompt) cannot mint a session for it,
   and the two session files belong to the test accounts. Options:
   - **(a)** you add a second admin row by hand for the test account `john+test2@...` for the
     duration of the proof, and remove it after. That is a temporary departure from "John only",
     which is why it is yours to rule.
   - **(b)** the admin path is proven by you in the browser on a walk, with the 403 path and the RLS
     refusal proven by me over HTTP.
   - **(c)** another arrangement you prefer.

   Recommendation: (a). It lets E3 be proven by a probe that can fail, and removal is one statement.

## What was built (commits on `term-pricing`)

| commit | what |
|---|---|
| `6de3844` | Mockup approval A1 to A4 appended to the brief verbatim |
| `1c86fef` | Engine: the CAPEX ladder (A1); the refusal's article chosen by the number (A3) |
| `50bfb10` | Mockup updated with A1, A3 and A4. Measured at 1240 and 1920: the selected CAPEX ladder row equals the quote card (upfront 1,550,000.04, service fee 342,647.69, TCV 23,379,957.72, margin 87.3%) |
| `148cca2` | Phase 3: migrations, route, settings module, the screen, and the guard fix |

**Engine (A1, A3).**

- Under CAPEX each ladder row carries the upfront and the year-1 service fee from the CAPEX quote
  at that term, and "vs 36 months, this deal" compares service fees.
- A test asserts, at every term, that each ladder row equals `priceQuote` at that term: upfront,
  service fee, TCV and margin.
- The refusal reads "An 18-month term is not offered. Choose one of: ...". `articleFor` picks
  "an" for 8, 11, 18, 80, 800, 8000, 11000 and 18000, and "a" otherwise.

**`src/lib/term-pricing-settings.js` (new):**

- turns rows into settings, failing by name on a missing key;
- reads catalog costs as the TEXT the route read. The estate's `resolveCurrentBatches` decides which
  batch is current but converts figures to numbers, so the figures are taken from the text-cast
  rows by batch id;
- `buildParams` builds the engine's parameter object;
- `mergeSettingsChange` validates an admin's change through the engine's own `normaliseParams`,
  plus catalog coverage and the currency code.

**Route `src/routes/term-pricing.js` (new), registered in `server.js`:**

- `GET /api/term-pricing` returns `{ settings, costs, isAdmin, updatedAt, asOf }`.
- `PUT /api/term-pricing/settings`:
  - answers **403** unless the caller has a `system_roles` admin row, read through the caller's own
    client;
  - answers **400** with a readable message for an invalid change;
  - writes every changed key in **one upsert**;
  - answers **403** if the write comes back with fewer rows than it sent, because an RLS refusal
    wears success (Verification 8).

**Migrations.**

- `system_roles(user_id, role)` follows `DESIGN_PRINCIPLES.md` exactly, with role checked to
  `('admin')`, select-only RLS on your own row, and no route writing it.
- `term_pricing_settings(key, value jsonb, updated_at, updated_by)`:
  - every decimal is stored as a JSON string;
  - the insert and update policies require the caller's admin row AND `updated_by = auth.uid()`;
  - there is no delete policy.
- Both are idempotent and guarded, with self-checks.

**The screen** (`frontend-react/src/term-pricing/TermPricingView.tsx`, sidebar "Term Pricing"
after Opportunities):

- It prices in the browser through the engine; nothing on it does arithmetic on money.
- The approved layout with A1 to A4. The A2 elements are not built (no banner, no States card, no
  view toggle, no generated-by footer).
- Settings are collapsed by default. Edit rights come from `isAdmin`: inputs are disabled and Save
  is absent for a non-admin.
- The floor flag and the error states are real: invalid units, escalator or GST say why; no units
  gives the engine's own refusal.

**Positions taken, all revisitable:**

- The screen opens on 1 SafeSight unit at 36 months (T1), so the ladder and quote are visible from
  the first paint.
- GST opens at 9%, as in the approved mockup.
- The escalator is a free percentage input. The mockup had None or 3%, but the spec makes it a
  per-deal percentage.
- The WHT options are exactly A4's three.
- Under CAPEX the quote card adds an "Upfront" figure. A1 asserts the selected ladder row equals
  the quote card, and the row has an upfront.
- Volume band discounts are editable; band starts are not.

## Findings from the estate's guards, and my own defect

- **My isolation guard over-reached (a defect my change created, fixed and pinned).** It matched any
  import path containing "term-pricing", so `server.js` (the route), the route (the settings module)
  and `main.tsx` (the screen's folder) all read as importers of the engine. It now RESOLVES each
  import to a file. Test (2a) pins those three as non-importers and checks the resolver sees
  relative, `/lib/...` and extensionless forms. The calibration sweep stayed 26/26 under the
  resolver.
- **Three of the estate's completeness guards caught the new surface, as they exist to:**
  - the attention-token count (27 against 24): `.tp-error` and `.tp-chip.tp-flag` registered, each
    binding the token once;
  - the shell's loader list: `loadTermPricing` added;
  - suite membership: the settings test added to `npm test`.
- **The approvals test pins the END of `ALL_VIEWS`**, so `term-pricing` sits before
  `opportunity-approval` rather than at the end. The test was left unchanged.
- **Queued, not fixed (Rule 10): a `head: true` count returns NO ERROR for a missing table.**
  Measured: both new tables read as present, with a null count, before they existed. A non-head
  select returns `PGRST205`. Any estate check reading existence or emptiness from a `head: true`
  count without checking `count !== null` is exposed.
- The unbounded-select scanner covers only gate-run scripts, not routes, so its silence says
  nothing about the route's reads. The reads are small: 9 settings rows, one catalog batch per
  product, one role row.

## Evidence (emitted by the runs)

- `npm test`: tests 773, pass 773, fail 0.
- `npm run test:react`: Test Files 85 passed; Tests 1457 passed.
- `npm run typecheck:react`: exit 0. The engine and the settings module gained `.d.ts`
  declarations; the code stays JavaScript.
- Calibration: 26/26 as expected; the reverted run had 62 pass and 0 fail, byte-identical.
- `npm run goldens` (deal sheet), re-run on `148cca2`: `PASS: 9 checks, 4734 figures exact.` No deal-sheet,
  opportunity or Commercials file is in any Phase 3 diff (R-TP5).
- Running server: `GET /api/term-pricing` answers 401 without a token, and 500 "Could not find the
  table" with one.
