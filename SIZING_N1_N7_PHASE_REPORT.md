# Sizing standard: N1 and N7, the instrument rebuilt and the shape question

Branch `sizing-standard`, commit `75aa5fc`. Nothing merged, nothing pushed.

---

## WHAT IS NOT BUILT, FIRST

**N1 and N7 are not built.** Both are now ASSERTED and both are RED, which is
the opposite of the demotion this phase was sent to reverse, and it is not the
same as being built.

They stop on one ruling, stated at the end of this report. It is one question
rather than three, and answering it settles all three coherently. Building them
separately risks three different answers to the same question.

---

## WHAT WAS BUILT

The instrument, in one commit, `75aa5fc`.

**The run emits its own numbers to a file.** Every line the probe prints is
teed into `.verify/sizing/live-run.txt`, written in a `catch`/`finally` so a run
that throws still leaves what it measured, and the file states how many states
it reached so a partial run cannot be read as a complete one. The previous run
of this probe produced nine screenshots and a pass count that existed nowhere on
disk.

**The row classes are read from the components, and the guess was wrong twice.**
`YearScheduleView` renders TWO row classes: `.ds-row` when the schedule kind is
`hybrid`, and `.ys-line` otherwise. Correcting the hybrid slot left the OPEX
slot reporting "yearly not found", a miss that reads as a measurement. Two of
the four classes in the original selector match NOTHING in the estate:
`.ys-row` is in the stylesheet and in no markup, and `.opex-row` is in neither,
so the OPEX per-unit row was only ever found by the `tbody tr` fallback. Each
class now names its renderer at the site.

**N1 pairs the tops row by row** rather than checking a first row and a pitch.
Equal pitch is a proxy and it would have passed two of the three widths the
claim fails: at 1920 the pitches differ, 68 against 53, and at 1440 they do not,
while the rows are out at every width. Product rows are identified by CARRYING a
units cell rather than by position, so the install total row is excluded
structurally and the pairing survives a row being added.

**N7's subjects are asserted to exist** before they are compared. The comparison
is still guarded, but absence now fails on its own line first, so the guard
cannot hide anything.

---

## EVIDENCE

Captured run, all nine states, from the file the run wrote:

```
sizing live probe   2026-09-26T06:26:06.345Z
widths 1920, 1440, 1240   combos capex/twoPhase, capex/hybrid, opex/twoPhase
states completed: 9 of 9
108 of 123 checks passed
RUN COMPLETE
```

Fifteen failures, and they account exactly: nine N1, three N7 Hybrid, three
N7 OPEX.

```
N1 offsets, install minus unit, per row
  1920    64, 49, 33, 34      the rows CONVERGE, so the row heights differ too
  1440    80, 81, 66, 82
  1240   127, 128, 129, 145
N7 Hybrid    67px at all three widths
N7 OPEX     -12px at all three widths, NEVER MEASURED BEFORE
```

**The selector fix is calibrated by contrast rather than by assertion.** The
existence checks now read "found" where the same checks on the same states read
NOT FOUND before the fix. That is the instrument shown producing both readings
on the system under test.

**The screenshot was opened and read**, `live-1440-capex-hybrid.png`. Both
defects are visible: the Units rows sit high against the Installation rows, and
"Hosting, annual in advance" with Year 1 starts well above the milestone grid's
first row.

**What each offset is made of**, measured live at 1440 rather than inferred
from CSS:

```
OPEX, -12px       both columns start at 2279.8
  table thead        20.0px tall            body at 2299.8
  year head stack    32.25px                body at 2312.0
                     label margin-top 10.5 + 15.75 + margin-bottom 6

HYBRID, 67px      both columns start at 2302.8
  left    label, field-note (34.5 + 11.5 margins), .ms-grid-head (13.5 + 6)
          body at 2406.1
  right   label only                        body at 2339.1
```

---

## THE RULING NEEDED, AND IT IS ONE QUESTION

All three findings reduce to: **how do two side-by-side row lists come to share
row tracks.** The construction that levels them without inventing copy or
changing type is to put the two columns' heads in ONE shared row track, so the
body track starts after the taller of the two and both bodies are level by
construction.

For N7 Hybrid that requires the right column's label to be a grid item, which
means moving it out of `YearScheduleView` into the grid in `section5.tsx`. No
new copy: the text is `schedule.label`, already rendered. `display: contents` on
the wrapper is NOT available, because the probe measures
`[data-testid="hybrid-schedule"]` as a BOX for N6, and removing its box would
break N6.

**For N1 the same construction requires the Installation per-unit table to stop
being a `<table>`**, because a real table cannot participate in a parent's row
tracks. That is what "in the same dress" implies, and it is the ruling:

| option | what it costs | what it buys |
|---|---|---|
| **A. one per-product row grid across both columns** | `#deal-units-card` and `#deal-install-table` merge; the responsibility and lump-sum block relocates above both columns; the identity ratchet, class rules, wiring, panel conformance and the probe's own selector all re-point | alignment is structural and permanent, and the two lists are literally one grid, one row per product |
| **B. subgrid, two DOM lists sharing tracks** | the install table still stops being a `<table>`; same guards fire; the responsibility block still needs its own track | keeps the two panels as separate DOM |
| **C. equalise the preambles with a spacer** | cheap | REJECTED. It fails at 1920, where the per-row offsets converge from 64 to 34, proving the row HEIGHTS differ and not just the start. It is also a literal of exactly the kind S1 retired this round |

**Recommendation: A.** The four products are the same four in the same order in
both lists, `UNIT_FIELDS` and `INSTALL_ROWS`, so they are two halves of one
per-product table and the merge is what the data already says. B pays nearly the
same blast radius for a structure that still has two owners of one row.

**Twenty-eight assertions across seven test files touch these subjects**, and
`#deal-hybrid-group`'s grid carries ruled numbers from the prototype, W13,
2026-09-20. Each re-point is a departure that needs its reasoning recorded, in
the way the payment polish round re-pointed four estate guards.

---

## FINDINGS

1. **THERE IS NO BRIEF FOR THIS ROUND IN THE REPOSITORY.** Every recent round
   opens with a committed `*_BRIEF.md`, "The brief, John's rulings verbatim".
   This round's only commit, `18d977f`, added none, and there is none tracked,
   untracked or stashed. So the stop rule "a constraint the brief does not
   cover" has no document to test against, and the definitions built to are the
   ones given in conversation. Reported, not resolved.

2. **N7's OPEX half was never a "not built" finding.** It is a 12px defect that
   was invisible because the selector matched nothing. It has been present at
   all three widths the whole time.

3. **Two phantom classes in the estate.** `.ys-row` is in the stylesheet and in
   no markup. `.opex-row` is in neither.

4. **Environment, not findings.** Puppeteer is not a dependency and resolves
   from a scratch install: the first run failed in 0.2s with the loader's own
   message until `PUPPETEER_PATH` was set. No dev server was running at the
   start of this phase; the two noted in the previous round's report are gone.
   One was started and the probe ran against it.

---

## WHAT THIS DOES NOT ESTABLISH

The 108 of 123 says nothing about N1 or N7 being correct, only that the other
claims hold while they are wrong. The `-12px` and `67px` are measurements of a
defect, not of a fix. And the recommendation above is a position on shape, not a
measurement that option A reads better than option B on screen: nothing has been
built either way.
