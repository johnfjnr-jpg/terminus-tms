# The Leads round: brief

Governing docs, read before anything: `CLAUDE.md` and the `tms-round-method`
skill. Drafted from John's instruction of 2026-09-11; re-verify premises against
the tree you are on. This brief's R-series and phase numbering are its own.

**THE STANDING QUALIFICATION IS IN FORCE.** Set at the teardown integrity
round's close and recorded in `CLAUDE.md` under Verification 41: 52 assertions
across 8 gate suites are made against dead `-vanilla` markup. **Any Lead surface
touched in this round verifies by SCREENSHOT or LIVE DOM, per Verification 4.
Those suites' green is not evidence about a live screen and is not offered as
such.**

## Context

The React migration dropped behaviour the vanilla Lead screen had. This round
**recovers the lost logic and behaviour, then rebuilds three Lead screens against
it.**

> **Logic is built before the screens, because a screen built on stubbed rules
> gets rebuilt when the rules land.**

## The lifecycle model: design of record, John-ruled

- **Statuses: Unqualified** (on create), **Qualified**, **Nurture**.
- **Qualified is a HARD block enforced SERVER-SIDE.** A lead cannot become
  Qualified unless **Contact Details, Address Details and Summary** are all
  complete. The client shows a **disabled** Qualify control with an inline hint
  naming what is missing. **The server is the enforcement, not the button.**
- **Nurture requires a follow-up date and a reason, and THE REASON IS A NOTE**,
  not a separate field.
- **A follow-up task** (calendar date + description) exists on **all** statuses,
  independent of the Nurture reason.
- **Summary:** not mandatory at creation, **mandatory for Qualified**.
- **Notes:** timestamped, newest first, **default last 2**, expand to **10** or
  **All**. Add Note appends as the latest note.

## Rulings of record (John, 2026-09-11, on the Phase 0 report)

**R1. NURTURE IS A RELABEL OF `Parked`.** Test data only, no backfill concern -
**the action is identical.** Relabel the status value and every surface that
displays it, and **supersede "Parked" in writing wherever it was recorded as a
decision** (Verification 23).

**R2. P1 ABSORBS the carried `Unqualified -> Parked`(Nurture) reachability
item.** This round makes that transition load-bearing, **so this round proves
it**: the `followUpDate` rule must be shown to gate it, **both directions**.

**R3. A3 WINS over the recorded field-row contract**, applied to **all four
surfaces** - Contact, Test Bed, Reference, Account. Escape reverts the focused
field to its last saved value everywhere. **The contract's deliberate
no-discard decision is superseded IN WRITING at its recorded site**, not left
standing beside the new behaviour. **John ruled this knowing it touches
surfaces outside Leads.**

**R4. A1's per-field Discard removal is done ONCE** on the shared
`FieldRow`/`EditBar`, removing it across all four surfaces, replaced by
form-level Save + Discard with form-level dirty tracking. **John ruled this
knowing the blast radius.**

### An instruction received truncated, recorded as such

**The P1 instruction arrived cut off mid-item-5**, at "BUILD the follow-up task
(calendar date + description) on ALL". **Item 5 is completed from this brief's
own design of record**, which is the authoritative statement and not a guess:

> A follow-up task (calendar date + description) exists on **all statuses**,
> independent of the Nurture reason.

**Whether items 6 or beyond existed is unknown and is NOT assumed away.** P1
stops after item 5 and asks. Recorded here rather than only in a report,
because a truncation discovered later reads as an oversight.

### R7 and R8 (John, 2026-09-11, on the P3 report)

**R7. Both gated fields get a surface.** `jobRole` IS a Contact Details field
and is an editable row. The lead name is **editable**: the row-and-heading
split stays, the heading displays and the row satisfies the gate. **Proven by
probe:** every field in `exit-criteria`'s `blocking[]` has a reachable editable
input.

**R8. DELETE AND UNQUALIFY ARE REMOVED, AS A LIFECYCLE RULE** rather than a
layout choice:

> - **Leads are NOT deleted from the Lead screen at this stage.**
> - **The lead lifecycle is FORWARD-ONLY at this stage:** created Unqualified,
>   then Qualified or Nurture. **No transition back to Unqualified.**

Recorded as a rule so a later round does not restore the controls on the
grounds that the vanilla had them - which is exactly the argument that would
restore them.

**THE CONTROL GOING DOES NOT CLOSE THE TRANSITION, and that is flagged, not
built.** Measured against the live server: `POST /records/:id/transition` with
`to_stage: 'Unqualified'` on a Qualified lead answers **200** and the record
moves. `transitions.js` permits any backward transition by design. Whether to
close it server-side is a **separate item**.

### R9 and R10 (John, 2026-09-11, on the P4 report)

**R9. GRADUATION. The product rule that defines the Leads screen:**

> **The Leads screen shows Unqualified and Nurture only. On qualification a
> lead graduates off the Leads pipeline and is worked as a Contact.**

The Leads grouping is therefore **Unqualified / Nurture**. The Qualified group
was built under the earlier three-group layout and is dropped here. **Proven
live by MEMBERSHIP, not by a heading being absent:** one record followed by id
across both screens, before and after the transition.

**R10. Empty status headings are SHOWN** - "Nurture 0". A pipeline scan
benefits from seeing that a stage is empty; a missing heading is not
information.

**APPENDED AT THE CLOSE, AND THAT IS THE FAULT BUILD DISCIPLINE 7 NAMES.**
The rule says a ruling given in conversation is appended to the brief AT THE
PHASE IT LAUNCHES, not discovered at the close. This brief carried **8 while
11 were in force**, and the count at the close is what found it - which is
the rule working as a detector and failing as a practice. The previous round
was 8 while 10 were in force. Same fault, consecutive rounds.

**R5. COMPANY IS PART OF CONTACT DETAILS COMPLETE.** Ruled at P1. `company`
joins the Unqualified to Qualified completeness gate as a
`payload_field_required` row. Launched the P1 migration
`20260911000002_contact_qualify_requires_company.sql`, applied by John
through the SQL editor and verified over PostgREST.

**R11. JOB TITLE IS MANDATORY SERVER-SIDE.** Ruled at the P5 sign-off.
`jobRole` joins `CONTACT_REQUIRED_AT_CREATION` in `src/routes/contacts.js`.
Launched the route change, the enumeration of every creation path it bites,
the omission re-proof, and the patch of ten probe fixtures.

**R12. `regionForCountry` IS CARRIED**, low priority, recorded in
`DESIGN_PRINCIPLES.md` as a decision rather than a silent loss.

**THERE IS NO R6.** The numbering runs R1 to R5 then R7 to R12. The ruling
that would have held that slot was given unnumbered: the red-tree mechanical
fix, below.

**THE UNNUMBERED CONVERSATIONAL RULINGS, recorded because they launched work
exactly as the numbered ones did:**

- **A3 conflict, option (a), at P2.** Escape reverts and closes; a draft dies
  with its editor. Superseded field-row contract behaviours 1 and 6 in
  writing at their recorded sites, across all four surfaces.
- **The A6 acceptance test, at P2.** Edit a field on an unowned lead, navigate
  away and back, confirm the owner's saved data renders with no local edit
  surviving.
- **The red-tree mechanical fix, option (a), at P2.** A pre-commit check runs
  the suites and refuses the commit if any is red, calibrated both ways, and
  recorded as the answer to a twice-repeated fault: a rule that failed twice
  while known is replaced by a mechanism, not a third restatement. It found a
  live database red on its first run.

## Phases, in build order. Each stops for sign-off.

### P1: lifecycle logic

Statuses and transitions, Qualify completeness enforcement, Nurture, the
follow-up task, the notes model, the Summary rule.

**Server-side enforcement proven by the identity counterfactual: a real
non-owner or non-permitted JWT, NEVER the service role**, both directions per
transition. A declared policy is not an enforcement, and a probe through the
service role proves nothing.

### P2: the six migration regressions on Lead Detail

| | |
|---|---|
| **A1** | Remove per-field Discard. **One form-level Save + Discard**, moved to the header row beside Lead Status and actions, with **form-level dirty tracking**. |
| **A2** | The focus highlight **clears on blur** (it currently persists). |
| **A3** | **Escape reverts the focused field** to its last saved value. |
| **A4** | Navigating away from a dirty form **warns**, and on confirm **DROPS the edits**. Edits live only until saved or discarded. They currently persist silently, **and that is the bug**. |
| **A5** | The door reaches **every write** on the Lead view - fields, Qualify, Park, Add Note, follow-up task - on an unowned lead. **Calibrated both ways.** |
| **A6** | Resolved by A4 + A5: an unowned lead shows the **owner's saved data**, never local unsaved edits. |

### STANDING REQUIREMENT FOR EVERY SCREEN PHASE (P2-P5)

**Ruled at the P1 close, 2026-09-11, from what P1 measured rather than from
principle.**

> **`node scripts/check-dist-fresh.mjs` is required verification for any phase
> that changes a screen, and a screen claim is not evidence until it has
> passed.**

**The bundle is a SECOND READER of the source** (Verification 20), and
`check-dist-fresh.mjs` exists saying exactly that in its own comment. P1 proved
what happens when it is skipped:

- the source was correct,
- `tsc --noEmit` was green,
- **the react suite passed 932/932**,
- and **the screen still rendered the old label**, because `dist` had not been
  rebuilt.

**A stale label would have shipped behind three green instruments.** Worse, the
react suite passing was not even weak evidence: nothing asserted the string, so
flipping it could not have gone red in either direction.

**So a screen phase ends with: `npm run build:react`, then
`check-dist-fresh.mjs`, then a LIVE-DOM assertion** - and the live-DOM
assertion matches what is RENDERED, not what the source typed. P1's own first
attempt failed against a correct screen because the element is
`text-transform: uppercase` and `innerText` returns the transformed text.

This sits beside the standing qualification rather than replacing it: that one
says the eight vanilla-asserting suites are not evidence about a live screen;
this says a green suite of any kind is not evidence about a screen whose bundle
is stale.

### P3: Lead Detail redesign
Mockup `image5` layout.

### P4: Leads List redesign
Mockup `image4` layout.

### P5: New Lead batch grid
Mockup `image3`. Grid entry, tab through fields, **last row auto-extends**,
**field-by-field validation on email and mobile** (an invalid row cannot save;
valid rows are unaffected), **Summary not mandatory**, and Save creates the
leads so they appear in the list.

## Phase 0: measurement only, read-only against product code

1. **The parity gap.** What the vanilla Lead screen did that the React rebuild
   dropped, enumerated **per behaviour A1-A6** against the live React surface.
   **Name the instrument for each**: the door census enumerates controls
   mechanically; escape, blur and navigation behaviours need **live-DOM probes**.
   The vanilla Lead markup, **if it survives as a `-vanilla` block, is the
   reference for what was lost - measure it, do not delete it.** It is under the
   standing qualification and its tripwire.

2. **Where the lead lifecycle lives today.** The status field and its values in
   the data model, any existing transition code, whether **Qualify and Park
   exist server-side or only as buttons**, and where notes and follow-up data
   are stored. **This decides P1's real scope: extend an existing mechanism, or
   build it.**

3. **Door reachability on the Lead view.** Does `applyReadOnlyControls` / the
   sweep run on the Lead view **at all** - last round it ran on Opportunity only
   - and does the shared enumerator see the Lead controls?

4. **The Lead data model.** Fields present for Contact Details, Address Details,
   Summary, notes and follow-up; **what a completeness check for Qualified would
   read**; and whether email and mobile have **any validation today**.

**Stop with the Phase 0 report:** the parity gap per behaviour with its
instrument, where the lifecycle lives and P1's resulting scope, door status on
the Lead view, the data-model findings, and the decisions P1 needs from John.
**Nothing pushes.**
