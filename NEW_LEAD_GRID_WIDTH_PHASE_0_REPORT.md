# New Lead grid width: Phase 0 report

Measured 2026-09-13 on `5965f44`, live DOM at 1240, 1920 and 3440, with
screenshots. Nothing was changed.

---

## THE HEADLINE: ONE OF THE THREE CLAIMS COULD NOT BE MEASURED AT ALL, AND FINDING THAT OUT WAS THE PHASE'S REAL WORK

**Claim (b) - is a scroll bar VISIBLE - has no working instrument in this
environment**, and my first pass produced a confident `0px` that meant
nothing. It is recorded first because it is the thing that would have
repeated Round A's fault in a new costume.

---

## (a) NEAR-FULL-WIDTH AND COLUMNS VISIBLE - the defect is confirmed and it is worst where the screen is biggest

| viewport | modal width | % of viewport | columns fully visible | last visible |
|---|---|---|---|---|
| 1240 | 1116px | **90%** | **4 of 15** | Industry |
| 1920 | 1480px | **77%** | **6 of 15** | Mobile |
| 3440 | 1480px | **43%** | **6 of 15** | Mobile |

A column counts only when its WHOLE width lies inside the scroll
container's viewport. A half-cut column is not readable, and counting it
would be the proxy this round exists to remove.

**The mechanism, from the stylesheet and confirmed by the numbers.**
`.modal-panel` is `width: 90%`, and `.modal-panel-batch` caps it at
`min(1480px, 96vw)`. **The 1480px cap binds at 1920 and again at 3440**, so
the modal stops growing: at 3440 it occupies 43% of the screen and the other
57% is empty. The table is `min-width: 3500px` (15 columns at
`min-width: 230px`), so 3500px of content sits in a 1430px window.

**This is exactly what the walk reported** - `p0-page-3440.png` shows a
narrow box floating in a vast page, the columns cut at "LEA...", and dead
space either side.

## (b) THE SCROLL BAR - the defect is real, but my first instrument was blind

**The first pass measured `offsetHeight - clientHeight` and read 0px at all
three widths.** That reads exactly like "there is no scroll bar", which is
the answer I wanted, and it was not a measurement.

**Calibration killed it.** Injecting `::-webkit-scrollbar { height: 14px }`
into the live page and re-measuring returned **0px again**. A calibration
that does not move the number has failed to run rather than passed
(Verification 18).

**A second round of candidates, on a self-contained page so nothing about
the application could be blamed:**

| browser | plain `overflow-x: scroll` | with `::-webkit-scrollbar 14px` | pixels differ |
|---|---|---|---|
| headless `new` | 0px | **0px** | **no** |
| **headed** | 0px | **14px** | **yes** |

> **HEADLESS CHROME RENDERS NO SCROLLBAR AT ALL, BY ANY MEASURE TRIED -
> layout gutter OR pixels.** Every scrollbar reading this estate has ever
> taken headless has been blind, and would have returned the same 0 whether
> the fix worked or not.

**With a headed browser the mechanism is settled:** an unstyled container
gets the macOS **OVERLAY** scrollbar, which has **zero layout height and
paints nothing until you scroll**; styling `::-webkit-scrollbar` forces a
classic bar with real layout AND visible pixels (`bar-false-styled.png`
shows the thumb). `scrollbar-color` and `scrollbar-width` moved nothing and
are not the remedy here.

**`.modal-panel` carries `::-webkit-scrollbar` rules. `.new-lead-scroll`
does not.** That one asymmetry is the whole of claim (b).

**Consequence for Phase 1: claim (b) is measured HEADED or not at all.**

## (c) THE FIRST COLUMN - not reproduced on a first open, REPRODUCED on a reopen

On a **first** open, at every width: `scrollLeft = 0` and NAME fully
visible. The walk's report did not reproduce, and I nearly filed it as
not-live.

**On a REOPEN it reproduces exactly:**

```
first open                  scrollLeft 0
scrolled to 1400            first visible = source,  NAME visible false
closed, REOPENED            scrollLeft 1400, first visible = source, NAME visible false
```

**The mechanism is one missing axis.** `openNewLeadModal` only removes
`hidden`, so the modal persists in the DOM between opens, and
`NewLeadGrid`'s reset block is:

```js
if (scrollRef.current) scrollRef.current.scrollTop = 0
```

`scrollTop`, and **not `scrollLeft`**. Tab across to Mobile, close, reopen,
and you land where you left - which is the "starts at Mobile" the walk
described.

---

## WHY ROUND A PASSED, READ FROM ITS PROBE RATHER THAN INHERITED

Round A's probe is better built than the brief's summary suggests, and that
is what makes it worth recording.

It measured `hScrolls: scroll.scrollWidth > scroll.clientWidth` - the
property. It also asserted **"the scroll position RESETS on reopen"**, and
**guarded that assertion against vacuity**:

```js
check(setTo > 0, 'the scroll could actually be moved (so the reset claim is not vacuous)')
check(onReopen === 0, 'the scroll position RESETS on reopen')
```

That is careful work. **Both lines read `scrollTop`. The probe contains the
string `scrollLeft` zero times.**

> **The assertion was correct, calibrated, non-vacuous, and pointed at the
> ONE AXIS WHERE THE COMPONENT ACTUALLY DOES THE WORK.** The axis carrying
> 3500px of content was never asked about.

**"The scroll position resets" reads as one claim and is two**, because
scroll is two-dimensional. The component resets one of them, the probe
tested that one, and everything agreed.

This is a candidate promotion and it is offered as a finding rather than
minted here: a measure can be correct, calibrated and non-vacuous, and still
be pointed at the wrong AXIS of a property that has more than one.

---

## WHAT R1 TOUCHES

- **`.modal-panel-batch` has exactly ONE surface**: `#new-contact-form` in
  `frontend/index.html:148`. Two probes use it as a selector; neither
  asserts a width. So widening it reaches the New Lead modal and nothing
  else.
- **`.modal-panel` is shared by eleven surfaces** and must not move.
- **The panel conformance gate does NOT govern this modal.** The New Lead
  grid emits no `data-panel`, and the gate's modal rule forbids `leads/`
  hand-rolling a `modal-backdrop` in React - this backdrop is the shell's
  own vanilla markup.
- **Nothing anywhere asserts the 1480 cap or the 3500 min-width.** The only
  `3500` hits in the suites are in `rate-resolution.test.mjs` and are an
  unrelated numeric coincidence, which is its own small warning about
  grepping for a bare number.

---

## What this phase does NOT establish

- **Nothing about what John's real Chrome renders.** The headed calibration
  ran on this machine's Chrome and settles the MECHANISM; whether the fix
  looks right to him is the walk.
- **No claim that headless-measured layout numbers are wrong.** Widths,
  column counts and `scrollLeft` all agreed headless and are unaffected.
  **It is scrollbars specifically that headless cannot see.**
- Whether any OTHER scroll surface in the estate has the same invisible
  overlay bar. Not measured, and not this round's scope.
