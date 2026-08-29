# Round 39 Phase 2: measured before and after

2026-08-29. **Every reading taken twice on the same tree and confirmed identical**
(`agree: true` throughout). The "before" half was taken by checking the frontend
out at `449a216` and measuring the real old layout, not by reasoning from I6.

---

## The measure changed, and the new one is better

I6 measured a **gap in pixels** between the control and the readout. Phase 2's
first after-capture showed the gap falling from 578px to 240px while
`marginInView` went **false**, because the local figure sits below the input and
minimum scroll puts it past the bottom edge.

**The gap was the wrong measure.** "Beside" is not a distance, it is **the number
of scroll positions where you can work without losing the number.** So the metric
is the height of the window in which both the control and a readout are visible.

---

## Before and after, at three viewports

Window in which the control and the readout are BOTH visible. Larger is better;
zero means there is no such position at all.

### Target margin, the common loop

| Viewport | Before: strip | After: strip | **After: local figure** |
|---|---|---|---|
| 1240x700 | 60px | 60px | **450px** |
| 1240x900 | 260px | 260px | **650px** |
| 1920x900 | 250px | 250px | **650px** |

**7.5x more scroll freedom at 1240x700**, and the strip is unchanged, which is
the point: it was kept, not replaced.

### Contract duration, the second loop control

| Viewport | Before: strip, on Payment Terms | After: strip, on Structural Terms | **After: local figure** |
|---|---|---|---|
| 1240x700 | 90px | **0px** | **570px** |
| 1240x900 | 290px | 140px | **770px** |
| 1920x900 | 290px | 140px | **770px** |

---

## THE TWO ITEMS ARE COUPLED, AND THE MEASUREMENT SAYS SO

**At 1240x700, moving `duration` to Structural Terms takes its window against
the strip from 90px to ZERO.** There is no scroll position on the reshaped panel
where the duration control and the strip's margin are visible together.

**So item 2 on its own would have made the term loop worse.** It is only an
improvement because item 1 put a readout inside the card: 0px becomes 570px.

That was not predicted. It was found by measuring the two changes against each
other, and it is the argument for landing them in one phase rather than two.

---

## What else moved

| | Before | After |
|---|---|---|
| Commercials sub-tabs | 5 | **4**, matching the prototype |
| Tallest panel at 1240 | Deal Sheet, 4270px | Structural Terms, 3087px |
| Deal Sheet summary cards | 4 | **0**, all deleted |
| Task 3 at rest, 1240 | margin and contract net visible, matrix below fold | unchanged |

**No panel is now taller than the one removed**, which was the stated constraint.

---

## The reference panel was not built, and that corrects a decision

Round 38 decided that "Base cost data, per unit" would survive as a reference
panel, on the grounds that it was **"the only place a salesperson sees the rates
they are pricing against, because those rates are read-only and absent from the
input surface."**

**Measured in Phase 2, that premise is false:**

| Claim | Measured |
|---|---|
| The rates are absent from the input surface | **Present.** Six read-only rate inputs on Hw / Hosting Setup, four on Installation. |
| The card is the only place the batch and date appear | **`renderCatalogNotice` has printed "Rates from batch X, effective Y" on Hw since Round 36.** |

A fifth panel would have duplicated all of it. **What was genuinely missing is the
staleness band**, and that joined the notice that already names the date, from
`src/lib/cost-basis.js` - the approval page's own bands and words, one reader.
The catalog's `as_of` was being returned by the endpoint and discarded; it is now
kept, because staleness follows `as_of` and not today.

---

## A mistake, reported

**`frontend/.dev-session.json` was committed in Phase 2.** It is the signed-in
session copied where the dev server can serve it to the browser harness, and it
carries an access token and a refresh token. A `git add -A` took it because
nothing ignored it.

**Fixed rather than noted:** it is now in `.gitignore` beside `session-ref.json`,
the commit was rewritten to drop it, the `refs/original` backup was deleted and
the reflog expired, and **zero reachable commits carry it**. The branch had not
been pushed, so it never left this machine.

**The real fault was the ignore rule, not the `git add`.** The file is created
and deleted by hand on every browser run, which is exactly the kind of discipline
that eventually misses once.
