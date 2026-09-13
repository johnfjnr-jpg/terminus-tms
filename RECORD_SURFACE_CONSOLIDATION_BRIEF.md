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

## R4 RE-RULED at Phase 1's launch (John, 2026-09-13)

**Phase 0 found R4's premise false**: the create-actions live in
`StageActions`, rendered by `ContactHost` - **the screen R5 would retire** -
not on the Contacts list. **The ruling was built on a wrong fact.**

**RULED (b): `contact-detail` is NOT retired this round.**

It uniquely provides **four** capabilities, **two named by no ruling**:
the account link and edit (R2), **PARK the contact**, and **STAGE
PROGRESSION plus create-from**. **Retiring it would drop Park and
create-from - a real regression.**

So this round:

- **R1**: the Contacts list row-click opens the **shared surface for the
  RECORD FIELDS**.
- **R2**: add the account section - a `Panel`, one source.
- **R3**: view/edit mode - Phase 0 confirms this is **a mode flag and an
  entry**, not a new surface.
- **R5 DEFERRED**: `contact-detail` **stays alive** for Park, stage
  progression and create-from **until those are rebuilt on the shared
  surface, in their own later round**. **Keep its view id and route**, so
  the eventual retirement is of `ContactHost` and `ContactPanel`, not of
  the view.

**AND THE FROZEN CONSTRAINT STANDS FOR ALL THREE.** Two of the three
dissolve only when `contact-detail` retires, and it does not. **Use
optional props; do not touch the frozen consumers.**

## R6 and R7, ruled after Phase 1's partial (John, 2026-09-13)

**R6 - THE "NOT LINKED" DEFECT IS FIXED NOW, as an opening act.** The route
does not return an account object; the screen reads `record.account?.name`;
**all 10 Qualified contacts show "Not linked" while linked.** Fix the route
to return the account - **the same one source R2's section reads.** It is
the prerequisite for R2 showing real data. **Prove it live, with a
screenshot.**

**R7 - R1 BECOMES ITS OWN ROUND.** **Land R2 this round**, fed by the fixed
route. **R1's surface swap is its own next round, with the 15-test
re-pointing as EXPLICIT budgeted work, re-pointed against the REQUIREMENT
rather than against the change** - the Verification 47 pattern the revert
avoided. **R1 rewrites a live screen; it deserves a round where honest test
re-pointing is the named job.**

**AND REGARDLESS: R3's `blocking={[]}` over-application is FIXED to
conditional** - markers only when something is missing. It is a defect this
session already identified.

## Phase 2: build R6 and R2. R1 defers to its own round.

**NOTHING IS RETIRED**, so the proof obligation changes:

- **prove the consolidated surface renders a CONTACT correctly**, with its
  account section, by live DOM and screenshot;
- **prove PARK, STAGE PROGRESSION and CREATE-FROM still work**, because
  they are exactly what the deferral exists to protect.

Stop at each phase for sign-off. **Nothing pushes.**

## AFTER PHASE 1: the walk is the gate

> **John walks the consolidated surface AS A CONTACT**: the account
> section, view/edit mode, **and confirms PARK and CREATE-FROM still work
> on `contact-detail`, which is not retired.**

**The Phase 1 report states that the walk is PENDING and REQUIRED before
this is called final.**


## Phase 2 (R6 + R2) - what landed

R6. THE ROUTE RETURNS THE ACCOUNT. `accountsFor(db, contacts)` in
    `src/routes/contacts.js` resolves `parent_record_id` to the account's
    latest revision, and BOTH `GET /contacts` and `GET /contacts/:id` call
    it. One derivation, so the list and the detail view cannot disagree -
    Verification 20 closed at the source rather than at each reader.
R2. THE SHARED SECTION LANDED ON THE BESPOKE SCREEN. `ContactPanel`'s local
    `Card title="Account"` is replaced by `AccountSection`, which now reads
    the route's `account` object rather than searching an accounts list.
    Both testids survive by name: five callers address them.

    THE RENDER RULE GAINED ITS SECOND HALF, on measurement. R2 as written
    ("renders for a contact, not for a lead") was correct for the lead card
    and would have taken the LINK PANEL off the bespoke screen, which is the
    surface where an account is linked. The rule is now: render when the
    record HAS an account, or when the host has given the section something
    to OFFER. Both halves are structural.

R8. THE FRAME DEFECT, FOUND BY OPENING THE SCREENSHOT AND FIXED HERE under
    build-discipline 10's limit. Swapping `Card` for the panel shell dropped
    `.pg-card`, so the account name rendered as bare text outside any border
    while all five siblings were framed, and the link control was clipped.
    Every assertion passed. `Panel` is the header-and-body contract, not a
    card, so the frame is now a `framed` prop the host passes.

R9. CARRIED, NOT FIXED (rule 10, not this round's authorship):
    - `NewLeadGrid.tsx` lines 14-18 state `jobRole` "IS IN THE RULED LAYOUT
      AND NOT IN THE SERVER'S SET". FALSE since 9f2c533 (LEADS P5 R11,
      2026-09-11) made it mandatory server-side. Architecture 9's fourth
      variant: a literal that rotted, which nothing can falsify.
    - `probe-gated-fields-reachable.mjs` had been dead since that same
      commit, dying on `missing: ["jobRole"]`. It is not a gate stage, so it
      rotted unrun for two rounds. Its fixture was corrected here (one key)
      and it passes; the wider question - how many non-gate probes have
      rotted the same way - is queued, not answered.
    - `LinkAccountPanel`'s button renders dim enough to read as disabled.
      Pre-existing, for John's eye.
