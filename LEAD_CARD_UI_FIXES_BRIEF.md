# The LEAD CARD UI FIXES round: brief

Governing docs: `CLAUDE.md`, the `tms-round-method` skill,
`LEADS_CARD_POLISH_2_CLOSE_OUT.md` and
`COMPLETION_SURFACE_FIX_CLOSE_OUT.md` for what the card already is and
what it is still carrying. Drafted 2026-09-12 from John's walk of the
card; re-verify premises against the tree you are on. This brief's
R-series is its own.

## Standing verification for every phase

- **Live DOM plus screenshot** after a rebuild, `check-dist-fresh.mjs`
  first, at **1240 / 1920 / 3440**.
- **The door both ways** for any write control added or moved.
- The **pre-commit hook runs all suites**; a red tree does not commit.
- **The vanilla-asserting suites are not evidence about these screens.**
  Verification 41's standing qualification: 52 id-assertions across eight
  gate suites read markup that renders nothing. A green suite is not
  offered as evidence for the card.

## Rulings of record (John, 2026-09-12, from the walk)

R1. **ACCOUNT PICKER becomes a TYPE-AHEAD DROPDOWN.** The current
    button-spray, a row of match boxes, is replaced by a single dropdown
    filtering per keystroke. **The create-new control goes to the RIGHT
    of the input, not below.** Built **CLEANLY but CARD-LOCAL**: it is
    **not** generalised into a shared selection component. Region (a
    fixed geographic list, a plain select, no search) and the future
    Names picker (a managed admin list, not built) are **different
    selection types**. Extracting a shared type-ahead waits until Names
    gives it a real second consumer. **Premature abstraction is this
    round's named risk.**
R2. **TIMESTAMP FORMAT.** A raw ISO timestamp shown to a person is a
    **DEFECT, not frozen-by-design**. The format is **`DD/MM/YY
    HH:MM:SS`**, applied **everywhere any timestamp renders**, including
    frozen Lead Detail: **the freeze is against structural change, not
    against fixing a shared rendering defect.** Phase 0 **must** find
    every place a timestamp renders and establish whether there is **ONE
    formatter or many**. If many, they are routed through one, or the
    next new timestamp renders raw and is found on a future walk. **This
    is the anti-rework requirement** and it is the region-drift shape.
R3. **NOTES HEADER ON ONE LINE.** The NOTES title, `LATEST FIRST`, Add
    note and Discard all sit on the header line; the note input then
    aligns with the Summary field's column below. The current layout
    stacks them and misaligns: **"slapdash"**, John's word.
    `NotesHistory` is shared with frozen Lead Detail, so this arrives as
    **optional props** and does not change Detail's structure.
R4. **REMOVE "No notes yet."** It is redundant: the empty area shows
    there are no notes.
R5. **RECLAIM THE EMPTY SPACE** at the bottom of the lead panel. **Do
    not touch the frozen follow-up panel**; if the space is the follow-up
    panel's, **note it and leave it.**
R6. **DOCUMENT THE CONVENTIONS** this round establishes as **written
    conventions**, so the Contacts screens inherit the decisions instead
    of re-deriving them by walk. **A written contract, NOT a code
    abstraction**: abstraction waits for real second consumers. This is
    John's explicit anti-rework ask.

R7. **TIMESTAMP MODULE.** **ONE module, TWO functions**:
    `formatTimestamp` (`DD/MM/YY HH:MM:SS`) and `formatDate` (`DD/MM/YY`,
    no time). **All 16 sites route through it**: a date site uses
    `formatDate`, a timestamp site `formatTimestamp`, **and no site
    renders raw.** Proven **by census**: zero raw-ISO renders remain and
    every site routes through the module. **This reaches frozen Lead
    Detail's timestamps**, per R2's shared-rendering-defect rule.
R8. **R3 PLUS F3.** The notes header buttons are **classed as part of
    R3**: the 12px residual misalignment **IS** the unclassed-button
    height, so the alignment cannot be fixed without it. **This retires
    one F3 instance.** The `NotesHistory` **three-consumer constraint
    holds**: the card, frozen Lead Detail **and the Test Bed**. Optional
    props, and no structural change to Detail or to the Test Bed.
R9. **R5 IS ACCEPTED AS MEASURED.** R4 already reclaims the band at 1920
    and 3440, 57px. At 1240 the 218px frozen follow-up panel drives it
    and it is left as ruled. **R5 needs no separate work.**

R10. **THE NOTE TEXTAREA STAYS CLASSED.** R3 pairs it visually with the
    styled Summary field, so an unstyled textarea beside a styled one is a
    **new instance of the F3 defect this round retires**. (Had it been ruled
    out, the removal would have been recorded as a known F3 instance
    instead.)
R11. **`--red` AND `--amber` ARE QUEUED, NOT FIXED.** Used in
    `style.css` and defined nowhere, always with a literal fallback so they
    render. F3-family, pre-existing, unrelated to this round's scope.
    Confirmed carried at the close.

## Frozen by ruling

- **The follow-up panel**, rebuilt in the follow-up-entity round.
- **Lead Detail, STRUCTURALLY.** Its assertions are not re-pointed and
  its structure is not changed. **The single exception is R2**, a shared
  rendering-defect fix that reaches it, ruled by John.
- **No premature component sharing this round** (R1).

## Phase 0: measurement only, read-only

1. **R1**: the current account picker. Where it renders the match boxes,
   whether its search is client-side, and what a dropdown plus
   create-right replaces. Card-local scope confirmed.
2. **R2**: **every** place a timestamp renders, and whether one formatter
   exists or each renders independently. This decides R2's real scope.
   Frozen Lead Detail's timestamps included.
3. **R3**: the current notes header and input layout, and what optional
   props R3 needs without touching Detail.
4. **R4**: where "No notes yet." renders.
5. **R5**: what occupies, or fails to occupy, the empty band. Is it the
   frozen follow-up panel's, or reclaimable card space?
6. **R6**: the conventions R1 and R3 will establish, for documentation.

## Phase 1: the build (R7, R1, R3+R8, R4, R6)

- **R7**: the timestamp module, all 16 sites routed, zero raw renders,
  census-proven, reaching Lead Detail's timestamps.
- **R1**: the type-ahead dropdown, create to the right of the input,
  card-local as `AccountPicker.tsx` importing `findAccountMatches` -
  **the match definition is shared, the component is not.** No premature
  generalisation: Region and Names are different selection types.
- **R3 + R8**: the notes header on one line, the input aligned to the
  Summary column, the buttons classed. Optional props, three consumers
  unbroken.
- **R4**: remove "No notes yet.", which delivers R5 at the wide widths.
- **R6**: document the conventions for the Contacts screens.

**The door both ways for any write. Every state screenshotted THROUGH
THE ELEMENT, never a page-coordinate clip** - Phase 0's own V4 fault.
Heights at three widths wherever layout moves. Frozen: the follow-up
panel, Lead Detail's structure, the Test Bed's structure. Stop for the
Phase 1 report. **Nothing pushes.**

## Phase 0's deliverable

Stop with the Phase 0 report: R1's scope, R2's formatter finding (one or
many, the anti-rework crux), R3's props, R4 and R5 deltas, and the
decisions Phase 1 needs. **Nothing pushes.**
