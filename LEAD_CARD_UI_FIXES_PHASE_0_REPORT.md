# LEAD CARD UI FIXES, Phase 0: measurement

Read-only. No source, schema or policy changed. Four probes under
`scripts/lead-card-ui/`, captures in `.verify/lcuf/`, logs in
`.verify/lcuf-p0*.log`. `check-dist-fresh.mjs` PASS before every live
read; the API server was not restarted because nothing in `src/` moved.

---

## The headline: R2 is the largest item in the round, and it is not close

**There is no formatter. There are SIXTEEN paths producing SEVEN
different shapes**, and four of them render a raw ISO string. R2's
anti-rework question has the worse of its two possible answers.

---

## 1. R2: every place a timestamp renders

Censused by `scripts/lead-card-ui/census-timestamps.mjs`, comment-stripped
per Verification 39, over 157 files. **Enumerated by STRUCTURE, not by
name** - Verification 19 records that a name used as an enumeration fails
by silent omission, and a grep for `formatDate` would have found the
formatters and missed every raw render, which is the defect R2 is about.

**Calibrated in both directions and it passed 3 of 3**: a known raw
render found, a known formatter found, and a comment naming a render site
did **not** satisfy the scan.

### The seven shapes

| shape | produced by | call sites |
|---|---|---|
| `12 Sep 26` | `app.js formatDate`, `descriptors.ts asDate` | 12 + 1 |
| `12 Sep 26, 14:23` | `app.js formatDateTime`, `versions/model.ts formatDealDateTime` | 7 + 1 |
| `12 Sep 2026` | `AccountView.tsx formatDate` | 1 |
| `2026-09-12` | `stageTracks.ts formatDate`, `approval-format.ts isoDate`, `LeadCard.tsx` inline, `headerStats.ts date()` | 2 + 2 + 1 + 2 |
| `2026-09-12 14:23` | `versions/model.ts:86`, `testbed/history.ts:35` | 2 |
| `3 days` | `app.js daysAgo` | 4 |
| **`2026-09-12T06:14:09.321Z`** | **four sites with no formatter at all** | **4** |

### The four raw renders, and one of them reaches three surfaces

| site | what renders | reaches |
|---|---|---|
| `NotesHistory.tsx:153` | `{n.at}` | **the lead card, Lead Detail / Contact, and the Test Bed** |
| `InstallSection.tsx:125` | `{n.at}` | Test Bed install notes, **a second copy of the same row markup** |
| `AccountDetailsModal.tsx:81` | `{viewing?.created_at ?? '--'}` | the account details modal |
| `KeyContacts.tsx:158` | `{l.linked_at ?? '--'}` | Key Contacts |

**Confirmed on screen, not inferred**: `.verify/lcuf/lcuf-p0-notes-1920.png`
shows `2026-09-12T06:14:09.321Z` beside the author's email on the card.

### Three copies already claim to agree, and one has already drifted

This is the region-drift shape R2 names, with the drift **already
happened**:

- `app.js formatDate` - `{ day: '2-digit', month: 'short', year: '2-digit' }`
- `descriptors.ts asDate` - identical, and its comment says so: *"The
  shell's own format, so the two surfaces read the same while both exist"*
- `AccountView.tsx formatDate` - `year: 'numeric'`. **Different.** Its
  comment says *"PORTED NOT REACHED FOR"*, a deliberate second reader.

**Verification 20 exactly, and "kept identical to" is the phrase that
marks an unproven one.** One of the three is already wrong and nothing
could have failed.

### What R2 therefore costs

Routing everything through one formatter touches **16 sites across 13
files**, including `app.js` (which frozen Lead Detail and every vanilla
surface render through) and four components with no formatter at all.
**This is not a card fix.** It is an estate-wide rendering change, which
is exactly why R2 was ruled to reach the frozen surface.

### THE DECISION PHASE 1 NEEDS: dates are not timestamps

`DD/MM/YY HH:MM:SS` names a **timestamp**. Twelve of the sites render a
**date-only** value a person typed - Est. Close Date, follow-up date,
Est. start, Contracted end. **`14/09/26 00:00:00` on a date somebody
chose from a picker is worse than what is there now.**

**Recommended, and yours to rule:** two functions, one module.
`formatTimestamp` gives `DD/MM/YY HH:MM:SS` and every site in the raw and
date-time rows uses it. `formatDate` gives `DD/MM/YY` and the date-only
sites use that. `daysAgo` is a third thing and stays. **One module, so
the next new timestamp cannot render raw** - which is R2's actual
requirement.

---

## 2. R1: the account picker

**Card-local scope CONFIRMED, and the component is shared.**
`LinkAccountPanel` has two component consumers: `LeadCardActions` (the
card) and `ContactHost` (**frozen Lead Detail**). `findAccountMatches`,
the pure matching function, has a third consumer in
`AccountDetailsModal`.

### What renders today

Measured at 1920 on a real card, and the capture is
`.verify/lcuf/lcuf-p0-picker-1920.png`:

| | |
|---|---|
| search | **client-side already**, `findAccountMatches` over an array the list fetches once |
| one keystroke `a` | **3 match boxes**, one row, 34px block |
| one keystroke `e` | **6 match boxes**, one row - **every account in the estate** |
| Create | **BELOW the input**, 43px down, at the **end of the match row** |
| the step | 170px tall |

**The capture shows the fault the numbers do not.** `CREATE "A"` sits at
the end of the match row **in the same treatment as the three real
accounts**, so the control that makes a new account is visually
indistinguishable from the ones that pick an existing one. R1's
create-to-the-right fixes the placement and that confusion together.

**Honest limit: there are only 6 accounts today**, so the spray is 6
boxes on one row rather than visible chaos. The argument for R1 is the
shape and how it scales, not current unreadability.

### Recommended shape, for your ruling

**A new card-local `frontend-react/src/leads/AccountPicker.tsx`**, with
`LinkAccountPanel` **untouched**. Reasons:

- The three previous changes to `LinkAccountPanel` were **behaviour**
  switches (`submitPath`, `onCancel`, `alwaysOfferCreate`). A fourth prop
  switching the whole **render shape** is two components in one file, and
  frozen Lead Detail would then depend on a file being rewritten for the
  card's benefit.
- **`findAccountMatches` is imported, not copied.** That shares the
  *definition of a match* without sharing a component, which is
  Verification 20's remedy and not the abstraction R1 forbids.
- `contact-link-account.test.tsx` keeps testing the frozen surface's
  component unchanged.

---

## 3. R3: the notes header, with the numbers

Measured at 1920, reproduced identically on a second run.

| element | top | height |
|---|---|---|
| `NOTES` title | 958 | 18 |
| header row (`LATEST FIRST`, Add note, Discard) | 982 | 32 |
| note input | **1018** | 50 |
| **Summary input**, the column it should align to | **982** | 47 |

**MISALIGNMENT: 36px.** The title sits on its own line above the header
row (6px gap) rather than on it, which is John's "slapdash".

### The arithmetic Phase 1 must hit, and why moving the title is not enough

- Summary column before its field: title 18 + margin 6 = **24px**
- Notes column before its field: title 18 + margin 6 + header 32 + gap 4 = **60px**

**Moving the title into the header row removes 24 of the 36.** The
remaining 12px is the header row being 32px where a bare title is 24px.

**Recommended:** give the **Summary column the same header line**, so the
two are equal by construction rather than by tuning a margin to match.
That is the convention R6 asks for, and it is why it is worth doing this
way round.

### The props

`NotesHistory` already has `actionsInHeader` from last round, which puts
Add note and Discard on the header row. **What is missing is the title**,
which `LeadCard` renders itself as a sibling `div` outside the component.

**One new optional prop: `title?: string`.** Given, the component renders
it as the first item inside `cd-notes-header-row` and the card stops
rendering its own. Omitted, nothing changes.

**AND A CONSUMER THE RULING DOES NOT NAME.** `NotesHistory` has **three**
consumers, not two: `LeadCard`, `ContactHost` (frozen Lead Detail) **and
`TestBedHost`**. An optional prop leaves both others untouched, which is
what makes this the right mechanism - but the Test Bed is a surface no
ruling in this round mentions, and it would have been changed by any
non-optional approach.

### COUPLED DECISION: F3 is these exact controls

`.verify/lcuf/lcuf-p0-notes-1920.png` shows **Add note, Latest 2, Last 10
and All as white browser-default buttons on the dark screen**. That is
carried item F3, at four instances before this round.

**R3 moves and re-lays-out these exact controls, and their height is what
sets the 12px above.** Classing them changes the header row's height, so
the alignment and the treatment cannot be decided separately.

**Recommended: class them as part of R3** - build-discipline rule 10's
limit, a defect the round's own change makes visible is part of the
change. **Yours to rule**, and if the answer is no, the alignment number
is tuned to the unstyled height instead.

---

## 4. R4: "No notes yet."

| | |
|---|---|
| renders at | `NotesHistory.tsx:150`, `<p class="empty-state">` |
| measured height | **101px** |
| why | **`.empty-state` is a PAGE-level style**: `padding: 40px 0`, `text-align: center` |

**It is a full-page empty state used inside a 12px card column.** The
capture shows it centred in the middle of the Notes column, visually
detached from everything around it.

**It also reaches Lead Detail and the Test Bed**, being in the shared
component. Removing it outright changes those surfaces too. **It is a
deletion, not a structural change**, so it is within R2's stated
principle - but it is not what R2 ruled, so it is flagged rather than
assumed. **Recommended: remove for all three.** An empty region reads as
empty everywhere, which is R4's own reasoning.

---

## 5. R5: the band, and the answer differs by width

**It is NOT below the list.** Measured at all three widths: the gap
between the last card and its wrapper is **0px**, and the list scrolls
(`app-content-scroll`, 2527/2068/1912 against a 900px client). **The band
is inside each card**, and it is column slack from the grid's equal-height
rows.

On a lean card, content depth per column:

| width | Summary | Notes | Follow-up | card | **the driver** |
|---|---|---|---|---|---|
| 1240 | 111px | 189px | **218px** | 335px | **the frozen follow-up panel** |
| 1920 | 111px | **189px** | 116px | 257px | **Notes** |
| 3440 | 111px | **189px** | 116px | 257px | **Notes** |

**And the 189px that drives Notes at the wide widths is the 101px empty
state.** Measured by removing the node in the live DOM and re-reading the
layout, at each width with a full reload between:

| width | card with | card without | delta | 
|---|---|---|---|
| 1240 | 335px | 335px | **0px** |
| 1920 | 257px | 200px | **57px** |
| 3440 | 257px | 200px | **57px** |

### So R5's answer is two answers

- **At 1240 the space IS the frozen follow-up panel's.** Its 218px is the
  driver and nothing this round may touch changes it. **Note it and leave
  it**, exactly as R5 instructs.
- **At 1920 and 3440 it is not.** The driver is the empty-state sentence,
  and **R4 already removes it**. R5 is delivered at the wide widths by
  R4, for zero additional change.

**R4 and R5 are one fix at two of the three widths**, which neither
ruling could have known.

---

## 6. R6: the conventions this round establishes

Proposed wording, for `DESIGN_PRINCIPLES.md` at the close. **Written
contract, no shared component.**

1. **THE COLUMN HEADER LINE.** A card column's title shares one line with
   that column's own state label and controls. The title never takes a
   line of its own above them.
2. **THE FIELD ALIGNS ACROSS COLUMNS.** Every column in a card body gives
   its header line the same height, so the first field in each column
   starts at the same y. **Equal by construction, never by tuning a
   margin to match a neighbour.**
3. **CREATE SITS TO THE RIGHT OF THE INPUT IT CREATES FROM**, on the same
   line, never below its results and never inside them. A control that
   makes a new thing is not dressed as one of the existing things.
4. **A FILTERED SELECTION IS A DROPDOWN, NOT A ROW OF BUTTONS.** The
   height of a picker must not be a function of how much data exists.
5. **AN EMPTY REGION SAYS NOTHING.** No "No X yet." sentence. The absence
   is the message, and a page-level empty state never appears inside a
   card column.
6. **ONE TIMESTAMP FORMATTER, ONE DATE FORMATTER, ONE MODULE.** A surface
   never formats a date inline and never ports a formatter by copying.

---

## What Phase 0 does NOT establish

- **Nothing about how the replacements will look.** Every number is of
  the screen as it stands.
- **The 6-account denominator is today's data.** R1's case rests on the
  shape, not on current unreadability, and the report says so.
- **F3's other instances are unmeasured.** Only the card's are counted.
- **No walk.** Lead Detail is frozen and unwalked, and R2 will change
  what it renders.

## What surprised

**A screenshot suggested a defect that was not there, and the measurement
refuted it.** The first capture of the card showed `Showing 2 of 3` above
an **empty** Notes column, which reads as notes failing to render. A
fourth probe measured the rows: they are present, inside their column, at
all three widths.

**The capture was clipped on PAGE coordinates for an element inside a
scrolling container**, so it photographed background below the card. That
is Verification 4's own recorded clause, arriving against the person who
cited it two paragraphs earlier. All captures now go through
`ElementHandle.screenshot`, which cannot miss the element, and the
re-taken image shows the notes.

**And two probe faults, both caught by reading the cause rather than the
effect.** A triple-click that appended instead of replacing read **0
matches for "e"** and looked exactly like a picker that does not
re-filter; reading the input's value back beside the count showed
`input="eo"`. And the R4 removal loop measured 1920 and 3440 against a
tree the 1240 iteration had already removed the node from - **Verification
7's fixture-consumed-by-an-earlier-claim, which this estate promoted last
round, inside its own loop.** Both probes now refuse to score a reading
whose precondition failed.

---

## Decisions Phase 1 needs

1. **R2 scope**: two functions in one module, `formatTimestamp`
   (`DD/MM/YY HH:MM:SS`) and `formatDate` (`DD/MM/YY`), rather than one
   applied to date-only fields. **Recommended.**
2. **R2 reach**: all 16 sites including `app.js`, or the React tree only
   this round with `app.js` queued. **Recommended: all 16**, because a
   partial pass is the drift R2 exists to stop.
3. **R1 mechanism**: a new card-local `AccountPicker.tsx` importing
   `findAccountMatches`, with `LinkAccountPanel` untouched.
   **Recommended.**
4. **R3 + F3**: class Add note and Discard as part of R3, since their
   height sets the alignment. **Recommended.**
5. **R4 reach**: remove the empty state for all three consumers, not only
   the card.
6. **R5**: accept that 1240 is the frozen panel's and is left alone.

**Nothing pushes.**
