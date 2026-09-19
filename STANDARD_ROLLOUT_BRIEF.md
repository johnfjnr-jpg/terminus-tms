# Standard rollout batch: Accounts, Test Bed, Opportunities

Governing docs: `CLAUDE.md`, the `tms-round-method` skill,
`INTERACTION_STANDARDS.md`. Conformance gate applies. Opened on `b390dc3`.

**LIGHT PATH** (`DESIGN_PRINCIPLES.md` section 4): a cosmetic field-display
swap, no data, no auth, no behaviour. The affected suite, a **screenshot of
each changed screen at 1440**, and **ONE gate run for the batch**.

**This supersedes Group B**, whose B2 (Opportunities) folds in here as the
third screen. B1 (Accounts linked-contacts grid) is NOT in this round.

## What this is

**The rollout of the standard as each screen is touched.** These are old
screens the standard never reached - the same field-display swap R1 did for
contacts.

| screen | the white fields John named |
|---|---|
| **ACCOUNTS** | Website URL, City, Site Address (billing and shipping) |
| **TEST BED** | No. of SafeSight Cameras, Site Address, Test Bed Duration, **and any other white field on the screen** |
| **OPPORTUNITIES** | the white input boxes (this is B2) |

> **B2 WAS NOT CLOSED BY THIS ROUND, and this round's close-out says the
> opposite.** It retracted the commercial-inputs diagnosis and fixed a different
> cause - `FieldRow`'s untyped `<input>` - correctly, on four FieldRow surfaces.
> The Commercials panel's inputs are not FieldRow rows, so that rule never
> reached them and 62 of them were still white. **The original diagnosis was
> right and the retraction was wrong**, and B2 was on no carried list in between.
> **Closed in the scoring-selector round**; the full history is in
> `SCORING_SELECTOR_BRIEF.md`.

## THE BLAST-RADIUS RULE APPLIES

From the Create-bug close, promoted under Verification 20:

> **A change to SHARED code - a selector or class other screens also use -
> needs its blast radius checked across every surface that shares it.** Blast
> radius is a property of the code, not of the round.

**Do not regress a screen this round did not set out to change.**

## Phase 0 - SIZE IT, do not full-forensic

1. **Which fields on each screen are white or pre-standard**, and whether the
   same swap applies to all three.
2. **Does any screen carry a FIELD-KEY SEAM** like contacts' `industry_id` - a
   field showing wrong because the data key does not match what is rendered?
   **If a seam exists, that field's fix handles it**, rather than being
   discovered during the build.
3. **Blast radius** for whatever the swap touches.

## Phase 1

Build all three. **Verify light, per screen**: the affected suite, a
**before-and-after screenshot**, and **no white remaining**. **ONE gate run.**

**The limit applies**: anything that turns out to change behaviour pulls that
item onto the full path and is flagged.

Stop for sign-off. **John walks the three screens once. Nothing pushes.**

## Recorded, NOT opened: TEST BED LAYOUT

The next round, on John's go:

- Summary / Notes / Follow-up into the **shared header panel** - reuse Group
  A's component, **Test Bed becomes its third consumer**, follow-up comes with
  it, **blast radius checked against leads and contacts**.
- **Key Dates** beside Site Details.
- **Sensor Counts and Costs** to the Commercials tab.
- **The missing contacts dropdown - FULL PATH.**

Medium, mostly reuse and rearrangement.
