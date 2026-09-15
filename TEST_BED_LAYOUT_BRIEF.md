# Test Bed layout: brief

Governing docs: `CLAUDE.md`, the `tms-round-method` skill,
`INTERACTION_STANDARDS.md`. Conformance gate applies. Opened on `c1d8fd6`.

## MIXED PATH, and the split is per item

Per proportionate testing (`DESIGN_PRINCIPLES.md` section 4):

- **R1, R2, R3 - cosmetic to medium.** Layout and reuse. The affected suite, a
  screenshot of each changed screen, **and of the shared panel's other
  consumers if the component itself changes.**
- **R4 - FULL PATH.** A broken data control is not cosmetic. Root cause found
  before it is fixed, both directions proven, and **the control CLICKED rather
  than its function called** - the Create-bug probe gap, which passed on a dead
  control because it asserted presence rather than the user path.

**One round, ONE gate run.**

---

## The four items, John-ruled from his walk

### R1 - Summary / Notes / Follow-up into the shared header panel

Summary and Notes already exist at the **bottom** of the Test Bed screen. Move
them to the **header**, using the **SAME shared panel leads and contacts use**
(Group A's one-row Summary / Notes / Follow-up), beside the Test Bed name.
**Follow-up arrives WITH the component** - Test Bed does not have it today and
gets it by reuse. **Test Bed becomes the panel's THIRD consumer.**

> **BLAST RADIUS, as forethought.** The panel is shared with leads and
> contacts. **If making it fit Test Bed needs any change to the shared
> component, leads and contacts are screenshotted too** - all three consumers,
> not just the one being built. Phase 0 measures whether the panel takes the
> Test Bed data shape cleanly **or needs a variant.**

### R2 - Key Dates beside Site Details

"Dates" is a separate section lower down. **Move it into a right-hand panel
beside Site Details.**

### R3 - Sensor Counts and Costs to the Commercials tab

Sensor Counts is on the Reference tab, as is the full cost breakdown. The
Commercials tab is near-empty. **RELOCATE the existing panels between tabs -
not new panels.**

### R4 - The missing contacts dropdown - FULL PATH

Client Commercial / Technical / Legal Buyer **should be selectable from the
account's contacts. The dropdown does not appear.**

- **Phase 0**: reproduce live, and ask whether this shares a root with the
  **industry-picker** and **contact-dropdown** bugs - a picker fed the wrong
  data, or a key mismatch. **Find why it does not populate.**
- **Phase 1**: fix it, and **prove by OPENING the dropdown live and SELECTING a
  contact** - clicking the real control, with a screenshot of the populated
  dropdown.

---

## Phases

**Phase 0 - measure and size**: R1's panel reuse (clean, or a variant, and the
radius across three consumers) · R2 and R3, what moving the panels touches ·
**R4's root cause, reproduced live.**

**Phase 1 - build**, verified per item on the path it earns.

Stop at each phase for sign-off. **John walks the Test Bed screen once at the
end, and a lead or contact if the shared panel changed. Nothing pushes.**
