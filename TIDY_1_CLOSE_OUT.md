# Tidy round (walk 8): close-out

Branch `tidy-1`, off `main` at `18fd499`, confirmed equal to `origin/main` by
`git ls-remote` against the real remote rather than the local tracking ref.

Rule 18 governs: this round ends **"ready for John's push"** and nothing is
pushed from the session.

---

## Item 1: the Tax card spans, and the line is one line at 1440

`pg-card--wide` carries `grid-column: 1 / -1`. The 460px cap is untouched and
every other card still sits at 460.

`1 / -1` rather than `span 2`, measured: `.terms-cards` is `auto-fit`, so the
used track list is `460px 460px` at 1440 and a single `460px` at 1240. `span
2` against a one-column grid creates an implicit second column and pushes half
the card outside the grid.

| | card width | one line |
|---|---|---|
| 1440 | **932px** | **yes** |
| 1240 | 460px | no |

**At 1240 there is ONE COLUMN**, so there is no second column to span and the
card cannot widen without moving the cap. Stated rather than asserted green.

11/11 live at both widths. Calibrated 3/3.

---

## Item 2: both retired deal blocks removed

846 lines, 156 ids: `#deal-form-vanilla` at 786 and `#deal-version-vanilla`
at 60.

### The writer census, taken BEFORE anything was removed

222 call sites across 40 files, read with comments stripped. `frontend/app.js`
holds four:

| Writer | Disposition |
|---|---|
| `fillCurrencySelect` x2 | **RETIRED with the markup.** It filled the ids at DOMContentLoaded and `getElementById` returned the VANILLA copy, so it filled the dead selects on every load. **Live reader: React's own `deal/currencies.ts`**, which holds `CURRENCY_CODES` and builds the same options including the same empty first one |
| `requestPricingApproval` | **KEPT, reason at the site.** Its only live caller passes a REPORTER and the function then performs no DOM writes; the two lookups are the legacy fallback, already guarded, and its test supplies its own document |

Everything else naming these ids is a probe or a test; none writes into the
product.

### The real dependency was 21 assertions, found by the red

My static count said 116 mentions and **was wrong**: `commercials-wiring`
carries its own inline HTML fixture, so a file-level count over-reported it.
Removing the blocks and reading the failures gave the true list: **21
assertions across 8 suites**.

Every one asserted a claim about the LIVE deal form against markup that
rendered nothing. They are re-pointed at the tree that renders, and several
had to be RESTATED rather than re-bound, because JSX computes what the markup
stated literally.

### The find: FINDING 3 was a real loss

The markup carried `display:flex;gap:24px;align-items:flex-end;flex-wrap:wrap`
inline on `#deal-top-schedule-row`, and the test asserted that literal.
**Measured live, the React row computed `display: block, flex-wrap: nowrap`.**
The port never carried any of it, so the fix for "a year cell may not be given
less room than its own glyphs" existed only in markup nobody could see, and
its guard was reading the corpse.

Restored as a RULE rather than inline, because the inline style is what let it
be lost silently.

### Live, both widths

14/14: five sections present, 1 and 2 side by side inside the intake wrapper,
3 and 6 siblings of it, the cash flow grid inside section 6, **no page
errors**, and **zero duplicated deal or version ids where there were 156**.

Three contact ids remain duplicated on a surface this round did not touch.
Printed rather than filtered out.

---

## Item 3: STOPPED for John, as instructed

Quoted verbatim, photographed, untouched. The report carries the definitions
and the screenshots.

| | Current state |
|---|---|
| **L7** main half | 1 main note row, **0 carrying a stage chip**. `contact/notes.ts` exports `note(text, by, at)` with no stage, and it is SHARED with the contact surface where a stage has no meaning |
| **L12** | **No tags in the Test Bed header.** The old markup carried `<span class="tag">R&amp;D</span>` |
| **C9** | The card title reads **"Sensor Counts"**, over rows for SafeSight Cameras, Air Quality Sensors and HEMIR Sensors |

---

## Housekeeping

- **Fixtures torn down**, re-queried by owner.
- `CURRENT_STATE.md` regenerated on a clean tree.

---

## Exit gate

| Point | Answered |
|---|---|
| Item 1 built, both widths, screenshot | **Yes**, and 1240's limit is stated rather than claimed |
| Item 2 census taken BEFORE removal | **Yes**, 222 sites, every app writer dispositioned |
| Every writer re-pointed or retired with its reason | **Yes** |
| A writer feeding something visible has its live reader named | **Yes**, `deal/currencies.ts` |
| Red-first where behaviour moved | **Yes** |
| Live proof the Opportunity renders whole | **Yes**, 14/14 at 1440 and 1240, no page errors |
| Item 3 quoted verbatim, photographed, untouched | **Yes** |
| `CURRENT_STATE.md` regenerated | see below |
| Full gate, branch and merged | see below |
| Pushed | **No push from the session** |
