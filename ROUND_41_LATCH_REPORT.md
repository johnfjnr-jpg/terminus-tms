# Round 41 item 7: the latches, built

**Gate green at all five stages: 317/317 pure, 91/91 database, three HTTP
probes.** This is the round's last build.

---

## One thing to correct before the rest: rulings 1 and 2 could not both stand

**Ruling 1** made the Deal Sheet Summary never-latchable. **Ruling 2** put the
catalog flag on "section 4's latch button", reasoning that *latching the panel
must not silence the screen's only admission that it is pricing against an absent
catalog rate*.

**After ruling 1 there is no section 4 latch button for the flag to sit on.**

**What I built, and it is a judgement call stated rather than hidden.** Ruling 2's
CONCERN is untouched by ruling 1 and is still live: the notice lives inside the
detail panel, which is **closed by default**, so it can be silenced - just not by
a latch. The flag therefore rides **`Show detail`**, which ruling 1 itself names
as the summary's only collapse mechanism.

**One flag, panel level, no dependency map, exactly as ruled. Only its host
changed, and it changed to the control that actually does the hiding.** Correct
me and it is a one-line move.

### And the arithmetic differs by one

Ruling 1 says "seven latchable becomes six". My enumeration's seven counted the
**detail panel as its own panel**. Ruling 1 makes it part of the summary, so the
exemption removes **two** rows rather than one: **seven becomes five.**

Five latch buttons: Units Required, Installation, Structural Terms, Payment
Terms, Cash flow.

---

## The four rules, as built

| rule | as built |
|---|---|
| **1. On load everything is visible** | a `Set` in a module variable, deliberately not `localStorage`. **The storage choice is what makes rule 1 true rather than intended**: a preference that survives a reload is a state somebody inherits. |
| **2. The strip and the summary are never latchable** | **no latch at all**, not a disabled one. A disabled control is a thing you might enable. |
| **3. A latched-off panel signals what it hides** | panel level. Missing asks **both halves**: unset AND applies to this deal. |
| **4. Show/Hide All returns to everything visible** | implemented by **clearing** rather than restoring, so there is no remembered set in the code to return to by mistake. |

**Rule 3 only fires on a latched-OFF panel.** An open panel shows its own gaps,
and a marker on its button would be noise competing with the thing it points at.

---

## The signal, calibrated on the real screen

**The deal under test has every key recorded and no overrides, so its true
reading is silence.** `CLAUDE.md` Verification 9: a zero from an instrument never
shown reaching one is not a measurement. Each kind was made to fire and then
reverted.

```
CALIBRATION 1: a MISSING key, Structural Terms
  latched, everything recorded          silent
  latched, gstPct cleared             ● SIGNAL   "…is hidden and holds 1 value not recorded."
  latched, gstPct restored              silent

CALIBRATION 2: an OVERRIDE, Installation
  latched, no overrides                 silent
  latched, one margin override        ● SIGNAL   "…is hidden and holds 1 override."

CALIBRATION 3: the CATALOG flag, on Show detail
  detail closed, catalog clean          silent
  detail closed, bid currency SGD     ● SIGNAL   "The detail is hidden and holds a problem: Bid
                                                  Currency is SGD, and Base Cost Data is held in
                                                  USD. The costs below are USD figures and have
                                                  not been converted."
  detail OPEN, bid currency SGD         silent
  detail closed, restored               silent

CALIBRATION 4: silent by construction
  Units Required latched                silent   "…Nothing in it is missing or overridden."
  Cash flow latched                     silent
```

### Two faults the calibration found, both mine

**1. The flag stayed lit with the detail open.** `applyLatches` read the panel's
state, and `applyLatches` only runs on a recompute - **opening the detail
recomputes nothing.** The flag is now re-read from the toggle handler too.

**2. The sentence was a hardcoded claim about the wrong problem.** It said *"a
product is pricing against a rate that does not exist"* and appeared over a
**currency mismatch**. `renderCatalogNotice` reports three different problems and
the sentence named one. **Architecture 9's fourth variant**: a literal that cannot
be falsified by anything. The button now quotes the notice's own text.

---

## Two panels are silent by construction, and it is asserted

**Units Required and Cash flow** hold nothing that can be missing or overridden.
Unit counts sit outside `ZERO_IS_NOT_A_VALUE` on purpose, each reasoned
individually in the Phase 1 report, because **zero is a real answer to "how
many"**; Cash flow holds no inputs at all.

**They are visually identical to the other three**, per the ruling. The test
asserts **both directions**: the two named panels hold nothing that can signal,
and every panel NOT named holds something that can. A list naming the wrong two
fails.

---

## The claim under rule 3, measured rather than declared

**Every key that can be missing is claimed by exactly one panel.** All ten of
`ZERO_IS_NOT_A_VALUE`, partitioned, disjoint, exact in both directions.
`CLAUDE.md` Verification 19: the panel list is a category name, so the property is
measured. **A key nobody claims can never raise a signal, and the button that
should have carried it stays silent for a reason no reader can see.**

Four detectors calibrated by injection and reverted: removing a key from a panel
(the unclaimed check fires), giving a key to two panels (the disjoint check
fires), giving a "silent" panel a key (the silent-by-construction check fires),
and replacing `latched.clear()` with a loop that deletes the same ids (**rule 4's
check fires, because the rule is about there being nothing to remember, not about
the observable result**).

---

## Ruling 3, recorded

The absent-catalog-rate silence is on the deferred list in
`DESIGN_PRINCIPLES.md` **with its home attached**: the write side belongs to
Asset Management, batch receipts supplying hardware unit costs and contractor
per-unit agreements supplying installation rates, and the read-side disclosure
integration follows when that module's data exists. **This round ships only the
signal.**

---

## Where the evidence is

`.verify/findings/latched-{1240,1920}.png`. The calibration is reproducible from
the probe in the session scratchpad; the pure assertions are in
`scripts/tests/latches.test.mjs`, which is in the suite.

**The three task walks are the stopping condition and they are John's to run. No
tag lands on code completion.**
