# LEADS - DETAILS CONSOLIDATION, Phase 0: measurement

Read-only. `INTERACTION_STANDARDS.md` re-read first. One census over 899
files, two live probes, all calibrated. Captures in `.verify/ldc/`.

---

## THE HEADLINE, AND IT IS A SCOPE DISCOVERY

**R4's premise does not hold, and the round should not build to it until
you have ruled again.**

> **`#view-contact-detail` is not "Lead Detail". It is the CONTACT detail
> screen, and it is the ONLY detail view the 10 live QUALIFIED contacts
> have.**

Measured:

- `app.js:5376` renders the Contacts screen as
  `renderContactGrid('contacts-rows', c => c.status === 'Qualified', ...)`,
  and each row is `onclick="navigate('contact-detail', ...)"`.
- The Leads card's own filter is `LEADS_PIPELINE = ['Unqualified',
  'Nurture']`, and the code's comment says **"A Qualified lead has
  GRADUATED and is worked as a Contact."**
- Live counts: **6 Unqualified, 0 Nurture, 10 Qualified.**

**So retiring that screen would leave 10 of the 16 live contacts with no
detail view at all**, because a qualified contact does not appear on the
Leads card by design.

**The premise is true for LEADS and false for CONTACTS.** The in-card
surface genuinely is the lead's detail view. It is not the contact's.

**This is reported rather than worked around**, per build discipline 15: a
scope discovery is the deliverable, and measuring it precisely beats
delivering a fifth of a retirement that strands a screen.

### What that leaves R4 as, if you want it

Three options, none chosen here:

1. **Retire it for LEADS only** - the card's Details entry replaces
   navigation for Unqualified and Nurture, and the Contacts list keeps the
   screen. **The screen stays; only one entry point goes.**
2. **Absorb Contacts too** - a Contacts card surface, which is a much
   larger round and is not what the brief scoped.
3. **Retire it fully and accept Contacts losing a detail view** - not
   recommended, and named only so the option set is complete.

---

## 1. R1: the after-save highlight - CAUSE NOT CONFIRMED, and the brief's guess is not supported

**I could not reproduce it, and the measurement rules out what the brief
suspected.**

| surface | before the save | after the save |
|---|---|---|
| completion surface, `city` | `cls="lead-field-input"`, bg `rgb(21,22,28)`, **marked** | **same classes, same bg, marker CLEARED** |
| completion surface, `postcode` (still missing) | marked | still marked, correctly |
| address popup | standard treatment | **popup closes; 0 card fields carry a non-standard background** |

**Fields whose treatment changed across the save: none.** The
stale-state-after-save family is **not** what this is: the markers clear
correctly and the classes are identical.

### The leading hypothesis, with its evidence and its limit

**The "popup lists" are the BROWSER'S OWN AUTOCOMPLETE dropdowns, and the
white highlight is Chrome's `:autofill` styling.**

| evidence | |
|---|---|
| `LeadFieldInput`'s five controls carry **no `autoComplete` attribute** | so the browser offers its own dropdown on every one |
| `AccountPicker` sets `autoComplete="off"` explicitly | nothing else does |
| the stylesheet contains **zero** `:autofill` or `-webkit-autofill` rules | so Chrome's default pale fill is unopposed |
| Chrome's autofill background **persists until the value changes** | which is exactly "left highlighted after save" |
| it is a **pseudo-class, not a class** | which is exactly why a class-and-background probe sees nothing |

**IT IS NOT CONFIRMED.** Headless Chrome has no saved form data, so
nothing can be autofilled and the state cannot be produced here.

**What would confirm it, cheaply:** open a lead, complete a field by
choosing from the browser's dropdown rather than typing, save, and say
whether the field stays highlighted. **One observation settles it.**

**The fix is the same under either answer and is small**: `autocomplete="off"`
on the field inputs, plus an `:autofill` override so the estate's own
treatment wins.

---

## 2. R2: the grid, measured

**It IS a `<table>`** - `border-collapse: collapse`, 15 columns, sticky
`<th>`. The complaint is exact and the cause is that **the cells have no
borders at all**:

| line | source | alpha |
|---|---|---|
| header underline | `th { border-bottom: 1px solid var(--hairline) }` | **0.12** |
| the input's own underline | `.lead-field-input` | **0.22** |
| **the cell** | **no border rule** | **none** |

**Three different treatments, and the one that would make it read as a
table is the one that is absent.**

### Why cells crop

**Input 110px in a 118px cell; a 58-character company name needs 370px.**
`input.scrollWidth 370 > clientWidth` - **cropped, measured, not asserted.**

**The modal is `min(1480px, 96vw)`**, so at 1920 it is 1480px. **The
problem is not that 1480 is narrow - it is 15 columns in 1480px**, about
98px each.

### Why there is no scroll bar

`.new-lead-scroll { overflow: auto; min-height: 0; flex: 1 }` inside
`.modal-panel-batch { max-height: 88vh; display: flex; flex-direction:
column }`.

**`flex: 1` lets the container GROW; the only cap is the modal's 88vh.**
With 7 rows the content is 424px against a 424px client height -
`scrollHeight === clientHeight`, **so it never scrolls.** A scrollbar
appears only past roughly fifteen rows.

### Scroll persistence: NOT REPRODUCED, and the reason matters

**It never scrolls at the row counts tested, so `scrollTop` cannot be
non-zero to persist.** Set to 120 and reopened, it read 0 - **but that is
a reading on a container that could not scroll in the first place, which
is no reading at all.**

**Testable only once the grid is capped**, which R2's own fix does. Flagged
so it is verified after the cap rather than assumed fixed by it.

### Save does not close

Measured in the first pass: the grid stays open and reports `N leads
created`. `NewLeadGrid.save()` calls `onDone?.(created)` and sets a
`result` message; **nothing closes the modal.**

---

## 3. R3: the two locations

| | |
|---|---|
| the block to drop | `QualifyCompletion.tsx:163-176`, testid `lead-summary-pointer-<id>` |
| the asterisk's new home | `InlineSummary.tsx:44`, `<Panel title="Summary">` |

**`Panel` has no `required` affordance today**, so this is a small
addition to the shared shell rather than a change to `InlineSummary` -
which is the right place, because the next panel to need one gets it free.

---

## 4. R4, the rest

### (a) Can the surface already render with nothing missing? **Partly - the entry mode must be built.**

**Measured against a COMPLETE lead: the completion surface did NOT open.**
Qualify went straight to the **account step**, correctly - nothing was
missing.

But the component itself needs almost nothing: it renders **all**
`CONTACT_FIELDS` and `ADDRESS_FIELDS` prefilled from the record, and marks
only what `blocking` names. **With `blocking` empty it renders every field
and zero markers already.**

**So what must be built is the ENTRY, not the surface**: a Details button
that opens it, a mode flag that drops the *"Please complete missing data"*
eyebrow, and a save path that does not try to advance qualification.

### (b) The address popup is card-local. Confirmed.

**One consumer: `LeadCard.tsx`.** Removing it touches that call site, the
`addressOpen` state, the `refreshRef` wiring, and its own file. It shares
`LeadFieldInput` with `NewLeadGrid` and `QualifyCompletion`, which stay.

### (c) The retirement inventory: 37 non-document files, 22 documents

Censused over **899 files**, calibrated both ways, anchors assembled from
parts so the instrument cannot match its own source.

| kind | files | note |
|---|---|---|
| REACT SOURCE | 8 | 4 in code: `ContactHost`, `ContactView`, `main.tsx`, `shell-services.ts` |
| VANILLA SOURCE | 3 | `app.js`, `index.html`, `style.css` |
| GATE SUITE | **3** | `live-form`, `no-duplicate-ids`, `seam-ledger` |
| REACT TEST | **11** | |
| PROBE / SCRIPT | 12 | six Leads probes address `#view-contact-detail` |
| DOCUMENT | 22 | disposition: correct the prose, nothing to re-point |

**AND ONE ANCHOR IS NOT DETAIL'S TO RETIRE.** `setContactReturnView`
appears in **11 React tests, 3 gate suites and `shell-services.ts`**, and
its consumers include the Test Bed door, the reference host and the field
rows. **It is shared navigation infrastructure that Lead Detail happens to
use** - retiring the screen does not retire the seam, and treating the two
as one would break surfaces this round never touches.

### (d) The frozen constraints: they do NOT dissolve

**Because the screen is not retiring**, on the finding above. And even if
it were:

| component | consumers |
|---|---|
| `NotesHistory` | `ContactHost`, `LeadCard`, **`TestBedHost`** |
| `FollowUpTask` | `ContactHost`, `LeadCard` |
| `LeadFieldInput` | three, all in `leads/` |

**`NotesHistory` keeps a second non-card consumer either way** - the Test
Bed - so its optional-prop discipline survives the retirement regardless.
`FollowUpTask` would become card-only, which is what would unblock its S5
classing.

---

## 5. A conformance gap this round's own gate did not catch

**`QualifyCompletion` builds its own headers.** It renders
`<div className="lead-card-col-title">` per group and a
`lead-complete-actions` footer - **it does not route through `Panel`.**

**The conformance gate passed it**, because the gate's retired-shell list
names `card-col-head`, `cd-card-head` and `form-actions`, and this uses
neither. **Verification 19 inside the gate built to enforce Verification
19.**

**It matters for this round specifically**: R4 makes this surface the
detail view, and the brief says new surfaces conform. **Recommended: route
it through `Panel` as part of R4, and widen the gate's shell test from a
name list to "a Leads surface renders no title-shaped element outside a
`PanelHeader`."**

---

## Decisions Phase 1 needs

1. **R4's scope, and it is the round's shape.** Retire for Leads only
   (option 1), absorb Contacts (option 2, much larger), or something else.
   **Nothing else in R4 can be built until this is ruled.**
2. **R1: one observation from you settles the cause** - does completing a
   field from the browser's dropdown leave it highlighted? The fix is
   small either way and can proceed under the stated hypothesis if you
   prefer.
3. **R2's scroll persistence is untestable until the grid is capped.**
   Verify after, not assume.
4. **Widen the conformance gate's shell test**, and route
   `QualifyCompletion` through `Panel`.

---

## What surprised

**The census matched its own source and its own JSON output on the first
run**, reporting them as dependencies of the thing they measure. **The
remedy was already recorded** - Verification 39's Round 8 clause: assemble
the strings from parts so the harness names them nowhere - **and this
round's own carried item #1 is to reach for an existing rule's remedy
before writing a new instrument.** That is what happened, and it took one
edit.

**And two of the first pass's readings were taken on the wrong
population.** R1 was measured on the completion surface when John's words
name the **popup**; R2's scroll and cropping claims were measured on an
**empty** grid, where `scrollHeight === clientHeight` because there is
nothing to scroll. Both re-measured; the second pass is what produced the
cropping number and the autofill hypothesis.

---

## What this does NOT establish

- **R1's cause.** A hypothesis with converging evidence is not a cause.
- **The scroll-persistence claim**, for the reason above.
- **Nothing about how any replacement will look.** Every number is the
  card as it stands.
- **Only 1920 was measured.** The build verifies at three widths.
