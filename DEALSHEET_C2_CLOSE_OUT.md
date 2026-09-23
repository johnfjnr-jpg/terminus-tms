# Deal Sheet C2: close-out

Branch `dealsheet-2`, continued from `ada4df2`, off `main` at `aee3e98`.
Build discipline 19 governs: **no Superpowers skill was active in this
session**, no worktrees, no finish-branch or PR workflow, rule 18 absolute.

---

## RECONCILED BY COUNTING

| | Commit |
|---|---|
| Brief, Phase 0, Tier 1 (earlier in this round) | `7c64a00`, `f558114`, `ada4df2` |
| R-C2a and R-C2b | `a7797d7` |
| The edit controls | `80d9650` |
| Live 26/26 and two defects | `239e3dc` |
| Calibration 7/7, close-out, `CURRENT_STATE.md` | this commit |

**Rulings in force: 3** - the C2 brief, R-C2a and R-C2b, all quoted in
`DEALSHEET_C2_PHASE0.md` and this file.

---

## R-C2a: THE BOUNDARY STANDS

Unit costs render **read-only**, dimmed, each carrying the batch and
effective date it came from (`Initial catalog, from 2026-08-27`), under a note
saying they are catalog values shared by every deal and not editable here.

**There is no link, and that is measured rather than lazy.** There is no Base
Cost Data screen: Product Management is a **disabled nav button** and the
catalog has no UI at all. A link would point at nothing, which is the escape
route Verification 7's retirement clause is about.

**The duplicated enforcement is now a guard**, `scripts/tests/catalog-boundary`,
six assertions:

1. the writable allowlist was found at all, so nothing below passes over an
   empty list;
2. no catalog-only rate is in it;
3. the resolver **ignores** a catalog key carried in a payload, driven, with
   the overridable rates proving the same resolver does read what it should;
4. every catalog rate maps to a product;
5. the statement names only products the catalog has;
6. `hwWarranty` is not an overridable line, both in the key list and in the
   resolver.

**Without it the failure is silent in the worst direction**: adding
`ssUnitCost` to the allowlist would make an edit control appear to work while
the price never moved.

## R-C2b: THE EITHER-OR, GENERALISED

`priceOverrides`, keyed by the calculator's own line keys, honoured for the
hardware and installation lines through the same `buildCostGroup` that has
always honoured hosting's. Type the price and the margin derives; **the margin
cell then shows that derived figure, labelled `derived`, and stops being an
editor while the price drives it.** Clear the price and the margin is an
editor again.

**The warranty is untouched, and protected twice**: absent from
`PRICE_OVERRIDE_KEYS`, and its line never asks for an override. Asserted both
ways, and the second assertion exists **because a calibration injection came
back silent** - removing one layer changed nothing because the other held.

## THE REST OF TIER 2

Margin %, line price, unit counts and the hosting fee are editable in the
drawer of the line they drive. **The seam is the form's own store**, so an
edit calls the same `setValue` the pricing cards call: the statement, the
strip and the old panels are three readers of one value rather than three
copies kept in step. Save is the panel's own save; Reset re-reads the baseline
through `valuesFromPayload`.

**R-K** governs, this being a field panel rather than a form: Enter and
ArrowDown commit and move, ArrowUp moves back, Escape reverts, and **Enter
fires no record-wide save** - asserted live against the revision number.

---

## WHAT THE ROUND FOUND IN ITS OWN WORK

1. **THERE ARE TWO WRITABLE ALLOWLISTS, and Phase 0(b) checked one.** It was
   instructed to confirm every key the drawers write sits in the writable
   allowlist; it checked `COMMERCIALS_OWNED_KEYS`, the client's, and reported
   clean. The route refused the save with *"payload contains fields that
   cannot be set from this endpoint"*. **The only reason the probe could say
   so is that it captures the write's own answer** rather than only whether
   the revision moved.
2. **The editors first carried the old panels' ids**, putting two elements on
   one identity. `deal-identity` caught it, and `sections.ts` already warns
   why: *"readPayload reads whichever the DOM returns first"*. The binding is
   React state, so they need no id and now have none.
3. **The either-or was invisible.** A line with a price override showed an
   empty margin box, so both boxes were blank with the price driving - a state
   a reader cannot account for. Found by opening the screenshot.
4. **A stylesheet broken on `main` since C1**, found by Tier 1: a comment
   edited by inserting a paragraph that ended with its own closing delimiter,
   giving the opener a nearer closer. Fourteen lines parsed as CSS. A
   delimiter count stayed balanced; the pairing walk found it.
5. **Two probe faults, both Verification 7.** Expand-all is a TOGGLE and
   clicking it twice collapsed the drawers; and the 1240 pass asserted against
   a record the 1440 pass had saved, so each width now takes its own revision
   baseline and edits a line the other did not override.
6. **Two calibration injections came back SILENT and both were mine.** One
   named the test it was written for rather than the one it falsifies; the
   other did not violate the claim its test makes. The third silence was real
   and is closed by assertion 6 above.

---

## Exit gate

| Point | Answered |
|---|---|
| Build discipline 19 stated before work | **Yes**, and no Superpowers skill was active |
| Preconditions by `ls-remote` | **Yes**, `aee3e98` |
| Step 0 riders | **Yes.** Dead constants deleted, the property they described now asserted |
| Tier 1 E1 measured three widths, before and after | **Yes.** 2,445px to 221px at 3440 |
| R-C2a built, boundary guarded | **Yes**, six assertions, and the missing link reported rather than invented |
| R-C2b built, warranty untouched | **Yes**, protected twice and asserted twice |
| Edit controls through the record's own pipeline | **Yes.** One store, three readers, proven live |
| Modified-unsaved, Save, Reset | **Yes**, asserted live |
| R-K keyboard | **Yes**, including that Enter fires no save |
| DB read-back on every new key | **Yes.** `priceOverrides.hwSs` 400000, `aqm` 7, and the discarded margin absent |
| Frozen versions untouched | **Yes**, byte-identical after the save |
| Calibration both directions, one injection per new writable key | **Yes. 7/7**, two injections for the new key, one per allowlist |
| Live proof at 1440 and 1240 | **Yes. 26/26** |
| Screenshots opened and read | **Yes**, and two changed the work |
| Merged or pushed | see below |
