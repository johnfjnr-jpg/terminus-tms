# Test Bed layout moves: brief

Governing docs: `CLAUDE.md`, the `tms-round-method` skill,
`INTERACTION_STANDARDS.md`. Conformance gate applies. Opened on `9ade7ca`.

**MIXED LIGHT-MEDIUM PATH** (`DESIGN_PRINCIPLES.md` section 4): layout and
panel moves, **no data, no auth, no behaviour change**. The affected suite, a
**screenshot of the changed screen**, and **ONE gate run**.

**Test Bed already has the clean notes/audit split** - measured last round:
editable `payload.notes` through `NotesHistory`, and a separate `HistoryPanel`
over `audit_log`. **So these are PURE layout.** The notes/audit split is a
different round.

---

## The three items, scoped last round

### R1 - Summary / Notes / Follow-up to the header

Move them from the **bottom** of the Test Bed screen to a **one-row panel beside
the Test Bed name**, matching the leads/contacts header layout.

**Layout only, NOT the notes/audit split.** Test Bed's Notes is already
editable and its History is already separate.

> **BLAST RADIUS**: if this reuses the shared header panel and **the shared
> component changes**, leads and contacts are screenshotted too.

### R2 - Key Dates beside Site Details

"Dates" is a section lower down. **Relocate it into a right-hand panel beside
Site Details.**

### R3 - Sensor Counts and Costs to the Commercials tab

**CAUSE ALREADY SCOPED, one line**: `TestBedHost.tsx:526` passes
**`commercials={null}`** into the slot `StageTabs.tsx:211` renders. **Fill the
slot, move the two Cards there.** The 9 static cards in `index.html`'s
`#tb-tab-commercials` are **DEAD markup that never renders** - ignore them.

> **DESIGN RISK, flagged last round and carried into this brief.** Moving the
> Cards out of `TestBedPanel` takes them from its **single `useFieldRows` draft
> store**. A second panel is a **SECOND draft store - two editors of one
> record**, which is the stale-state family.
>
> **USE THE A4 PORTAL PATTERN**, the one that kept the completion surface in a
> single store.
>
> **PROVE THERE IS ONE STORE AFTER THE MOVE, NOT TWO**: edit a **moved** field
> and a **stayed** field, save once, and both persist with no stale state.

---

## Phases

**Phase 0 - size and confirm, not full forensics.** R1: does the shared header
panel take the Test Bed shape, or does it need a variant - and the radius if it
changes. R2: what moving Dates touches. R3: confirm the slot-fill, and that the
portal keeps one draft store.

**Phase 1 - build all three.** Suite plus a screenshot of the Test Bed screen,
and of leads/contacts **if the shared panel changed**. **R3 additionally proves
the single draft store.** One gate run.

Stop at each phase for sign-off. **John walks the Test Bed screen once, and a
lead or contact if the shared panel changed. Nothing pushes.**

## Recorded, not opened

**The leads/contacts notes/audit split** - server write-path, its own round,
and **the 20-entry ruling is reconfirmed at that round's open** because the
shape changed after it was given.
