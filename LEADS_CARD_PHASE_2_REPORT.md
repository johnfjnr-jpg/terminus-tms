# Phase 2: the card, on the proven conversion

Built to R2, rendering on the conversion Phase 1b proved. Lead Detail
untouched (R4). Nothing pushed.

**R11 CLOSED IT: Address details stays alive.** Section 5. Widths
re-measured at all three (section 4a). F3 named for the close (section 10).

---

## 1. Evidence

| probe | result |
|---|---|
| `probe-card.mjs` (live screen) | **15/15** |
| `probe-qualify-route.mjs` (HTTP) | **7/7** |
| `probe-nurture.mjs` (live screen) | **5/5** |
| `probe-card-widths.mjs` (1240, 1920, 3440) | **15/15** |

Bundle freshness asserted before every live measurement. Suites: pure
**519/519**, react **939/939**, database **100/100**. Probe residue: **0**.

---

## 2. Qualify, end to end

| check | result |
|---|---|
| a complete lead qualifies | `Unqualified -> Qualified`, accounts 5 -> 6, account linked |
| **ONE atomic call, not three** | POSTs recorded: `["/contacts/<id>/qualify"]` |
| the qualified lead leaves the pipeline | card gone from `view-leads` |
| the response is the function's own return | `{account_created: true, status: "Qualified", revision_number: 2}` |
| linking an EXISTING account creates no new one | accounts 6 -> 6 |
| both shapes or neither | each refused 400 |
| an already-Qualified lead | refused 422 |

**The one-call claim is measured, not argued.** The probe records every
`POST /api/contacts/*` during the flow and asserts the array is exactly
one entry ending `/qualify`. `LinkAccountPanel`'s three separate writes
are now inside the transaction because the path it posts to is the
qualify route.

### The completion popup is the server's list

The route runs `computeBlocking` - the single evaluator - and returns it
on a 422. The card renders exactly that array. **The probe compares the
popup's rendered lines against `exit-criteria`'s own output and asserts
equality**, so a client-side copy fails rather than agrees: popup 10,
server 10, identical.

### R8: cancel writes nothing

Fingerprint identical across an opened-and-cancelled account step, lead
still `Unqualified`, account still `null`. Nothing is written until the
function is called, so there is no mid-state to roll back - which is why
there is none to persist.

---

## 3. R7 honoured without a second picker

`LinkAccountPanel` gained **two optional props**, both defaulting to its
existing behaviour so **Lead Detail is untouched**:

- `submitPath` - the card points it at the qualify route.
- `onCancel` - the card's step is already open, so the panel's own Cancel
  must cancel the STEP rather than collapse to a button nobody asked for.

---

## 4. The card

| check | result |
|---|---|
| full width, not capped at 1240 | `max-width: none`, card **1556px** in a 1920 viewport |
| Company, Source, Created Date ON the name line | share the name's row |
| all four actions render | Qualify, Nurture, Follow-up task, Address details |
| Address discloses all six fields | 6 cells |
| Nurture opens the dialogue and moves the lead | refuses without a date; then `Nurture`, date and reason recorded, card moves group |

Full width uses the `#view-contact-detail` precedent - the same two
declarations for the same reason, so the two pages cannot drift.

**The Follow-up task button does not duplicate the inline editor.** It
scrolls the existing one into view and focuses it, so there is one
follow-up control on the card rather than two.

---

## 4a. All three widths, which the first pass did not do

Phase 2 measured full width at **1920 only** and said so. Verification 10
wants 1240, 1920 and 3440, and **1240 is where it broke** - which is the
whole reason the rule names that width.

| | 1240 | 1920 | 3440 |
|---|---|---|---|
| card fills the content column, uncapped | 876 of 877 | 1556 of 1556 | 3076 of 3076 |
| Company/Source/Created Date on the name line | yes | yes | yes |
| the four actions share one row | yes | yes | yes |
| no sideways scroll | yes | yes | yes |
| an extreme name wraps cleanly, never overflows | yes | yes | yes |

**One of the two 1240 failures was my assertion, not the product.** The
first check read `card > viewport * 0.75` and failed at 876 of 1240 - on
a card using **every pixel available to it**. The sidebar and `.wrap`'s
fixed padding are ~363px whatever the width, so they are 29% of 1240 and
11% of 3440. **A fraction of the VIEWPORT was never the claim**; filling
the content column is. Verification 27's shape: the measure was a
property of the document rather than of what the person gets.

**The other was real, and is now measured rather than assumed away.** The
head is a wrapping flex row. With a 44-character name and a 52-character
company it wraps at 1240 instead of overflowing. So the probe now carries
**two leads** - typical and deliberately extreme - and asserts the claim
on the typical one at all three widths, while asserting the extreme one
**wraps cleanly and never scrolls the page sideways**. Confirmed by
screenshot at 1240: "Jane Tan · Willowglen · Referral · 2026-09-12" on
one line, the extreme lead's company wrapping below it, both readable.

Screenshots: `p2-width-1240.png`, `p2-width-1920.png`, `p2-width-3440.png`.

---

## 5. THE DOOR, AND R11

| check | result |
|---|---|
| Qualify, Nurture, Follow-up dead on an UNOWNED card | all `dead` |
| the unowned card still navigable | `tabIndex 0` |
| every write action alive on an OWNED card | all `live` |
| **Address details ALIVE on an unowned card** | `live` |
| the revealed address panel holds ZERO controls | 0 interactive elements |

**R11 RULED: LEAVE ALIVE.** The reasoning below is what the ruling rests
on and is kept, because the conflict was real and a later reader should
see how it was settled rather than that it never arose.

The Phase 2 instruction lists *"Qualify/Nurture/Follow-up/Address/Add-note
all neutralised"*. Address details, as built, is a **read disclosure**: it
reveals six read-only values and writes nothing.

P3 recorded, in its own commit subject, *"a door that had made an unowned
lead unreadable"*, and the finding says that is **"the one thing it must
never do"**. The fix was exempting disclosure toggles by
`aria-expanded`/`aria-controls`. My Address button is alive **because that
fix is working as designed** - killing it would reintroduce exactly the
defect P3 named.

The same instruction also says *"navigation and disclosure alive"*, so
both halves of the sentence are in it; which one Address falls under
depends on what Address IS, and that is yours to say.

**Two readings, both coherent:**

- **(a) Keep it alive.** Consistent with P3. An unowned lead's address
  stays readable from the card. What makes it safe is asserted: the
  panel it reveals contains **zero** controls, so the exemption is not a
  hole.
- **(b) Neutralise it**, literally as instructed. Then an unowned lead's
  address cannot be read without opening the lead. If you want this, say
  so and it is one selector.

**Ruled (a), and already asserted both ways**: Address is `live` on an
unowned card, the three write actions are `dead`, and **the revealed
panel holds zero controls** - which is what makes alive safe rather than
merely permitted. A disclosure that is wrongly alive costs a read; one
wrongly dead costs the defect P3 already paid for.

---

## 6. Four things only a screenshot found

Every one passed every assertion.

| defect | cause |
|---|---|
| the sub line sat BELOW the name | `.lead-card-sub` carries `flex-basis: 100%` from when the card was capped at 1240. It does not permit a wrap, it **forces** one |
| the popup listed raw field keys - `jobRole`, `linkedin` | the server carries its sentence in **`message`**; I rendered `label ?? field` |
| the account step showed **TWO Cancel buttons**, one unstyled | the card added its own beside the panel's |
| the search box was a **white browser default** | `LinkAccountPanel`'s input has **no `type` attribute**, so it misses the estate's `input[type="text"]` rule |

**The last one is not only mine.** That input lacks its `type` on **Lead
Detail too**, so it looks the same there. **Reported and NOT fixed**,
because Lead Detail is frozen and changing a shared component would alter
the surface you are going to walk for parity. The card's treatment is
applied from the card's own stylesheet instead.

This is the same family as the LEADS round's unclassed Save button and
the carried **F3**, and it is now four instances across three phases. The
estate has no instrument for it: presence, position, state and behaviour
all read green on a white control.

---

## 7. Two probe faults of my own

- **A wait for the lead that had correctly just left the pipeline.** After
  qualifying, `toLeads()` waited for the converted lead's card. It is
  Qualified, so it is gone - the product working as ruled. Re-pointed at a
  lead that stays.
- **A Nurture group read taken mid-refresh.** The dialogue closes before
  the list's reload resolves, so the status was already `Nurture` in the
  database while the card still rendered under Unqualified. Fixed by
  waiting on P4's `data-fetch` counter, which exists for exactly this.

---

## 8. One duplication, declared rather than left to be found

`NurtureDialog` performs the same two calls as `ContactHost`'s park flow -
record the reason, then transition - in the same order and for the same
recorded reason. **It is not refactored into a shared helper, because
extracting would edit Lead Detail, which R4 freezes.**

So there are two writers of one flow. When Lead Detail is retired after
you walk the card, this becomes the only one; until then **a change to
the Nurture sequence has to land in both**, and that is written at the
site.

---

## 10. F3 named for the round close

The unclassed-control class is now **four instances across three phases**,
and it is on the close's promotion queue in `LEADS_CARD_BRIEF.md` with
the table. Not fixed here, by instruction.

**Why nothing catches it:** presence, position, disabled state and
behaviour all read green on a white browser default. Every assertion this
estate writes is about what a control IS and what it DOES; none is about
what it LOOKS LIKE. All four were found by a person opening a screenshot
- Verification 4's remedy and its limit, since it works only when
somebody looks and only at what is in frame.

The close rules whether that becomes a check or a rule.

---

## 11. What this phase does not establish

- **No walk.** Four probes and screenshots, not a person. The card has
  not been used by anyone.
- **The Qualify flow was exercised with one account choice per path**
  (create-new on the card, link-existing over HTTP). Searching a long
  account list, and the panel's matching behaviour, are untested here.
- **The widths were measured on a card with no notes and no follow-up
  set.** A card carrying ten notes and an open address disclosure is
  taller and was not measured at 1240.
- The completion popup tells a person to **open the lead** to fill fields
  in. It does not fill them in on the card, which R2 did not ask for.
