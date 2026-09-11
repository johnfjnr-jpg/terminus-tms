# Leads, P4: the Leads List redesign

**15/15 on the list, 8/8 on the graduation, verified live after a rebuild.**
pure 512/512, react 939/939, database 100/100. **Nothing pushed.**

**R9 and R10 ruled at the close and now built, recorded and proven** - see
section 6.

---

## 1. Built in React, and the reason is reuse

The card needs **notes with an expand control** and an **inline follow-up
task**, and both already exist as components the Lead detail screen uses.
Rebuilding either in vanilla would be **two implementations of one behaviour** -
and the notes model has been ruled on twice in this round alone.

`app.js` delegates. The shell keeps the page-head, the Mine toggle and the New
lead button; **React owns only `#live-leads-rows`.** Taking the whole
`#view-leads` container would have cleared it on first render - `createRoot`
does - taking the toggle and the New lead button with it, which is the fault
recorded against the first React approval view.

> **The mount is `mountLeadsList`, not `renderLeadsCards`, and that is not
> cosmetic.** `app.js` declares `function renderLeadsCards()` at top level, a
> top-level declaration in a classic script **is** a window property, and
> `app.js` loads **after** the bundle. The vanilla would have overwritten the
> registration and the delegation would have called itself. Verification 41
> records that exact collision costing a live walk. Caught before it ran.

**The groups are read, not typed:** `stage_definitions` ordered by `sort_order`,
so a stage relabelled or reordered by migration moves here without an edit -
which is what happened to Parked/Nurture three phases ago. Newest first within
each group.

---

## 2. The layout, verified

```
grouped by status                                      PASS
the lead name is 14px and green                        PASS
company, source and created date beneath the name      PASS
the status badge is on the card                        PASS
Summary, Notes and Follow-up SHARE ONE ROW             3 columns, one top
no Qualify / Nurture / Save / Discard / Delete / Unqualify on the card
notes default to the latest 2                          "Showing 2 of 5"
clicking the NOTES region does not navigate            PASS
clicking the card elsewhere OPENS the lead             PASS
```

**"Three columns" is asserted as sharing one row**, not counted - the Test Bed
lesson: a count cannot see a wrap.

---

## 3. THE DOOR, PER CARD - the new ground

Every doored surface before this was a **detail view**: one record, one owner,
one answer for the whole screen. **A list cannot answer "is this view mine".**

`applyReadOnlyControls` now takes a **root element** as well as a view id, so a
card passes its own element and its own answer. The alternative was a second
sweep for cards - and that rule is long, subtle, and has already been wrong
twice in ways that took a live walk to find.

```
control                mine                 not mine
addNote                1 present, 1 live    1 present, 0 live
followUpDate           1 present, 1 live    1 present, 0 live
followUpDescription    1 present, 1 live    1 present, 0 live
```

with the unowned card **still navigable** (`tabIndex 0`) and its **notes expand
controls alive**.

### The door had killed the expand controls - P3's lesson, on the list

**0 live of 3 present** on an unowned card, so a person who may not edit a lead
**could not expand its notes to read them.**

Fixed with **`aria-controls`**, which is the *true* statement about those
buttons - they control that region - where `aria-expanded` would have been a
lie: it is a boolean and this is a three-rung selector.

> **Measured before adding the exemption:** every existing user of
> `aria-controls` in this estate **also carries `aria-expanded`** and was
> therefore already exempt. So this widens the read-affordance category by
> **exactly the control it was added for**, not by an unknown set.

---

## 4. Three faults of mine, all found by instruments

**A claim true by absence.** The first run gave notes only to the **owned**
card, then asserted the unowned card's expand control stays alive. It failed -
correctly, and for the wrong reason: **there were no notes, so there was no
control to keep alive.** Verification 14's clause, and it would have "passed"
the moment somebody loosened the assertion. Both cards get notes now, and the
assertion requires the control to **exist** before asking whether it is live.

**The probe died on its own fixture.** It patched the handed-away record
**after** handing it over, and the ownership guard refused it **403** - the
guard this probe exists to measure, working.

**It looked like a P3 regression and was not.** The P3 layout probe used
document-wide selectors, which passed for three phases because only one screen
rendered `NotesHistory`. P4's list renders the **same component**, its React
root stays mounted after navigating away, and a hidden card's notes answered
first: **22 note rows counted where the record has 6**.

> **Two screens sharing a component share its testids, which is correct. The
> probe is what has to say which screen it means.** Every lookup in that probe
> is scoped to `#view-contact-detail` now, and it is back to 13/13.

---

## 5. A stale string R1 missed, found by opening the screenshot

The Leads page subtitle still read **"Unqualified through Parked"** three
phases after R1 relabelled the status. Two more mentions in comments.

**Nothing could have caught it.** It is prose - not derived from the status, not
asserted by any test, and `git log -S` on it returns the commit that wrote it
and nothing since. Architecture 9's fourth variant: a hardcoded claim with a
shelf life. **Corrected, with the relabel dated at each site.**

This is the second time in this round that opening a screenshot found what
every assertion passed over.

---

## What P4 does NOT establish

- **Both open questions were ruled and are closed** - section 6. Leads and
  Contacts do **not** overlap, and empty headings **are** shown.
- **`renderLeadsCardsVanilla` is dead code with a date on it**, left for one
  round as the revert path. It is named here so it is removed rather than
  forgotten.
- **The follow-up task saves on its own control**, as ruled - but so does the
  detail screen's, and the detail screen also has a header Save. Two save
  controls on one screen is worth settling.
- **No gate run.** That is the round close.
- **P5 remains blocked on its mockup.**

---

## 6. R9 and R10, ruled and closed

### R9 - qualification is GRADUATION

Recorded in the brief **and** `DESIGN_PRINCIPLES.md` as a product rule, because
it defines what the screen **is** rather than filtering it:

> **The Leads screen shows Unqualified and Nurture only. On qualification a
> lead graduates off the Leads pipeline and is worked as a Contact.**

So the two screens do **not** overlap, which the earlier three-group layout
would have made them do.

**The pipeline is a named set; the order is not.** *Which stages are still
being worked* is a product decision - nothing in `stage_definitions` carries
it, and inferring it as "everything except Qualified" would silently adopt
whatever a future migration adds. The **order** still comes from configuration,
so a relabel or reorder moves without an edit.

> **And the set is checked against configuration, which the `Parked` relabel
> earned.** A named set that quietly stops matching anything **empties this
> screen with no error**, and an empty pipeline reads exactly like "no leads
> right now". The list renders a visible mismatch warning when a pipeline name
> is not a configured stage.

### R10 - empty stage headings are shown

`Nurture 0`. A pipeline scan benefits from seeing a stage is empty; a missing
heading is not information.

### Proven by MEMBERSHIP, not by an absent heading

One record followed **by id across both screens**, before and after:

```
PASS  BEFORE: the Unqualified lead IS on the Leads screen
PASS  BEFORE: and is NOT on Contacts
PASS  the lead is Qualified in the database
PASS  AFTER: the Qualified lead has LEFT the Leads screen
PASS  AFTER: and it appears on Contacts
PASS  the Leads screen shows ONLY Unqualified and Nurture
PASS  empty stage headings are SHOWN
PASS  no stage-mismatch warning                             8/8
```

**The BEFORE half is what makes the AFTER half mean anything.** "Not on Leads"
is equally true of a record that never arrived, of a screen that rendered no
groups, and of a fetch that failed.

### And the first run reported R9 unbuilt when it was built

The probe waited on `[data-testid="leads-list"]`, **which exists from the
previous visit** - so it read the old data and the qualified lead still looked
present. Verification 7: state the counterfactual, and wait on something the
old state cannot satisfy.

**Fixed at the source rather than with a delay.** The list publishes
`data-fetch`, a completed-fetch counter, and the probe waits for it to
**change**. The Contacts grid has no such counter, so that half polls for the
name within a bound and never on a bare sleep.
