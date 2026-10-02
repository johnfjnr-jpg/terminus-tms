# TERM_PRICING Phase 3 report: built and verified live

**Nothing is unfinished in Phase 3.** E1 to E4 are evidenced below. The close (full gate, merge,
merged gate) follows this commit. Phase 4 (cash flow) was not started, and the brief allows it to
follow the demo. **Queued, not built (John's ruling):** a `term_pricing_settings` history, recording
who changed what, from what, and when, before real quotes rely on the settings.

## Rulings executed (all appended to the brief verbatim)

- **T23** (2026-10-02). Spec v1.2.3 went in as its own commit (`7c89796`). T23 was pinned as an
  engine golden (`010e00b`) and passed on its first run against John's externally computed figures.
  It is proven on screen below.
- **E3 temporary admin** (2026-10-02). The insert, the removal and its proof are stated under E3.
  No other `system_roles` change was made.
- **updated_at** (2026-10-02, post-migration). The route already sets `updated_at` on every write,
  in the same upsert as `updated_by`. Proven live under E3, so no code change was needed.

## Verify tables (`scripts/term-pricing/probe-live.mjs`, service key and the non-admin's JWT)

- `term_pricing_settings` holds 9 keys, and every decimal is a JSON string.
- `TERMS` and `ANCHOR_TERM` are as seeded.
- `system_roles` holds exactly one row: John, admin.
- A non-admin's DIRECT PostgREST writes are refused:
  - the update returns 0 rows (the silent RLS refusal);
  - the upsert gets `new row violates row-level security policy`;
  - granting itself admin is refused the same way.
- The non-admin sees 0 `system_roles` rows (own row only), and the settings table did not move.

## E1: goldens

- Every term-pricing golden is exact: 10.1, 10.2 and 10.3 cell by cell, plus T1 to T23.
- G1 to G5 are unchanged: `npm run goldens` reports `PASS: 9 checks, 4734 figures exact.`

## E2: from the click (`scripts/term-pricing/probe-screen.mjs`, non-admin, real keyboard), 29 of 29 PASS

| case | proven on screen |
|---|---|
| T1 (the opening state) | TCV 151,999.92, margin 90.0%, and **the whole ladder equals table 10.1** (fee, vs 36, TCV, margin, all 9 rows) |
| T6 | TCV 17,389,126.20, margin 86.2%; the selected ladder row is 60 months and equals the quote card |
| T15 (A1) | upfront 1,200,000.00 and service fee 269,818.77; TCV ties; the schedule is the upfront then 60 x the fee; the ladder shows Upfront and Monthly service fee (year 1); **the selected CAPEX row EQUALS the quote card** (upfront, service fee, TCV, margin); the lines table reads "Pricing basis (OPEX fees)" |
| T23 | TCV 19,079,808.60, margin 86.2%, AQ band fees 973.33 and 924.67, cost 2,640,000.00 |
| T16 | TCV 166,494.36, margin 88.0%, year fees 2,613.33 / 2,691.73 / 2,772.48 / 2,855.66 / 2,941.33 |
| error (T18) | "Enter at least one unit of at least one product.", with no ladder or quote beside it |
| error (input) | "GST must be a percentage, for example 9." |

**Two probe faults, both mine and both in the instrument, not the product. Recorded because each
produced a convincing wrong reading:**

- **A triple click did not select the field**, so "1" plus a typed "120" became 1,120 units. The
  figures that followed were self-consistent and wrong; the A1 row-equals-card check even passed on
  them. The helper now selects through the DOM, types real keys, and **reads each write back before
  measuring** (Verification 44's write-side clause).
- **The units field drops "." and letters in this headless Chrome.** I measured it key by key:
  `defaultPrevented` was false on every key, and GST and the escalator accept "2.5x". The cause is
  the browser and the field's `inputMode="numeric"`, not the app. The typed refusal is therefore
  proven on GST, and the units refusal stays a unit-level behaviour.

## E3: admin only, over HTTP and on screen, with a temporary admin (all PASS)

1. A non-admin GET returns 200 with `isAdmin false`; catalog costs arrive as decimal strings
   (`"8000.00"`).
2. A non-admin `PUT` returns **403** "Only an admin can change term pricing settings.", and the
   fingerprint is identical (nothing moved).
3. **INSERTED** `system_roles (23216963-7160-444c-967c-bf0d12638d04 = john+test2, admin)` at
   2026-10-02T14:17:11.070Z (1 row). As that account, GET returns `isAdmin true`.
4. Admin `PUT ANCHOR_MARGIN {safesight: "80"}` returns 200. **LANDED**: the table holds 80.
   **updated_at advanced** (14:16:42.767 to 14:17:13.01). **updated_by is the admin's id.** No other
   key moved, and a non-admin reader sees 80.
5. **On screen, at 80%**: a non-admin's opening quote (T1's inputs) prices at **2,111.11 / TCV
   75,999.96**, the spec's own formula at 80%. Their settings show 80 and are read-only, with no
   Save.
6. An admin `PUT` of a float-shaped number returns **400** "MARGIN_FLOOR must be a decimal string",
   and nothing moved.
7. Restored to 90% for every product, by an admin `PUT`.
8. **DELETED** the temporary row at 2026-10-02T14:17:20.568Z. **REMOVAL PROVEN**:
   - selecting that user returns **0 rows**;
   - `system_roles` is back to exactly one row (John);
   - the former temporary admin's `PUT` is **403** again.

**One trace remains, stated rather than tidied:** `ANCHOR_MARGIN.updated_by` is the former
temporary admin's id, from the restore in step 7. Every value equals its seed. Only John can change
this through the application, and the queued history is the proper record of it.

**The first E3 run also had one FAIL, and it was the probe.** I compared the restored value as raw
JSON, and jsonb reorders object keys. The value was correct; the comparison was not. The teardown
then re-wrote the same value with the service key. Comparison is now key-order independent, and the
whole of E3 was re-run, ALL PASS. That run is the one recorded above.

## E4: guards and screenshots

- Isolation guard: green and calibrated, 26/26 injections.
- Estate guards: pure suite tests 774, pass 774, fail 0. The React suite and typecheck are green in
  every pre-commit run. The database stage passed (134.7s) on `7ff484d`.
- Screenshots, page captures taken after measurement, all opened and read:
  - `prototypes/term-pricing/screens/p3-1240-opex-T6.png`
  - `p3-1240-capex-T15.png`
  - `p3-1920-opex-T6.png`
  - `p3-1920-capex-T15.png`
  - `p3-1240-flow-80.png` (E3)

**A defect my change created, found by OPENING the screenshot after every check passed.** At 1240,
quote figures broke mid-number ("1,200,000." over "00"), under CAPEX and, it turned out, under OPEX
too. The checks measured cells, not legibility. The fix:

- figures never wrap, and step down a size below 1600px;
- table headers may wrap, which also ended two cards overflowing under CAPEX;
- the probe now asserts **no figure is broken or clipped**.

**Calibrated**: red on the reverted stylesheet (both states at 1240), green on the fixed one, and
the file was restored byte-identical.

## CURRENT_STATE.md, regenerated and reconciled

| diff line | accounted for by |
|---|---|
| routes 78 to 80, the two `/api/term-pricing` rows | Phase 3 route |
| migrations 124 to 126, the two files | R-TP6 |
| bundle size and sha | Phase 3 screen |
| tag distances, soft-deleted fixture counts, approval-row counts | commits and gate runs since 30 Sep. Live records are unchanged at 134 |

**A gap, recorded:** the generator does not read `system_roles` or `term_pricing_settings`, so
`CURRENT_STATE.md` cannot show the admin or the settings. Queued.

## Queued (Rule 10), not built

1. `term_pricing_settings` history (John's ruling).
2. A `head: true` count returns no error for a MISSING table. Measured before the migrations: both
   tables read as present. Any existence or emptiness check that leans on one is exposed.
3. `CURRENT_STATE.md` should record `system_roles` and `term_pricing_settings`.
4. Phase 4, cash flow (brief).
