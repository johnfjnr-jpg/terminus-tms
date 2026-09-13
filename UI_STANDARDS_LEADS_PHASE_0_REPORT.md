# UI STANDARDS - LEADS, Phase 0: the Leads card against the document

Read-only. `INTERACTION_STANDARDS.md` read in full first. Two probes and
two censuses, all calibrated. Log in `.verify/usl-p0.log`,
`check-dist-fresh.mjs` PASS before every live read.

---

## The headline: the document has rotted, and Section 4 was never built here

**Section 4's focus trapping - the dialogue standard that governs both of
the Leads card's modals - conforms 0 of 6.** Neither dialogue moves focus
in on open, neither confines Tab, neither closes on Escape.

**And the document cites 13 identifiers that no longer exist**, including
five in Section 5 alone, because **`frontend/contact-detail.js` was
retired in the migration** and Section 5's two "real, working examples"
were built in it.

**18 days, 195 commits and 168 UI files** since the document was last
touched.

---

## 1. Which sections govern the Leads card, and how it measures

| section | governs the card? | conformance |
|---|---|---|
| **4** focus trapping in in-page dialogues | **yes** - two modals | **0 of 6** |
| **5** unsaved changes | **yes** - two modals plus the third case | **1 of 3**, plus one that does not arise |
| **6** the record action bar | **yes** | **conforms in shape** |
| **9** dirty state and save bars | **yes** - the card adds to the count | see below |
| 1, 2, 3 | partially | not re-measured this phase |
| 7, 8, 10, 11 | no - Test Bed and Opportunity | carried |

### Section 4: measured, and it is a clean sweep of divergence

| claim | Address popup | Nurture dialogue |
|---|---|---|
| focus moves into the dialogue on open | **no** - stays on the opener | **no** |
| Tab is confined to the dialogue | **no** - escapes within 12 tabs | **no** |
| Escape closes it | **no** | **no** |

**Section 4 says it "applies to any future in-page panel that plays the
same role as Park".** Both of these do. **The standard exists, is nine
sections old, and the React surfaces never received it** - the 42 lines
of focus-trap tokens the document counts are all in the vanilla.

### Section 5: one of three, and the two failures are silent

| claim | result |
|---|---|
| a backdrop click while dirty is **refused** | **CONFORMS** - the popup stays open |
| **and it nudges** (`.msg-warning` / `.btn-attention`) | **DIVERGES** - no nudge at all |
| **Close while dirty asks** before discarding | **DIVERGES** - it closes silently and the edit is gone |

**The first two together are the worse reading.** A refusal with no nudge
means the person clicks the backdrop, **nothing happens, and nothing says
why.** Section 5 chose refuse-plus-nudge over silent refusal deliberately.

**The third case does not arise on the card**, and the reason is
structural rather than handled: a dirty Summary survives a note-add
because `InlineSummary` holds its text in local state and the reload does
not change the `value` prop, so the resetting effect never fires.
**Nothing asked, and nothing was lost.** Recorded precisely, because it
is luck of implementation rather than the mechanism Section 5 names, and
a future change that remounts the card would lose the edit.

### Section 6: the card conforms

`LeadCardActions` is the last child of `.lead-card-head`, pinned right by
`margin-left: auto`, participating in the head's `flex-wrap`. **That is
Section 6's shape exactly**, arrived at independently in the LEADS CARD
POLISH round. **The principle was already being followed before it was
written down**, which is the argument for writing it down.

### Section 9: the card adds a fifth and sixth mechanism

Section 9 counts four dirty-state mechanisms (Test Bed, Reference,
Assessment, Accounts reusing a class). **The Leads card adds per-panel
local state in `InlineSummary` and in `FollowUpTask`**, neither
registered anywhere. **The convergence Section 9 exists to drive has been
diverging since it was written.**

---

## 2. Every action control, tested against the principle

| control | acts on | sits on | verdict |
|---|---|---|---|
| `lead-qualify` | the RECORD | record bar | **conforms** |
| `lead-nurture` | the RECORD | record bar | **conforms** |
| `lead-summary-save` | the Summary panel | that panel | **conforms** |
| `cd-add-note-btn` | the Notes panel | that panel | **conforms** |
| `cd-followup-save` | the Follow-up panel | that panel | **conforms** |
| `lead-address` | the record's address fields | record bar | **defensible - see below** |
| `lead-followup-btn` | **a panel already on screen** | record bar | **DIVERGES** |

**Five of seven conform, and the principle turns out to describe what the
card mostly already does.**

### `lead-followup-btn` is the real divergence

Its entire behaviour is `scrollIntoView` plus `focus()` on the follow-up
panel's date input - **a panel sitting visible three columns to the
right**. Under the principle it either belongs with that panel or does
not need to exist. **On a card where the panel is always visible, it is a
record-bar control with no record scope and no work to do.**

### `lead-address` is defensible, and hides a different defect

There is no address PANEL, so a record-bar disclosure for a record-level
field group is the right scope. **But its `aria-controls` names
`lead-address-panel-<id>`, and no element with that id exists** - the
popup's is `address-popup-region-<id>`.

**And `[aria-controls]` is one of the door's exemptions.** So the button
survives the door on an unowned lead **because it declares a property it
does not have.**

**Measured, the door still holds**: the popup opens, but Save and all six
inputs are disabled and **only Close is live**, which is Verification
43's leave-control clause working. **Not a security defect - a true
statement made by a false declaration**, and nothing checks the
declaration.

**Censused: 3 `aria-controls` in the React tree, 2 point at nothing.**
The other is `deal/section4.tsx`, not a Leads surface, and joins the
carried migration pass.

---

## 3. The component gap

**Confirmed unchanged from the previous round: no `Panel`,
`PanelHeader`, `SaveControl` or `CardHeader` exists.** Three competing
CSS shells: `.card-col-head`, `.cd-card`, and `.eyebrow` + `.form-actions`.

**What the three components need**, derived from the eight surfaces
measured across both rounds:

- **`PanelHeader`** - title; optional secondary label; an actions slot,
  right-aligned; a **fixed line height** so S3's alignment holds by
  construction; and no knowledge of its panel's contents.
- **`SaveControl`** - a Save and Discard pair taking `dirty`, `busy` and
  the two handlers, so S4 is one implementation rather than four.
- **`Panel`** - the container, so a panel cannot be built without a
  header, which is what makes S1 unroutable-around rather than advisory.

**Plus a `Modal` shape**, since John's ruling makes the footer a distinct
convention: `.form-actions` already exists and 4 components use it, so
this one conforms an existing shell rather than replacing it.

---

## 4. The constraints

| component | consumers | constraint |
|---|---|---|
| `NotesHistory` | card, **ContactHost**, **TestBedHost** | optional props; **already conforms to S1-S3** |
| `FollowUpTask` | card, **ContactHost** | **frozen AND shared**; holds 3 of the 10 unclassed controls |
| `LeadFieldInput` | AddressPopup, QualifyCompletion, **NewLeadGrid** | not frozen; classing it changes the New Lead grid |

---

## 5. F3 and the undefined vars

**34 controls render on the card; 10 carry no defined class.** Among the
24 that are classed, **three competing button treatments**: `.btn-ghost`
7, `.btn-sm` 7, `.btn-primary` 4. **S5 says one.**

| where | unclassed | note |
|---|---|---|
| `LeadFieldInput` | 5 | render 6 cells in the address popup |
| `FollowUpTask` | 3 | **frozen** |
| `NurtureDialog` | 2 | |

**`--red` (3 sites) and `--amber` (10 sites) are used and never defined**,
every site carrying a literal fallback, so they render and are invisible
to the palette. **Define at `#e06c6c` and `#E0A33E`** - the values already
in use - so the fix changes nothing visually.

---

## 6. The enforcement mechanics

Both were prototyped this phase rather than described.

### The conformance gate test

**A registry of Leads panels, each measured live for the relationships
S1-S5 state.** `scripts/ui-standards/probe-p0-panels.mjs` already does
this: one measuring function applied to every panel, so two panels cannot
disagree about what "on the header line" means.

**To become a gate stage it needs three things:**

1. **A registry the components themselves populate**, not a hand-written
   list - Verification 19: a list enumerated by name fails on the member
   nobody added. A `data-panel` attribute emitted by `Panel` makes the
   population structural.
2. **Structural checks that need no browser** for the cheap half: every
   panel routes through `Panel`; no panel renders a bare `<button>`;
   every `aria-controls` names an id that exists.
3. **The live half in the existing HTTP-probe slot**, since S1 and S3 are
   geometry and only a browser can answer them.

**And it must be calibrated to fail**: a panel with Save below its field
must go red, or the stage is an assertion rather than a control.

### The staleness check

**Working already, as this phase's measurement.** The mechanism:

1. Extract every backticked identifier the document cites - **81 today**.
2. Assert each exists in `frontend/`, `frontend-react/src/` or `src/`,
   comment-stripped.
3. **Allow an explicit "asserted absent" marker**, because the document
   deliberately cites `oppEdits`, `closeLost` and `abandon` as things
   that do NOT exist, and those are correct negatives that must not read
   as rot.
4. Report the count of commits touching UI files since the document was
   last changed.

**Today it reads 13 missing, of which 3 are correct negatives, leaving
10 genuinely stale**, and `contact-detail.js` gone from under Sections 2,
5 and 7.

**The check belongs in the pure suite**: it needs no browser and no
database, and it is the one instrument that would have told John what he
found by checking a date.

---

## Decisions Phase 1 needs

1. **Section 4 on the two modals: fix in this round, or carry?** It is
   0 of 6 and it is the document's own standard. **Recommended: fix** -
   the `Modal` shape is being built anyway and the focus trap belongs in
   it, so it costs one component rather than two retrofits.
2. **Section 5's missing nudge**: the backdrop refusal is silent.
   **Recommended: fix with the modal shape**, same reason.
3. **`lead-followup-btn`: remove it, or move it?** It focuses a panel
   already on screen. **Recommended: remove** - the panel is visible and
   the button is a record-bar control with no record scope.
4. **`aria-controls` pointing at nothing**: fix the target, and **add the
   existence check to the conformance test** so no exemption can rest on
   a false declaration again.
5. **The staleness check's failure mode**: does a stale citation FAIL the
   suite, or report? **Recommended: fail**, with the asserted-absent
   marker as the escape hatch - a warning nobody must act on is the empty
   state R4 removed, at gate scale.
6. **Whether the document's final line is corrected in this round.** It
   reads *"This document is not itself built from, it describes intended
   behavior only"* - **false since Round 29 added Part two**, and
   contradicted by its own status line.

---

## What surprised

**A Section 5 check reported CONFORMS three times on an element that was
never displayed.** The probe asked `!el.hidden`; the shared discard modal
is hidden by the **`hidden` CLASS**, so the IDL attribute reads false
whether it is showing or not.

**That is Verification 4's own clause - an attribute assertion is not a
visibility assertion - and it was written into `CLAUDE.md` from a defect
found the same way.** Re-measured with computed style, **two of the three
flipped to DIVERGES**, and the visibility helper is now calibrated
against that exact element in both directions before any claim rests on
it.

**And the principle mostly describes what the card already does.** Five
of seven controls conform before any work. The value of writing it down
is not the retrofit - it is that the next surface does not have to
re-derive it, which is precisely what Section 9 said in 2026-08-24 and
what has not happened since.

---

## What this does NOT establish

- **Sections 1, 2 and 3 were not re-measured** against the card.
- **Only 1920 for the conformance probe.** The retrofit verifies at three
  widths; conformance to Sections 4 and 5 is behavioural, not geometric.
- **The carried migration pass is untouched.** Sections 6 to 11's other
  surfaces are unmeasured, and `deal/section4.tsx`'s broken
  `aria-controls` is the first evidence that the rot reaches them.
