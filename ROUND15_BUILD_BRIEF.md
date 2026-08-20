# Round 15 build brief: date validation, keyboard entry, numeric fields, cost summary

Source of truth: `CLAUDE.md`, `CURRENT_STATE.md`, `DESIGN_PRINCIPLES.md`,
`PROTOTYPE_SPECIFICATION.md`, `INTERACTION_STANDARDS.md`,
`ROUND14_BUILD_BRIEF.md`. Read all six before starting.

**`CLAUDE.md` was edited twice in Round 14.** Verification 13 and 14 were
added. Re-read from disk before doing anything, per the standing rule, and
say whether the copy you hold is current rather than assuming either way.

Every item came from the business using the merged Round 14 build. Five
items, all small to medium, all genuinely independent of each other.

Work through phases in order. Stop after each, report real test evidence,
wait for sign-off before starting the next.

---

## Amendments after Phase 0

| # | Phase | Change |
|---|---|---|
| 1 | 0, 2 | **Round 10 Phase 0A, not Round 12.** Three citations corrected |
| 2 | 5 | **The new title is "Qualification score"**, sentence case, matching the house convention and the stage panel |
| 3 | 4 | **Judged against 78px at 1920x950 and 343px at 1240**, not 306px. The carried item migrated |
| 4 | 1 | **Follows the existing `key in payload` guard shape**; its message names labels, and the nine adjacent payload-key messages are a separate item |

---

## Scope boundaries, confirmed with the business

- **The Site Details merge is deliberately not in this round.** The
  business asked for Site Ownership, Inst. Env., Site Address and City to
  move to Customer Details with the Site Details panel removed. Sensors
  currently lives in that panel and moves to a sub-tab in Round 16, so
  doing the merge now means moving Sensors twice and measuring the
  Reference grid twice. **Both ship together in Round 16.**
- **Sub-tabs are Round 16.** Use Cases, Customer Documents and Sensors
  behind a tab strip under the Reference panels, built as a reusable
  component because Round 17 needs the same pattern.
- **Unit records are Round 17.** Serial numbers and coordinates per
  deployed unit, derived from the Commercials counts. Photographs wait for
  the Google Drive question, which the business is settling separately and
  in one go.
- **No gate rule changes.** `stage_gate_rules` ends this round unchanged at
  61 total, 45 on `test_bed`.
- **No anchor wording changes.** The business review still has not
  happened and carries nine items.
- **Record history is deferred for a sixth time.** State it plainly in the
  close-out as a choice.

---

## Standing rules that bear on this round

1. **Verification rule 7, the counterfactual**, and its two twins added in
   Round 14. **Verification 13**: a count of zero from an instrument never
   shown to reach one is not a measurement. **Verification 14**: a check
   that passes when both sides are absent is not a check. Rounds 12, 13 and
   14 each produced seven probe defects and zero product defects in the
   code under test. This round has drivers in four phases.

2. **Build discipline 8: fix the class, not the instance the failure
   named.** Phase 3 is the clearest case this project has had. The business
   reported arrow keys on the Commercials tab; the behaviour is native to
   every `type="number"` input in the application.

3. **The re-render constraint.** The scoring and exit criteria panels are
   rewritten by `innerHTML`, so state applied during typing must be a
   direct DOM mutation. Phase 2 touches the click-to-edit mechanism that
   every panel shares.

4. **Presence is not legibility, and measure the container.** Phase 4 adds
   a panel to a tab that already carries a recorded density problem.

---

## Phase 0: Investigate and report. No building.

Report before Phase 1 starts.

1. **Every date field on Test Bed and how each is validated today.**
   Round 3 Phase 3 established which Opportunity dates may be in the past
   and which may not. Report the equivalent for Test Bed, including whether
   any cross-field validation exists anywhere in the application, and where
   date rules are enforced: client, server, or both.

2. **Every numeric input in the application.** This is Phase 3's survey and
   the phase cannot be scoped without it. Report every `type="number"`
   input across every screen, with its field name, its screen, and whether
   it accepts decimals. Rounds 3 Phase 4 and 8 Phase 2 both removed visible
   spinner arrows; report exactly what those changes did and did not cover,
   because the keyboard behaviour survived both.

3. **The click-to-edit keyboard path.** Round 10 Phase 0A (**AMENDED after Phase 0**, the brief said Round 12) made one click
   both reveal and open a control, guarded by an explicit `fromUserGesture`
   flag. Report what happens today when a user tabs to a field and types a
   character: where focus lands, what the display element does, and why
   Enter works and a printable character does not. Report all four
   `open*Field` implementations, since Round 10 Phase 0A found the pattern
   duplicated across Test Bed, Opportunity, Contact and Account.

4. **The Commercials cost panels.** Report the current layout of the
   itemized breakdown and the input rate cards, the position of Total Cost,
   and the measured height of everything above it at 1240 and 1920. Round 8
   recorded Total Cost sitting 306px below the fold at 1920, with the
   levers named as the 145px navigation band, the 96px tab row and the
   379px input-rate panels, and never actioned. **Report whether that is
   still true**, given the sticky tab row added in Round 13 Phase 5 and
   every layout change since.

5. **The Reference summary card's title.** Report where it is set, and
   confirm the stage tab scoring panel's title, so Phase 5 does not create
   two panels whose names differ only by accident.

6. **Baseline the suite.** `npm test` and `npm run test:db` on a clean
   checkout of `main`. Keep the full output. Check residue before running
   and again after, paging every harness-wide query, since PostgREST's
   1000-row default silently truncated a delete in Round 13.

---

## Phase 1: Est. Go Live cannot precede Est. Installation Date

Reported by the business. No cross-field validation exists.

Enforce it **client-side and server-side**. The client is an affordance and
the server is the guarantee, per Round 13 Phase 1 and Round 14 Phase 1.

**Three cases to decide and state rather than let fall out**, and Phase 0
item 1 informs each:

1. What happens when only one of the two is set.
2. What happens when a user edits the installation date to a value later
   than an existing go-live date, which is the same violation approached
   from the other side.
3. Whether existing records violate the rule. **If any do, they must not
   become unsaveable.** That is the edit-lock hazard recorded from
   2026-08-15, when a `NOT VALID` constraint locked eight Test Beds out of
   being edited including for soft-delete, and flagged again in Round 10
   Phase 3. Guard validation on the submitted keys, never the merged
   payload.

**AMENDED after Phase 0: follow the guard shape that already exists rather
than inventing one.** Both existing date checks in `src/routes/test-beds.js`
are written `if (key in payload && ...)`, which validates only the keys
actually submitted. That is already the edit-lock-safe form Phase 1 case 3
requires, so the cross-field check follows it rather than reading the merged
payload.

**The message names the labels, and the nine adjacent messages are a SEPARATE
ITEM.** Phase 1's own message says "Est. Go Live" and "Estimated Installation
Date". The two existing messages beside it say `estimatedInstallationDate` and
`estGoLiveDate`, and **there are nine such messages across
`src/routes/test-beds.js` and `src/routes/opportunities.js`, with no
server-side key-to-label map anywhere.** Fixing the two that happen to sit
next to this change would fix two of nine and leave seven, which is Build
discipline 8 pointing the other way: a partial fix to a class is how the class
survives. Recorded as its own item, not done here.

**Test evidence required:** the violation refused from both directions,
server-side with the browser bypassed. Confirm a record already holding a
violating pair can still be saved when an unrelated field changes. Confirm
the message names the fields in the terms the user sees them, not the
payload keys, which Round 12 recorded as a fault of the cross-tab batch
save.

---

## Phase 2: Typing into a tabbed-to field

**Round 10 Phase 0A's problem arriving by keyboard.** (**AMENDED after Phase 0**: the brief cited Round 12. `ROUND10_BUILD_BRIEF.md` carries nine mentions of Phase 0A, Round 12's carries none, and all four code comments say Round 10. The precedent exists; only the attribution was wrong.) That phase made one
click both reveal and open a control. Today, tabbing to a field lands focus
on the display element, Enter opens it, and typing a printable character
does nothing.

A user tabbing through a form and typing expects the character to be taken.

**Requirements:**

1. A printable character typed on a focused display element opens the field
   **and is taken as the first character**, not discarded.
2. Enter continues to work as it does today.
3. **Navigation keys must not open a field.** Tab, Shift-Tab, arrow keys
   and modifier combinations are not printable input, and opening a field
   on Tab would make it impossible to move through a form without editing
   everything on the way.
4. **Apply to all four `open*Field` implementations**, not the one
   reported. Round 10 Phase 0A found this pattern duplicated across Test
   Bed, Opportunity, Contact and Account, and fixed it with one shared
   helper.

**Watch the interaction with Phase 3.** If a numeric field stops being
`type="number"`, its accepted characters change, and the two phases touch
the same fields.

**Test evidence required:** type a character on a tabbed-to text field, a
number field, a date field and a select, and report what each does. Confirm
the character is taken rather than the field merely opening empty. Confirm
Tab and arrows do not open a field, proven by tabbing across a full panel
and confirming nothing entered edit mode. Confirm all four implementations
behave identically, proven on all four screens rather than one.

---

## Phase 3: Numeric fields stop using `type="number"`

**The business reported arrow keys changing values on Commercials. The
behaviour is native to every `type="number"` input in the application**, so
this is a class fix. Build discipline 8.

Rounds 3 Phase 4 and 8 Phase 2 both removed the visible spinner arrows.
Neither could remove the keyboard behaviour, because it is intrinsic to the
input type.

**Use `type="text"` with `inputmode="numeric"`**, the pattern GOV.UK's
Design System recommends for values that are not genuinely spinnable
quantities, and which `INTERACTION_STANDARDS.md` already cites as a
reference standard. Mobile keeps the numeric keypad.

**Four things this must not break, each recorded as a real fix:**

1. **Decimal precision.** Round 3 Phase 4 recorded that an initial
   integer-only pass was too broad and was corrected after a live bug,
   because some fields carry real financial precision. Phase 0 item 2
   reports which accept decimals.
2. **Negative and non-integer rejection.** Round 3 Phase 3 fixed Contract
   Duration accepting negatives. That must still hold.
3. **Server-side validation.** Whatever the input type, the server rules
   are unchanged. Confirm rather than assume.
4. **The spinner-arrow CSS.** Two blanket rules exist from Rounds 3 and 8,
   scoped to `#opp-tab-commercial` and `#tb-tab-commercials`. If no
   `type="number"` remains, they are dead. Report before removing, and
   remove them if genuinely dead rather than leaving rules for a state that
   cannot occur.

**Test evidence required:** arrow keys on a converted field change nothing,
proven before and after. Every field that accepted decimals still does, and
every field that rejected negatives still does, tested field by field
against Phase 0 item 2's survey rather than on a sample. Server-side rules
unchanged, called directly. Confirm `inputmode="numeric"` is present, since
without it this change makes mobile entry worse.

---

## Phase 4: A cost summary panel on Commercials

The business asked for a summary of total cost by category, Hardware,
Installation and Hosting, positioned left of the Hardware panel, so totals
read before breakdowns.

**This may be the answer to a carried item rather than a new change.**
**AMENDED after Phase 0. The carried item MIGRATED, and the numbers to judge
this phase against are not the ones the brief carried.** Measured at Round 8's
own viewport rather than a convenient one:

| Viewport | Total Cost top | Below the fold by |
|---|---|---|
| 1240 x 800 | 1143px | **343px** |
| 1920 x 950, Round 8's own | 1028px | **78px**, was 306px |
| 1920 x 1080 | 1028px | fully visible |

**Two things follow, and the second is the finding.** The gap at 1920 closed by
**228px through changes made for other reasons**: Round 13's sticky tab row cut
the tab band from 96px to 82px, and the Reference grid work packed the rate
panels three across instead of stacking. Nobody attacked the carried item and
it shrank anyway.

**And it is now worse at 1240 than it was ever recorded at 1920.** Seven rounds
measured this at 1920 because that is where Round 8 first measured it, while
the real problem moved to the narrower width. **A criterion pinned to one
viewport stops describing the thing it was written about.**

Round 8 named the levers and said the gap was owed by no phase and would be
attached to whatever phase happened to be nearby. Phase 0 item 4 has now
reported it. If a summary panel putting totals first resolves
it, say so and close the carried item. If it does not, say that too rather
than letting the panel imply progress against a different problem.

**The totals are computed, not stored**, per the standing rule and the
existing cost engine. Do not introduce a second computation path; Round 9
recorded that `computeBlocking()` was made the single evaluator for exactly
this reason and the same discipline applies to cost.

**Test evidence required:** the three category totals match the itemized
breakdowns exactly, verified against the engine's own output rather than by
re-adding the figures. Layout at 1240, 1920 and 3440, container measured
not element, no overflow. **Report the height of everything above Total
Cost at 1920, before and after**, so the carried item's status is a
measurement rather than an impression. Open the screenshots.

---

## Phase 5: The Reference summary card is retitled

**Qualification score.**

**AMENDED after Phase 0: sentence case, not title case.** The stage tab panel
reads **"Qualification scoring"**, sentence case, which is the house convention
recorded in `CLAUDE.md`'s output style. "Qualification score" matches it. The
brief first said "Qualification Score", which would have made the two panels
differ by capitalisation as well as by one word, and capitalisation is not a
distinction anybody reads as deliberate.

Phase 0 item 5 confirms the stage tab panel's title, which is "Qualification
scoring", and that **neither title is set from JS and no id or class names
either**: they are literals in `index.html` at lines 1037 and 1274. The
conditional about ids therefore does not fire. Two similarly named panels on different tabs is deliberate and
confirmed with the business, not an accident to be tidied.

Display only. No payload key, endpoint key, id or class changes, unless an
id names the old title, in which case report before changing it. Round 14
Phase 1 renamed ids alongside a field on exactly that argument, and this is
the same judgement made in the opposite direction because nothing here is
storage.

**Test evidence required:** the new title renders, asserted by count so
exactly one panel carries it. Confirm the stage tab panel's title is
unchanged, which is the half a positive check would miss.

---

## Phase 6: Regenerate and reconcile

Re-run `scripts/state-dump.mjs`, commit, reconcile line by line.

**`stage_gate_rules` unchanged at 61 total, 45 on `test_bed`.**
`scoring_criteria` 5, `scoring_anchors` 15 at version 1 only. This round
configures nothing, so identical configuration is the required result.

Tear down before regenerating, selecting by what the round created rather
than by relationship, and page every harness-wide query.

Expect live changes no phase accounts for, and **report whether the
business again exercised unmerged branch code mid-round**, per open item
23. It has happened in the last two rounds and they used it rather than
merely seeing it.

---

## Documentation discipline

Update `DESIGN_PRINCIPLES.md` as decisions change. Record:

- **Phase 3 as the completion of a fix attempted twice.** Rounds 3 and 8
  removed spinner arrows and could not remove the keyboard behaviour,
  because the fix was applied to the symptom's appearance rather than its
  source. Two rounds treated the visible arrows as the problem.
- **Phase 1's three decided cases**, especially what happens to existing
  violating records, since that is the edit-lock hazard.
- **Phase 4's finding on the carried Round 8 item**, whichever way it goes.
- **The Site Details merge deferred to Round 16 and why**, so it is not
  read as dropped.

Check the phase count with `grep -n "^## Phase\|^### Phase"` and confirm
every phase has an explicit sign-off. A report cannot sign off the phase
containing it.

**State in the close-out whether this round edited `CLAUDE.md`.**
