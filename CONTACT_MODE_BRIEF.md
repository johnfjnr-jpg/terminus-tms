# Contact-mode furniture: brief

Finishing R1 (c). Governing docs: `CLAUDE.md`, the `tms-round-method` skill,
`INTERACTION_STANDARDS.md`. The conformance gate applies. **Re-verify every
premise against the tree you are on.** This brief's R-series is its own.

Opened on `6a593da`. The scale principle applies: an internal tool, a small
team of up to five, **proportionate verification**.

## The context, from John's walk

R1 (c) made contact-detail render the shared surface, and it works - but it
renders **LEAD-mode furniture unconditionally on a CONTACT**. A Qualified
record is a contact, and it shows:

- the title **"Lead Details"**
- a **Qualified** status chip
- a **Nurture** button, which is a lead action
- inline **`+ CREATE  Test Bed | Opportunity`** buttons in the header

> **The surface must be MODE-AWARE.** Lead-mode keeps its lead controls;
> contact-mode strips the lead furniture and presents Create properly.

---

## Rulings of record (John, this walk)

- **R1 - TITLE.** "Lead Details" becomes **"Contact Details"** on the contact
  view. The lead view keeps its own title.
- **R2 - CHIP.** **Remove the Qualified status chip** on the contact view. It
  is implied by being on the contact screen.
- **R3 - NURTURE.** **Remove Nurture** on the contact view. It is a lead
  action and meaningless on a contact.
- **R4 - CREATE, REUSED NOT REMOVED.** Replace the inline Test Bed /
  Opportunity buttons on the contact view with a **single "Create" control
  opening the SAME dialogue the Contacts LIST screen uses**. **Create stays** -
  a contact does spawn test beds and opportunities - it is simply presented as
  one control plus the existing dialogue rather than header button-spray.
  Consistent with Round B's R4, that create-actions belong with the list's
  mechanism; this **reuses** that mechanism here.

**All four are CONTACT-MODE behaviours on the shared surface.** A LEAD still
shows its Qualified chip, its Nurture and its lead controls. **Only the
contact view changes. Lead-mode is not altered.**

---

## Phase 0 - MEASURE

1. **The Contacts list's Create dialogue: reusable component, or inline in
   the list screen?** **This decides the round's size.** If it is already
   shared, R4 points the contact view at it. If it is inline, R4 **extracts
   it first** - Verification 20, one dialogue and two entry points - and then
   uses it in both places.
2. **How the surface knows lead from contact today** (`record_type`,
   `status`, or something else), so mode-awareness keys on the **real signal
   rather than a guess**.
3. **What `StageActions` renders on the contact view** - the inline create
   buttons, Nurture - against what a contact should show. **Confirm that
   removing them from the contact view does not remove them from the LEAD
   view**: mode-scoped, never global.
4. **The title and chip source**, so R1 and R2 change the contact path only.

Stop for sign-off.

## Phase 1 - MODE-AWARE THE SHARED SURFACE

Contact-mode gets "Contact Details", no chip, no Nurture, and one Create
control opening the shared list dialogue. **Lead-mode unchanged.**

**Prove by live DOM and screenshot, OWNER view, on BOTH a lead AND a
contact**, so both modes are shown correct:

| claim | instrument |
|---|---|
| the contact shows all four changes | live DOM + screenshot |
| **the lead shows its own furniture intact** | live DOM + screenshot |
| the Create dialogue opens and creates from the contact | a real create |
| the door, both ways | owned and non-owned |
| the conformance gate is green | any new control routes through the shared components |

Stop for sign-off.

## After Phase 1

**John walks a contact AND a lead**, confirming each shows the right
furniture. **Nothing pushes.**
