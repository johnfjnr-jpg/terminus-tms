# The LEADS CARD and QUALIFY-AS-CONVERSION round: brief

Governing docs, read before anything: `CLAUDE.md`, the `tms-round-method`
skill, `LEADS_BRIEF.md` and `LEADS_CLOSE_OUT.md` (this round supersedes
part of that round's P1). Drafted 2026-09-12; re-verify premises against
the tree you are on. This brief's R-series is its own.

**Standing verification for every phase:** live DOM and screenshot after
rebuild, with `scripts/check-dist-fresh.mjs` run BEFORE every live-DOM
measurement; the pre-commit hook runs all suites; **the eight
vanilla-asserting suites are not evidence about these screens.**

---

## First act, completed before Phase 0

**F6, the gate summarising a SKIP as a PASS.** Done, one commit,
`b721d99`.

- The summary never claims every stage passed when one did not run.
- `--round-close` FAILS on a skipped REQUIRED stage; the door stage
  carries `required: true`.
- An ordinary run on a machine with no browser behaves as it always has,
  because that decision is recorded in `verify-all.mjs` and is still
  right.
- Calibrated 5/5 by injection including the original fault restored and
  the opposite direction, plus end-to-end on the real gate both ways:
  **without a browser, `--round-close` exits 1** saying the run is
  unanswered; **with a browser, 22/22, exit 0.**

---

## Rulings of record (John, 2026-09-12)

**R1. QUALIFY IS A CONVERSION, and this SUPERSEDES the LEADS round's P1
Account-link precondition.** Qualify is no longer gated on a
pre-existing account link.

- The completeness gate for Qualify becomes **Contact Details, Address
  Details, Summary complete**. The account link comes OUT of the
  precondition set.
- Pressing Qualify on complete data opens the **ACCOUNT STEP**: link an
  existing Account, or create a new one.
- On resolving that step the conversion runs as **ONE ATOMIC
  TRANSACTION**: create or link the Account, create the Contact, flip
  status to Qualified. **All or nothing.** It must roll back cleanly if
  the account step is cancelled or the transaction fails. **No half
  state: no Qualified lead without an Account, no orphan Account.**
- **"Qualify pressed" and "lead is Qualified" are now distinct
  moments.** A lead can be mid-qualification and then cancelled.

**R2. THE CARD IS THE PRIMARY WORKING SURFACE, FULL WIDTH.**

- Company, Source and Created Date move onto the **lead name line**.
- Card actions: **Qualify, Nurture, Follow-up task, Address details.**
- Qualify: if data incomplete, a popup to complete it; then the account
  step; then R1's atomic conversion.
- Nurture: the follow-up dialogue, date and reason.
- Add Note and the inline follow-up stay as the LEADS round built them.
- **The door reaches every card write including the new buttons**, per
  card, calibrated both ways.

**R3. THE NEW LEAD GRID TAKES ALL FIELDS.** Every field is available for
entry, not only the mandatory set. The panel is **as wide as possible
and scrollable**.

**R4. LEAD DETAIL STAYS ALIVE AND FROZEN.** It is retired only after
John walks the card and confirms parity, and **that is not this round.**
Do not touch it, do not remove it, do not re-point its assertions.

**R5. Method unchanged.** Phases stop for sign-off. Rulings given in
conversation are appended to this brief **at the phase they launch** -
the LEADS round carried 8 while 11 were in force and the round before it
8 while 10 were, so this is the third consecutive round where that is
the named risk. Data changes proposed before applied. Nothing pushes
without the word.

**R6. THE GRID OWNS ITS DIRTY STATE** and reports it; the shell stops
inferring it. The shell-side guess cannot see a partial save, so the
one-line reset is REJECTED as insufficient. Proven three ways: the guard
does NOT fire on a saved or clean grid, DOES fire on a genuinely dirty
one, and DOES fire when a partial save leaves invalid rows behind.

**R7. THE ACCOUNT STEP REUSES `LinkAccountPanel`.** Link-existing and
create-new already work there. **Do not build a second picker.** Its
three separate writes move INSIDE the atomic conversion function: the
panel is the UI, the function is the transaction.

**R8. NO PERSISTED MID-QUALIFICATION STATE.** Qualify opens the account
step in memory; only resolving it calls the atomic function; cancel
discards the in-memory step and the lead stays Unqualified, untouched.
**Proven: cancel at the account step leaves zero new records** - no
orphan Account, no Contact, status unchanged.

**R9. GRID SIZING, confirmed with specifics.** John's direction is a
minimum sensible width per column with the panel scrolling horizontally,
so no column is crushed at fifteen. **Confirmed**, and specified in the
Phase 1 report rather than left as an adjective.

**R10. GATE GOVERNANCE IS ITS OWN ITEM, ruled but NOT built here.**
Recorded in the Phase 1 report with its reasoning. It touches every
close, so it is the opening act of a near-term round and calibrates on
its own.

**R11. ADDRESS DETAILS STAYS ALIVE ON AN UNOWNED CARD.** Ruled at the
Phase 2 sign-off. It is a read disclosure - six read-only values, and the
revealed panel holds **zero** controls, which is asserted rather than
argued. Neutralising it would re-create P3's recorded defect, *"a door
that had made an unowned lead unreadable"*, which that finding calls the
one thing the door must never do. Qualify, Nurture and Follow-up remain
neutralised.

---

## The round-close PROMOTION QUEUE

Candidates named at the phase that raised them, so the close rules on a
list rather than reconstructing one.

**F3, THE UNCLASSED-CONTROL CLASS.** Four instances across three phases,
and the estate has no instrument for any of them:

| instance | phase |
|---|---|
| the New Lead grid's Save shipped unclassed, a white button on a dark screen | LEADS P5 |
| Add note and Save task on the Lead cards, still unclassed | LEADS P3/P4, carried as F3 |
| the Qualify account step rendered TWO Cancel buttons, one unstyled | this round, Phase 2 |
| `LinkAccountPanel`'s search input has no `type` attribute, so it misses the estate's own input rule - on Lead Detail too | this round, Phase 2 |

**Why it recurs and why nothing catches it.** Presence, position,
disabled state and behaviour all read GREEN on a white browser default.
Every assertion an estate like this writes is about what a control IS and
what it DOES, and none is about what it LOOKS LIKE. Every instance so far
was found by a person opening a screenshot, which is Verification 4's
remedy and its limit: it works only when somebody looks, and only at what
is in frame.

**Not fixed here, by instruction.** The close rules whether this becomes
a check (a scan for interactive elements carrying no estate class, or a
computed-style assertion that no control renders on the default white)
or a rule.

---

## What "create Contact" means, resolved by the design of record

R1 says the transaction must *"create/link Account, create Contact, flip
status to Qualified"*. Measured before building, because the two readings
produce different functions:

- There are **no live `lead` records**. The live record types are
  account, contact, test_bed, document, unit, opportunity. The
  `record_type='lead'` route serves LEGACY rows that are deliberately
  left alone.
- **A Lead IS a `contact` row at status Unqualified.** `contact` stages
  are `Unqualified -> Qualified -> Nurture`.
- `frontend/index.html:107` states it as the design of record:
  **"one record, one stage chip, no separate Lead conversion."**

**So "create Contact" is the status flip on the SAME record, not a second
row.** Creating one would contradict the LEADS round's own design. The
transaction is: create-or-link the Account, set the lead's
`parent_record_id`, flip status to Qualified, append the revision, write
the audit row.

Recorded here rather than asked, because the design of record answers it
and a settled question is not an ambiguity.

---

## The opening fix: a defect, not design

The New Lead grid warns **"Discard unsaved changes?" on navigation after
a SUCCESSFUL save**, with the grid clean. John's screenshot: "1 lead
created", grid reads "0 ready", and the dialogue still fires.

**The save is not clearing the grid's dirty state.** Reproduce live,
fix, and prove the guard does NOT fire on a saved or clean grid and DOES
fire on a genuinely dirty one. Both directions, or it is not a fix.

---

## Phase 0: measurement only, read-only against product code

1. **The save-dirty bug.** Reproduce it live. Find where the grid's
   dirty state survives a successful save. **Name the instrument.**
2. **The current Qualify path, end to end.** Where the completeness gate
   lives, how status flips today, **whether ANY atomic transaction
   mechanism exists for a multi-record create**, and what P1's
   precondition gate must be superseded to, server-side.
3. **Account create and link.** Does an account picker or a
   create-account path exist anywhere today to reuse? Where do Accounts
   live, and how is `parent_record_id` set?
4. **The card surface.** What renders the card today, how much of R2's
   layout is a change versus a rebuild, and whether full width fights
   any existing container.
5. **The New Lead grid.** Current field set versus all fields, and the
   width and scroll constraint.

**The load-bearing question is the atomic transaction: does the
mechanism exist, or must it be built?** Everything about R1's scope
follows from that answer.

Stop with the Phase 0 report: the bug's cause, the Qualify conversion's
real scope, the account create/link surface, the card and grid deltas,
and the decisions Phase 1 needs from John. **Nothing pushes.**
