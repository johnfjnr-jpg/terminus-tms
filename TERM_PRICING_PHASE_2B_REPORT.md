# TERM_PRICING Phase 2 rulings report (Q1 to Q5)

**STOPPED again for John's review of the six screenshots.** Phase 3 has not started: no screen, no
migration. Nothing has been pushed.

## Commits on `term-pricing` since `8119e7a`

| commit | what |
|---|---|
| `55ba4b6` | Rulings Q1 to Q5 appended to the brief verbatim |
| `00f16ab` | `docs/pricing-spec.md` v1.2.2 (Q1), in its own commit, before the engine change |
| `307497b` | Engine: the CAPEX service fee escalates (Q1); margin after WHT (Q4); T22 golden |
| (this commit) | Mockup regenerated with Q1, Q2, Q4 and Q5; six screenshots; this report |

## Q1: spec v1.2.2 and the engine

- **Spec.** The header reads `Specification v1.2.2`, with an "Amended" line. Section 6 gains the
  CAPEX-with-escalator formula exactly as ruled, and T22 is added to section 11. Nothing else in
  the spec moved.
- **Engine.**
  - The CAPEX service fee is now `round_half_up(s x (1 + e)^(k-1), 2)` per contract year, with `s`
    as ruled.
  - The upfront is TCV less the sum of the service fees, so it carries the residue.
  - TCV is the OPEX TCV.
  - With no escalator this reduces exactly to the v1.2.1 formula. T15 is unchanged and still
    passes.
- **One implementation choice, recorded.** The spec's weight is `12 x sum of the year factors`.
  The engine writes it as `months in year k x factor`. That is identical for every term that is a
  whole number of years, which is every term in `TERMS` today, and it stays consistent with
  section 7's own year split if a `TERMS` entry ever is not.
- **Schedule rows.** Consecutive years with an identical fee now merge into one run. A flat deal
  reads as one row ("Months 1 to 60"); an escalating one reads as one row per year.
- **T22 is pinned from the spec's figures and passed on its first run**: TCV 18,464,248.32; upfront
  1,200,000.00; the five service fees; upfront plus sum equals TCV; and TCV identical to the OPEX
  quote with the same escalator. Those figures are John's, not the engine's, so a first-run pass is
  independent agreement rather than the tell.

## Q4: margin on price after WHT

- The engine returns `marginAfterWht` = (gross profit minus WHT borne) / TCV net, and returns
  **null whenever nothing is borne**: gross-up on, or no WHT.
- It is pinned as a POSITION test (it is not a spec figure), with the derivation from T21: WHT borne
  1,738,912.80 and margin after WHT 76.2%, while the section 4.3 margin stays 86.2%.

## Calibration (M4: injections only for the new claims)

- J15 (service fee flat under an escalator) failed T22.
- J16 (margin after WHT ignoring the WHT borne) failed the Q4 position test.
- J17 (identical years not merging) failed T15.
- Full sweep: **23/23 behaved as expected**. The reverted run had 59 tests pass and 0 fail, and all
  files were byte-identical.

## The mockup

- **Q2:** the ladder column now reads "vs 36 months, this deal".
- **Q1 on screen:** under CAPEX with the 3% escalator, the schedule shows the upfront and then five
  rising yearly service fees. The lead figure reads "Monthly service fee (year 1)". The note states
  the tie to TCV and that TCV is the same as OPEX. Measured: the quote's TCV equals the selected
  ladder row's TCV (23,379,957.72).
- **Q4 on screen:** "Margin on price after WHT: 77.3%" sits under the margin figure, and only when
  WHT is borne. It is measured EMPTY in the default state.
- **Q5:** Settings is collapsed by default behind an Expand / Collapse button with `aria-expanded`.
  - The `hidden` attribute sits on a wrapper with no display rule of its own, and collapse was
    measured by COMPUTED style (Verification 4), not by the attribute.
  - Expanding is open in both views, but only the admin view can edit (16 controls enabled for the
    admin, 0 for the salesperson). This continues the Phase 0 ruling: visible to everyone,
    editable by an admin.
  - **If "admin expands it" means a salesperson should not be able to expand it at all, that is a
    one-line change.**
- **The page opens on the ladder and quote.** In the first 1100px viewport, the ladder starts at
  505 and the quote figures at 931 (1240 wide), or 242 and 668 (1920 wide).

### Layout evidence: measured first, then the page captured

| width | state | page overflow | overflowing blocks | quote figures in one row | settings visible |
|---|---|---|---|---|---|
| 1240 | default | none | 0 | yes | no |
| 1240 | CAPEX + 3% + WHT borne | none | 0 | yes | no |
| 1240 | settings expanded, admin | none | 0 | yes | yes |
| 1920 | default | none | 0 | yes | no |
| 1920 | CAPEX + 3% + WHT borne | none | 0 | yes | no |
| 1920 | settings expanded, admin | none | 0 | yes | yes |

**A defect the probe found and I fixed.** At 1240 the CAPEX + borne state first overflowed the page:
"borne" appended to every WHT cell widened the column. "borne" now lives in the column header
("WHT borne", or "WHT (grossed up)"), and the re-measure is clean.

The six screenshots are in `prototypes/term-pricing/screens/`, named for the state they show. I
opened and read them. The Phase 2 first-pass screenshots were removed so that nobody cites an
outdated image (Verification 44).

## Suites

- `npm test`: tests 765, pass 765, fail 0.
- `npm run goldens`: `PASS: 9 checks, 4734 figures exact` (G1 to G5 unchanged).
- **The pre-commit database stage did NOT run** for `307497b`: "no live session". I did not refresh
  the session by hand (CLAUDE.md rule 16), and the round-close gate is the authority. The change
  touched no database code.

## Observation for John (not changed; not ruled)

Under CAPEX, the product-lines table still shows the OPEX year-1 band fees. They are the pricing
basis that produces TCV, but they are not what the client is invoiced. Options:

- relabel it "Pricing basis (OPEX fees)" under CAPEX; or
- leave it as it is.

The mockup leaves it as it is.
