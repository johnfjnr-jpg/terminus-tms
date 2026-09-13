# LEADS ROUND B: the RECORD SURFACE CONSOLIDATION - brief

Governing docs: `CLAUDE.md`, the `tms-round-method` skill, and
**`INTERACTION_STANDARDS.md`**. **The conformance gate applies, and it is
now polarity-inverted**: a heading- or action-shaped class on a Leads
surface is an offender **unless** the shell emits it or it is declared by a
call. **Anything this round builds is governed by it.**

A Phase 0 measurement already exists, in
`LEADS_DETAILS_CONSOLIDATION_PHASE_0_REPORT.md` - the one that found the
original premise false. **Re-confirm its key facts against the current
tree; do not re-measure wholesale.**

## Standing verification

- **Live DOM plus screenshot** after a rebuild, `check-dist-fresh.mjs`
  first, at **1240 / 1920 / 3440**.
- **ASSERT RELATIONSHIPS BETWEEN ELEMENTS, NEVER A PROPERTY OF ONE.**
- **The door both ways.** The **hook runs all suites.**
- **WATCH build discipline 3 AND VERIFICATION 47's NEW REMEDY: take a
  threshold from the REQUIREMENT, never from the result.** **This round is
  the test of whether that remedy reduces the proxy-fault recurrence**, and
  the close reports on it either way.

## THE MODEL (John-ruled, design of record)

> **A lead and a contact are the SAME RECORD at different lifecycle
> stages.**

- A **lead** - Unqualified or Nurture - is worked **on the card**.
- On qualification it **GRADUATES** to a **Contact**: it has an account,
  and it is worked **off the card**.
- **Both use ONE record surface that scales by stage.** The shared in-card
  surface - Contact Details, Address, Summary, Notes, Follow-up - **IS the
  detail view. A Contact is that surface PLUS an account section.**

## What the prior Phase 0 established - re-confirm, do not reassume

- **`contact-detail` is the messy bespoke screen** and the **only** detail
  view for the ~10 live **Qualified** contacts; the Leads card filters to
  Unqualified and Nurture.
- **Retiring it naively STRANDS those contacts**, which is why the
  consolidation **replaces its LAYOUT with the shared surface** rather than
  removing the screen concept.
- The in-card surface opens today in **COMPLETE-THE-MISSING** mode
  (Qualify); a **VIEW/EDIT** mode is needed.

## Rulings of record (John)

**R1 - THE SHARED SURFACE BECOMES THE CONTACT DETAIL VIEW.** The Contacts
list row-click opens the **shared record surface**, not the bespoke
`contact-detail` screen. Same surface, same standard.

**R2 - AN ACCOUNT SECTION, CONTACT-ONLY.** A contact has an account; a lead
does not - it gets one at qualification. The shared surface gains an
account section that renders **for contacts and not for leads**. **Built as
a `Panel` per the standard, so the gate governs it.**

**R3 - VIEW/EDIT MODE.** The surface renders cleanly for a complete record:
all fields editable, **no "please complete missing data" framing, no
missing markers when nothing is missing.** Qualify still opens
**COMPLETE-THE-MISSING**. **Same surface, two entry modes.**

**R4 - CREATE-ACTIONS STAY ON THE CONTACTS LIST.** Test Bed and Opportunity
creation stays where it is this round. **Do not touch that functionality.**

**R5 - RETIRE THE BESPOKE `contact-detail` SCREEN** once the shared surface
serves contacts. **Full retirement inventory FIRST**: routing, links, the
view id, probes, gate and tests, **and the three-consumer frozen constraint,
which DISSOLVES when `contact-detail` retires** - confirm no other frozen
consumer remains for `NotesHistory`, `FollowUpTask` or `LeadFieldInput`.
**Retire cleanly: nothing stranded, nothing left pointing at it.**

## Phase 0: confirm, and take the retirement inventory

1. **Re-confirm**: `contact-detail` serves the Qualified contacts, the
   count, and the row-click routing.
2. **R3**: does view/edit mode exist on the in-card surface, or is it a
   build? **Build-or-not sizes the round.**
3. **R2**: where account data lives, what an account section renders, and
   how it is fetched - **one source, no second reader.**
4. **R5**: the **FULL inventory** of what points at `contact-detail` - the
   safety-critical list that makes the retirement clean - and confirm the
   three-consumer constraint dissolves.
5. **R1**: the Contacts list row-click wiring, and what changes.

## Phase 1: build R1, R2, R3 and the retirement (R5). R4 untouched.

**THIS ROUND RETIRES A SCREEN SERVING LIVE RECORDS**, so:

- **prove the consolidated surface renders a CONTACT correctly**, with its
  account section, by live DOM and screenshot;
- **prove the retirement strands nothing**: every contact reachable, every
  pointer updated.

Stop at each phase for sign-off. **Nothing pushes.**

## AFTER PHASE 1: the walk is the gate

> **John walks the consolidated surface AS A CONTACT. This is the
> load-bearing parity check and the gate on retiring `contact-detail`.**

**The Phase 1 report states that the walk is PENDING and REQUIRED before
the retirement is called final.**
