# Phase 1: R2 with R1, R3, R4, R5

Built to the rulings. Follow-up panel untouched, Lead Detail untouched.
Nothing pushed.

**Two defects were found that were not on the list, and one of them
destroys data.** Sections 6 and 7.

---

## 1. Evidence

| probe | result |
|---|---|
| `probe-polish.mjs` (R1, R2, R3, R4, R5, door) | **29/29** |
| `probe-card.mjs` (carried) | **14/14** |
| `probe-card-widths.mjs` (1240/1920/3440) | **21/21** |
| `probe-new-lead-grid.mjs` (R6 carried) | **19/19** |

Suites **519/519**, **939/939**, **100/100**. Probe residue **0**.

**React 939/939 is the evidence frozen Lead Detail is untouched** - its
assertions run unchanged against components this round extended.

---

## 2. R2 with R1: panels, not a list

| check | result |
|---|---|
| the surface is three PANELS | 3 groups: contact, address, summary |
| an input for every field the server blocks on | all present |
| it MARKS exactly the server's blocking set | marked set equals the server's |
| **R1: `address2` is enterable although the gate never blocks on it** | input present, not in the gate |
| completing in place moves straight to the account step | no second Qualify, no other panel |
| the entered fields were saved | `address`, `city` written |
| the surface spans the card | 1,500px of a 1,556px card |

**R1 and R2 really were one fix.** `address2` is not among the gate's
fourteen, so a surface rendering only blocking keys could never offer it.
It is enterable now **because the surface is a panel**, and the assertion
says both halves: the input exists **and** the gate does not block on it.

**Card-local by construction.** Everything the surface uses -
`leadFields`, `LeadFieldInput` - lives in `leads/`, which Phase 0
measured as imported by nothing outside that folder.

---

## 3. R3: one source, and the drift is not pretended closed

Regions are served from `src/lib/regions.js` through
`creation-requirements`, beside `sources`. Region renders as a **select**
with five options everywhere the card enters it - the completion surface,
the address popup and the New Lead grid - asserted live.

**The six existing copies are NOT re-pointed**, and that is deliberate:
Lead Detail's is frozen, and the others are re-pointed when their own
surfaces are next opened. **This round adds a source and one reader.** It
does not close the drift, and saying so is more useful than a claim that
it did.

---

## 4. R4: Create alongside matches

| check | result |
|---|---|
| typing a PREFIX of a real account offers the match **and** Create | both |
| picking the existing match links it and creates NO new account | linked, account count unchanged |

The second line is what stops the first being a regression: offering
Create everywhere would be wrong if it broke picking.

---

## 5. R5: both controls on the header line

| check | result |
|---|---|
| closed, the header carries Add note | yes |
| open, **both** Add note and Discard are on the header | header `["Add note","Discard"]`, editor wrap empty |
| exactly ONE of each, not a duplicate pair | 1 and 1 |
| Discard cancels THIS NOTE and writes nothing | 0 notes on the record |

**The duplicate-pair check exists because the last round shipped two
Cancel buttons** in the Qualify account step and only a screenshot caught
it. Here it is asserted.

**Notes moved further left**: the column starts at `x=723` where Created
Date ends at `x=757`, so it is now **34px left** of that end, against
**36px right** before. Exact alignment is content-dependent - the head
text length differs per card - so it is not claimed.

---

## 6. A DEFECT THAT DESTROYS DATA, and it was mine

**`AddressPopup` blanked five of six address fields.** Editing `city`
came back with `address`, `address2`, `postcode`, `country` and `region`
all **empty**.

**The mechanism.** It wrote all six unconditionally from `values`, and
`values` is `useState(initial)` - **seeded once at mount**. If the popup
mounts before a refetch lands, it holds the stale record, and saving
writes those blanks over real data. **The screen looked right at every
moment, because it showed what it had.**

**Verification 20's addendum arriving through a write:** a control that
supplies a value on save turns *unchanged* into *empty* wherever the
payload is rebuilt from the screen. The same shape that would have
deleted `marginOverrides` on 33 opportunities.

**It writes only what differs now**, which is what `QualifyCompletion`
already did. The assertion that would have caught it is added: *saving one
address field does NOT blank the others.*

**How it surfaced** is worth keeping: a later section re-qualified the
same lead and the server still reported four fields blocking. The failure
detail carried the cause because it printed both `[still blocking]` and
`[payload now]` together - Verification 14's clause, which this round
promoted.

---

## 7. R2 and R5 interacted, and only a screenshot showed it

R5 moved the actions **inside the head**, so the head's flex sized them to
their content - and the completion surface, rendering from the same
component, **inherited that narrow column while two thirds of the card sat
empty**.

**Every assertion passed**: the panels were there, the fields were there,
the marks were right. Presence, count and correctness all read green on a
surface crushed into a third of the width.

Fixed so the action group takes a full row of the head when a step is
open; the buttons stay on the top line. **Asserted**: the surface must
exceed 80% of the card.

---

## 8. And the F5 guard fired on its first real encounter

It refused the Phase 1 commit: the heaviest chunk took **1,022ms against
its 889ms ceiling**, while the row count had moved by **69**.

**Variance, not growth** - which means a ceiling normal variance crosses
has no margin. `TAG_CHUNK_SIZE` **6 to 3**, measured 440/600/533ms over
three runs.

**The guard's own message says lower this rather than raise the
ceiling**, and raising it would have been fitting the instrument to the
reading. It is the first time one of this estate's guards has caught a
regression in the thing it guards rather than in a calibration.

---

## 9. Three probe faults of my own

- **A fixture consumed by an earlier claim.** R4 qualified the lead R5
  then waited for - it had correctly left the pipeline. The product
  working, measured as a failure, for the third time in this round's
  probes. R5 has its own fixture now.
- **An input-only census.** R3 turned Region into a `<select>`, and the
  address door check counted `input` only - so on the **unowned** side the
  region control would have gone unmeasured. Now `input, select`.
- **An equality assertion that outlived its claim.** The carried card
  probe asserted the surface's inputs **equalled** the server's blocking
  list. R2 deliberately made it a superset with the blocking ones marked.
  Re-pointed, and it now asserts both halves.

---

## 10. What this phase does not establish

- **No walk.** Probes and screenshots.
- **Heights are essentially unchanged** - lean 335/257/257 as before.
  This round's items were not height items; the frozen column's floor
  stands.
- **The region drift is not closed**, only sourced. Five copies remain,
  one of them frozen.
- **`address2` has no gate rule**, by design. Nothing here makes it
  required; it is merely enterable.
- **F3 stands.** Add note and Save task are still white browser defaults
  on the cards.
