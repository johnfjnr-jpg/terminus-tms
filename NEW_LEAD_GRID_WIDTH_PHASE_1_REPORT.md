# New Lead grid width: Phase 1 report

Built and proven 2026-09-13. Every measurement HEADED, because Phase 0
proved headless Chrome cannot see a scrollbar by any instrument.

---

## The three claims, as outcomes

### (a) NEAR-FULL-WIDTH, AND MORE COLUMNS READABLE

| viewport | modal before | modal after | columns before | columns after |
|---|---|---|---|---|
| 1240 | 1116px / 90% | **1178px / 95%** | 4 of 15 | **4 of 15** |
| 1920 | 1480px / 77% | **1824px / 95%** | 6 of 15 | **7 of 15** |
| 3440 | 1480px / 43% | **3268px / 95%** | 6 of 15 | **13 of 15** |

`.modal-panel-batch` now sets `width: 95vw` AND `max-width: 95vw`.

**Both were needed and that is worth recording.** `.modal-panel` is
`width: 90%`, so raising only the cap would have left 90% as the binding
rule: the number would have moved and the outcome would not have arrived.

**`.modal-panel` is untouched** (R5). The rule changed has exactly one
surface.

### (b) A VISIBLE SCROLL BAR THAT MOVES THE COLUMNS

`.new-lead-scroll` now carries `::-webkit-scrollbar` rules. That asymmetry
with `.modal-panel` was the whole of the defect.

- **12px of real rendered layout**, where the unstyled container had 0.
- **It paints pixels**: the page differs with the bar suppressed, content
  held constant, and the suppression is proven to have taken before the
  comparison is read.
- **It moves the columns**: leftmost goes `name` to `linkedin`.
- **It survives scrolling** - 12px after, so it is not a transient overlay.
- Visible in `p1-scrolled-1240.png` as a grey thumb in a darker track.

`scrollbar-color` and `scrollbar-width` were tried first and moved nothing
in this browser. They are not the remedy and are not used.

### (c) NAME REACHABLE, INCLUDING AFTER A REOPEN

```
scrolled to 1500     first visible linkedin, NAME off-screen   <- setup proven real
closed and REOPENED  scrollLeft 0, first visible name          <- NAME back
```

One line, and it is the line Round A's probe never asked about:

```js
scrollRef.current.scrollTop = 0
scrollRef.current.scrollLeft = 0   // added
```

---

## THE STATED LIMIT, ASSERTED RATHER THAN GLOSSED

**1920 shows 7 of 15, which is not "most".** The arithmetic, not the
implementation: 15 columns at a 230px minimum is about 3450px of content,
and 1920 at 95% gives 1824px. **No modal width can fit all 15 at 1920.**

This is asserted in the probe as a known state, so it fails loudly if it
ever changes rather than being forgotten:

```
PASS  (a) STATED LIMIT: 1920 cannot show MOST of 15
      7 of 15; all 15 needs ~3450px, 1920 gives 1824px
```

**The available lever was narrowing the columns, and it was NOT taken.**
Round A widened cells to 230px because they cropped, and Round B's close
records the measurement behind it: a real 32-character account name needs
208px. Narrowing them to fit 1920 would undo a measured readability
requirement to satisfy a column count. **That is a trade for John, not an
implementation decision**, and the option is per-column widths - Postcode
and Region do not need what Company Name and Email need.

**At 1920 the answer is R2**: 7 columns readable and a real bar for the
rest. At 3440 it is R1: 13 of 15 with no scrolling needed.

---

## THREE BLIND INSTRUMENTS, AND ONE OF THEM WAS MINE THIS PHASE

Phase 0 found two. This phase found a third, in my own probe.

| instrument | with a bar | without | discriminates |
|---|---|---|---|
| headless layout gutter | 0px | 0px | **no** |
| headless pixels | same | same | **no** |
| **headed ELEMENT screenshot** | same | same | **no** |
| headed layout gutter | 12px | 0px | yes |
| headed PAGE screenshot | differs | differs | yes |

**The third one actively destroyed the measurement.** Puppeteer suppresses
the scrollbar to take an element capture and does not put it back:

```
fresh open                                   gutter  12px
after scrollLeft = 1500                      gutter  12px
after an ELEMENT screenshot of the container gutter   0px   <-
after a PAGE screenshot                      gutter   0px
```

My first draft photographed the container and then measured it, so every
reading after the capture was of a scrollbar the instrument had removed -
**and the pixel comparison then PASSED on a difference that had nothing to
do with the bar.**

**It was caught by a guard I had added for a different reason**: after the
element-capture comparison came back byte-identical, I asserted that the
suppression had genuinely taken before reading its result (Verification 14,
a comparison with nothing on either side). That guard read `12px -> 0px`
and instead reported `0px -> 0px`, which is how the real cause surfaced.

**The rule this phase followed as a result: measure first, capture second,
and never photograph the element whose geometry is the claim.**

---

## Calibration: 3 of 3 fired, 0 silent

One injection per claim, on the real files, anchored on WHICH check failed
rather than on the exit code.

| injection | claim it should kill | verdict |
|---|---|---|
| the 1480px cap restored | (a) near-full-width at 3440 | **FIRED**, 5 checks failed |
| the scrollbar height removed | (b) real rendered height | **FIRED**, 3 checks failed |
| `scrollLeft = 0` removed | (c) NAME after the reopen | **FIRED**, 2 checks failed |

`baseline 0 failures, 30521ms` ... `reverted run: 0 failures, 38309ms`,
both files byte-identical to their snapshots. Durations are all within the
run's own normal band, so no injection was scored on a run that did not
happen (Verification 48).

**The third injection is the one worth naming: it recreates Round A's exact
blind spot.** Removing `scrollLeft = 0` leaves `scrollTop = 0` in place -
the state Round A shipped, asserted, and passed - and the probe now goes
red on it.

---

## What this does NOT establish

- **Nothing about John's own Chrome.** The headed browser here settles the
  mechanism and the layout; whether it reads well is the walk.
- **Nothing about other scroll surfaces in the estate.** If `.new-lead-scroll`
  had an invisible overlay bar, others may too. Not measured, not scoped.
- **No claim that 1920 is solved.** 7 of 15, stated above.
