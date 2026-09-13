# UI STANDARDS - LEADS, Phase 1: the build

Committed at `16c0a37`. Suites, read by exit code: **pure 537/537, react
975/975, database 100/100.** Conformance gate **calibrated 8 of 8**,
reverted tree byte-identical. Live measurement at **1240 / 1920 / 3440**.

---

## What is NOT in this phase

**Nothing that was ruled in.** R1, R2, R3 and every Phase 1 item landed.
R2 is a note by ruling, not a fix.

---

## 1. The measurement, before and after

The **same probe**, the **same claims**, run against both trees.

| | Phase 0 | Phase 1 |
|---|---|---|
| **Section 4** (focus trap) | **0 of 6** | **8 of 8** |
| **Section 5** (unsaved changes) | **1 of 3** | **4 of 4** |
| the principle | 5 of 7 | 5 of 7 |
| save placements **among the panels S1 governs** | 3 | **1** |
| unclassed controls on the card | 10 | **3**, all the frozen panel |
| undefined CSS vars | 2 | **0** |

**Section 4 went from nothing to everything** because it is now one
component rather than a convention two dialogues each had to remember.

### S1 and S3, at three widths

| width | Summary on the header line | right gap | field vs header |
|---|---|---|---|
| 1240 | yes | **0px** | **0px** |
| 1920 | yes | **0px** | **0px** |
| 3440 | yes | **0px** | **0px** |

Asserted as **relationships** - save-vs-panel-right, field-vs-header-left -
never a property of one element.

---

## 2. What was built

**`Panel`, `PanelHeader`, `SaveControl`** in `frontend-react/src/ui/`. A
Panel renders its own header and takes actions **only** through the
header's slot, so a panel cannot place its Save below its field: **it has
nowhere to put it.** The registry is `data-panel`, emitted by the shell,
so a panel joins the census by existing.

**`Modal`**, carrying John's footer shape **and Sections 4 and 5 inside
it**. The footer is a **render function taking `requestClose`**, which
makes the dismiss control and the Escape key the same function - two paths
out of one dialogue is how Phase 0 found Escape doing nothing while Close
discarded silently.

**Two gates.** `panel-conformance.test.mjs`, seven structural checks in
the pure suite. `standards-staleness.test.mjs`, which fails when the
document cites a name the code no longer has.

**The document.** Section 0 is the governing principle, placed above the
numbered sections because it is what several of them turn out to be
saying. Section 12 is its panel-scope expression in Part two's style, and
is **the first section of this document a commit can fail.**

---

## 3. The document's rot, reconciled - and the correction is sharper than the finding

Phase 0 read this as migration rot. **It is not.**

**Section 5's Park examples named `contact-detail.js`, which the migration
retired - but Park MOVED INTACT into `ParkForm.tsx`**, with Escape, Tab
cycling and the backdrop refusal all present.

> **The standard survived the migration. What it did not survive was being
> built AFTERWARDS.** The lead card's dialogues came later, built by people
> reading the screen, and nothing existed that could have told them.

**That is drift, not rot, and it changes what the fix must protect
against.** A document cannot stop drift. A gate can.

**The staleness check found a real one on its first run**: the prototype
was cited under a filename that resolves to nothing, **in the paragraph
explaining why this document is trustworthy.**

---

## 4. Decisions taken, for overturning

1. **"One button treatment" was scoped to PANELS.** S5 says "one button
   treatment across panels", so panel actions are all `.btn-sm` and **the
   record bar keeps `btn-primary` against `btn-ghost`** - Section 10
   records that distinction as deliberate, and Verification 23 says search
   for the existing decision before taking a new one.
2. **`SaveControl` takes explicit testids** rather than deriving them.
   Deriving would have renamed `lead-summary-save`, which **six probe
   files across four rounds** address by name; they would have failed as
   timeouts that read like product defects.
3. **The account picker's Create is C3's shape, not S1's.** It sits beside
   its input because that is last round's ruled convention for a
   create-from-input control. The probe classifies it as a second
   placement and it is reported as such rather than reclassified - **I
   adjusted the classifier once, for the modal shape the ruling already
   named, and stopped there.**
4. **The modal classifier change.** The probe called a ruled footer "below
   the field", reporting the two dialogues as violations for obeying the
   convention they were told to obey. Corrected; the raw five-placement
   count is still printed beside the governed one.

---

## 5. What surprised

**THE LIVE PROBE CAUGHT A REGRESSION I INTRODUCED, and the unit tests
could not have.**

`Modal` dropped the backdrop's `stopPropagation`. The popup it replaced
carried it **without saying why**. The lead card is itself a click target
that navigates, so a backdrop click bubbled to the card and opened the
record - **the modal's refusal was working perfectly, and the view it was
rendered into had been hidden underneath it.**

**It presented as the refusal failing.** Found by measuring the **ancestor
chain** after the probe reported a plainly-visible 1920x1200 backdrop as
invisible: `#view-leads` at `display: none`.

**A `position: fixed` element inside a `display: none` subtree reports its
own `display` as `flex` and a rect of 0x0**, which is why the computed-style
check said invisible and the presence check said present. The two
disagreeing is what pointed at the ancestor.

### And three harness faults, each the estate's own recorded shape

- **A visibility helper passed as a STRING** to `page.evaluate` reported a
  1920x1200 element as invisible. Passed as a **function**, it was right.
- **The calibration harness's own source satisfied the staleness scan**
  with the name it injects, so that injection came back SILENT.
  Verification 39's Round 8 remedy applied: assemble the string from
  parts, name it nowhere.
- **A non-unique anchor**, which the harness refused to guess at rather
  than injecting into the wrong one of two sites.

### And four build faults before that

A JSX comment **between attributes** that `tsc --noEmit` accepts and the
bundler rejects - the typecheck passed and 33 tests failed on a parse
error in an unrelated file. A `className` beside a spread that **would
have overwritten `.field-blocked`**, the qualification gate's own
highlight, caught by TypeScript. A focus trap depending on `offsetParent`,
which jsdom has no layout to provide. And an unguarded `scrollIntoView`
that threw **outside any assertion**, so the suite printed **975 passed
and exited 1** - I read the count, the hook read the exit code.

---

## 6. What this does NOT establish

- **No walk.** Every claim here is a probe or a screenshot.
- **`NotesHistory`'s frozen consumers were not exercised live.** Their
  evidence is the unit test asserting that without `title` nothing
  changes - `data-panel` absent, `panel-head` absent.
- **Sections 1, 2 and 3 remain unmeasured** against the card.
- **The conformance gate is structural only.** S1's right-alignment and
  S3's alignment are geometry, verified by probe at three widths but
  **not yet a gate stage**; making them one needs the live probe promoted
  into the HTTP slot.
- **The carried migration pass is untouched**, and `deal/section4.tsx`'s
  broken `aria-controls` is still the first evidence that the rot reaches
  Sections 6 to 11's surfaces. The conformance check is deliberately
  scoped to Leads so it does not fail the gate on work this round was told
  not to do.

---

## 7. Carried, unchanged

The **migration-conformance pass** over Sections 6 to 11's surfaces, and
the queue items from prior rounds. **Plus one new observation**: the
database suite refused two commits this round on concurrent writes, at
**10s connect timeouts** and then **60s statement timeouts**, both clearing
after a pause. Recorded as environment and **distinct from F8**, which
loses one connection of forty at wandering durations.
