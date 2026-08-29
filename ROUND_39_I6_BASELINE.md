# I6: the before half, captured before anything changed

2026-08-29, on `61ac7c4` / tag `controls-complete`, with the Commercials tab
untouched. **This cannot be taken later.**

**Every reading captured TWICE on the same unchanged tree and confirmed
identical** (Verification 6). `agree: true`, zero diffs, at all four viewports.

---

## The instrument, and why it was rebuilt mid-capture

The first version used `setTimeout` between steps. It ran at 1240 and then
**timed out at 45s at 1920, twice**. The pane was hidden, and a hidden tab
throttles timers to roughly one second each; ten waits became more than the tool
would allow.

**Rewritten with no timers at all.** A `classList` change and a `scrollTop`
assignment both take effect synchronously for `getBoundingClientRect`, which
forces layout. The instrument is now deterministic and about 200x faster, and it
reproduces itself at every width.

**Two earlier instrument faults are recorded in the Phase 0 report** and are the
reason this was done twice per width: a reading computed entirely from
zero-height hidden elements, and one that used `scrollIntoView({block:'center'})`
- a scroll position a person need not choose.

---

## The baseline

`minScroll` is the smallest scroll that brings the control into the box.
`marginInView` is whether the achieved-margin strip is still on screen there.
`gapPx` is the vertical distance from the strip to the control.

| Viewport | Loop: discount | | | Loop: term | | | Deal Summary at rest |
|---|---|---|---|---|---|---|---|
| | minScroll | margin visible | gap | minScroll | margin visible | gap | |
| **1240x700** | 447 | **yes** | 578 | 415 | **yes** | 546 | no |
| **1240x900** | 247 | **yes** | 578 | 215 | **yes** | 546 | no |
| **1920x900** | 210 | **yes** | 578 | 178 | **yes** | 546 | yes |
| **3440x900** | 173 | **yes** | 578 | 141 | **yes** | 546 | yes |

**The gap is 578px and 546px at every width**, which is expected for a vertical
distance and confirms the instrument is measuring what it claims.

**The margin is visible at minimum scroll in all four.** Falsification test 1
holds at every size tested, not only the one it was found at.

**The Deal Summary matrix is below the fold at 1240 and above it at 1920.**

### Panel heights, in the scroll box

| Panel | 1240 | 1920 | 3440 |
|---|---|---|---|
| Hw / Hosting Setup | 2037 | 1624 | 1587 |
| Installation | 1778 | 1709 | 1672 |
| Structural Terms | 1828 | 1383 | 1346 |
| Payment Terms | 2259 | 2222 | 2185 |
| **Deal Sheet** | **4270** | **3172** | **2892** |

**The Deal Sheet is the tallest panel by a wide margin at every width**, roughly
double Structural Terms at 1240. It is also the one being removed.

### Task 1 entry, and the switches it costs

| Step | Field | Sub-tab |
|---|---|---|
| units | `deal-ssExisting` | hw |
| mounting | `deal-installResp` | install |
| term | `deal-duration` | **payment** |

**3 distinct sub-tabs for entry.** The loop that follows costs 0 switches for
discount and 1 for term.

---

## What the after-capture must show

Re-run the same instrument at the same four viewports, twice each, and confirm
`agree: true` before comparing anything.

**The figures this round is trying to move:**

| | Before | Target |
|---|---|---|
| Discount loop gap | 578px | the local margin figure beside the control |
| Term loop gap | 546px | same, once `duration` moves |
| Task 1 entry switches | 3 | fewer, once `duration` leaves Payment Terms |
| Deal Summary at rest, 1240 | below the fold | unchanged is acceptable; it serves task 3 |

**And the figures that must not get worse:** `marginInView` stays true at every
viewport including 1240x700, and no panel grows taller than the Deal Sheet's
4270 that it replaces.
