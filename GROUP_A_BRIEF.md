# Group A: shared surface layout

Governing docs: `CLAUDE.md`, the `tms-round-method` skill,
`INTERACTION_STANDARDS.md`. The conformance gate applies. Opened on
`e95bc11`, the tree the record-surface consolidation was published at.

## THE LIGHT PATH, and its limit

Per **PROPORTIONATE TESTING**, `DESIGN_PRINCIPLES.md` section 4, set at the
contact-mode close. These six are cosmetic and layout - **no data, no auth, no
decision changes** - so:

- the **affected suite**, plus a **screenshot of each changed screen at 1440**
- **NO full Phase 0 forensics. NO both-mode injection calibration.**
- **ONE gate run for the whole batch**, not one per item
- **the conformance gate still applies**: any control that renders routes
  through the shared components or it reds. That enforcement is cheap and it
  stays.

> **THE LIMIT, and it is the business's own: if an item turns out to change
> BEHAVIOUR rather than layout, THAT ITEM pulls onto the full path and is
> FLAGGED.** A behaviour change is not waved through as cosmetic. The round
> takes the heaviest path any of its items earns, per item rather than
> wholesale.

**Two items are named as suspects up front**, which is the honest place for
them:

- **A2** is an interaction change, not pure layout. **If it touches the note
  SAVE PATH, that part takes the full path.**
- **A5** is an interaction change. Confirm Create still opens and still
  creates, by screenshot and live DOM - **but no injection calibration unless
  the save path itself moved.**

---

## The six items, all John-ruled, all on the shared Lead/Contact surface

- **A1 - NOTES HEADER ON ONE LINE.** `Latest 2 / Last 10 / All` and `Add Note`
  belong on the **NOTES header line**. S1/S2 is the standard and it is
  unapplied here.
- **A2 - ADD NOTE BECOMES "SAVE" IN ADD-MODE.** One control, two actions: Add
  Note opens the field, and the label becomes **SAVE** to commit.
- **A3 - THE CONTACT SHEET ADOPTS THE LEAD SHEET'S ONE-ROW LAYOUT.** Summary,
  Notes and Follow-up across **one line**. **Ruled direction: the contact
  matches the lead, not the reverse.** Both modes.
- **A4 - THE COMPLETION PANEL MOVES BELOW.** "Please complete missing data"
  appears **below** Summary / Notes / Follow-up on the lead qualify sheet,
  not above it.
- **A5 - CREATE ON CLICK, ON BOTH SURFACES.** The Contacts **LIST's** Create
  changes from hover to **click**, matching the detail screen. **Ruled: both
  click** - more robust, and it works on touch.
- **A6 - REMOVE REDUNDANT LABELS.** The Summary panel title against its
  "Summary" field label, and the eyebrow "Contact details" against the first
  card's "Contact Details".

## Verify

| item | instrument |
|---|---|
| all six | the affected react suite green |
| A3, A6 | **screenshot a LEAD and a CONTACT** at 1440, so both modes are seen right |
| A1, A4 | screenshot the changed screen at 1440 |
| **A2** | the note **still saves** - live DOM |
| **A5** | Create **still opens and still creates** - live DOM |
| the batch | **ONE gate run** |

Stop for sign-off. **Then John walks the batch once, not per item. Nothing
pushes.**
