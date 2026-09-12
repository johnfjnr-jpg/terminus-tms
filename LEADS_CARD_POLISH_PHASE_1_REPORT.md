# Phase 1: the polish, built

R1, R2, R4, R5 and R6 built. R3 partially, as ruled. R7's follow-up panel
untouched. Lead Detail untouched. Nothing pushed.

---

## 1. Evidence

| probe | result |
|---|---|
| `probe-polish.mjs` (R1, R2, R4, live) | **18/18** |
| `probe-card.mjs` (carried behaviour) | **13/13** |
| `probe-card-widths.mjs` (1240/1920/3440) | **15/15** |
| `probe-new-lead-grid.mjs` (R6) | **19/19** |

Suites: pure **519/519**, react **939/939**, database **100/100**. Probe
residue **0**. Bundle freshness asserted before every live measurement.

---

## 2. R1 and R6: one definition, two surfaces

`leadFields.ts` is the single statement of what a lead is made of. The
grid renders all fifteen as columns; the completion popup renders exactly
the keys the **server** named as blocking.

**This is John's ruling and his reason:** the seven fields R6 adds to the
grid are the same seven the popup needs, and *"two implementations of the
same fields is the drift this project keeps catching."* A field added to
that file reaches both surfaces with neither edited.

### R1 proven end to end

| check | result |
|---|---|
| every field the server says is missing has an INPUT | server blocks 6, popup renders 6, keys match |
| the popup no longer sends the person elsewhere | message is "Please complete missing data" |
| Save disabled before anything is typed | yes |
| Save enables once entered | yes |
| **completing in place moves straight to the account step** | no second Qualify press, no other panel |
| the entered fields were actually saved | `address "1 Polish Way"`, `city "Singapore"` |

**The fifth line is R1's actual claim.** Not that the popup has inputs -
that it removes the journey. One press of Qualify, finish in place, and
the account step appears by itself.

**What did NOT change is where the list comes from.** It was already the
server's `computeBlocking` through `exit-criteria`, and Phase 2 of the
last round proved that by comparing the rendered output against the
endpoint. The assertion moved from message text to field keys because the
rendering changed; the claim is the same one.

### R6

The grid now carries **15 of 15**: the eight it had plus `linkedin` and
the six address fields.

---

## 3. R2, and a trap the probe found

| | owned | unowned |
|---|---|---|
| inputs | 6 of 6 live | **6 of 6 neutralised** |
| values readable | yes | **5 of 6 carry values** |
| Save | disabled until dirty, then enables | **unreachable** |
| the edit is written | `city "Jurong"` | n/a |

**Last round's R11 assertion is EXPIRED, not quietly swapped.** R11 rested
on the revealed panel holding zero controls. An editable address is a
write, so that is no longer available, and a read-versus-write separation
replaces it. The expiry is recorded at the assertion's own site in
`probe-card.mjs`.

### The trap, and how it was found

**On an unowned lead the door neutralised the popup's CLOSE button along
with its writes.** The popup opened over a full-screen backdrop and could
not be dismissed; the card behind it was unclickable. **P3's family
exactly** - the door must never make an unowned lead unusable to read.

**It was not found by reading.** A later check - the Summary save -
failed, and its diagnostic reported `elementFromPoint` returning
`DIV.modal-backdrop` where a button should have been. **An assertion
measuring the wrong thing found the right one**, because it asked what
was actually at the point it was clicking rather than only whether the
click worked.

**The fix is a declared property, not a name.** Close carries
`aria-controls` pointing at the popup region - which the door already
reads for read affordances, and which is **true** of it, the same
justification the notes expand rungs carry. Exempting by class name would
be Verification 19's warning: a styling class sheltering controls.

Asserted: *"UNOWNED: Close still works, so the popup is not a trap."*

### Card-local, declared

The popup duplicates address editing while Lead Detail stands, because
sharing would mean coupling to a retiring surface or extracting from a
frozen one. Declared at the site, like `NurtureDialog`: when Lead Detail
retires, this becomes the only one.

---

## 4. R4

Summary saves through the same `PATCH /api/contacts/:id` the other inline
writes use, is dead on unowned cards, and **is asserted not to destroy
the rest of the payload** - a save that wiped name and company would have
passed every other check on this page.

---

## 5. R5

- The actions moved **inside the head**, so they are on the top line.
- Notes-to-Created-Date: **108px closed to 36px**.

**Exact alignment is not claimed.** The head line's width depends on the
name and company text, so where Created Date ends differs per card.
36px is what this fixture measures; a claim of zero would be false for
other content.

---

## 6. R3, stated as measured rather than as hoped

**Before and after, same instrument, same two fixtures:**

| | 1240 | 1920 | 3440 |
|---|---|---|---|
| lean before | 343 | 295 | 295 |
| **lean after** | **335** | **257** | **257** |
| busy before | 526 | 472 | 439 |
| **busy after** | **387** | **299** | **266** |
| lean cards per 1100px viewport | 3 | **3 to 4** | **3 to 4** |

**The busy card is where this lands**: 139px at 1240, 173px at both other
widths. Phase 0 measured Notes as the driver on busy cards and the frozen
column as the driver on lean ones, so capping notes hits exactly the
cards that were worst.

**At 1240 the lean card gains only 8px, and the reason is worth stating.**
The four buttons plus the name line exceed 1240, so the head **wraps to
two lines** - 68px against 34px at the wider viewports. R5's top-line
placement therefore holds at 1920 and 3440 and does not at 1240. That is
the flex container doing its job rather than overflowing, and shortening
the ruled button labels to force it would be a different decision.

**The follow-up column's 218px floor stands**, per R7. R3's remainder
belongs to the round that rebuilds it.

**R4's counter-pull, held alongside:** the Summary editor is taller than
the paragraph it replaced, and the card still came down. The 192px of
slack Phase 0 measured is what paid for it.

---

## 7. A second flaky gate test, recorded not buried

**The pre-commit hook refused this report's own commit**, on
`atomicity: 40 genuinely concurrent appends`:

```
expected every concurrent append to succeed, 1 failed:
TypeError: fetch failed
```

**Not a logic failure.** `fetch failed` is the transport, and the test
fires forty simultaneous HTTP calls at a remote Postgres. Re-run
immediately: **100/100, that test green at 2976ms against 3551ms on the
failing run.**

**This is the second flaky gate test**, beside the LEADS round's carried
**F5** (`teardown-scoping` crossing the statement timeout as
`record_revisions` grows). Different mechanism - that one is a query
getting slower, this one is a dropped connection among forty - and the
same consequence: **a gate can go red for a reason unrelated to the
code**, and at that moment nobody can tell it from a real regression
without re-running.

**Recorded rather than retried-and-forgotten**, because a retry that goes
green is exactly how a real intermittent defect gets dismissed. Carried
for the close to rule on alongside F5.

---

## 8. What this phase does not establish

- **No walk.** Four probes and screenshots, not a person.
- **The follow-up panel was not touched or measured as a target** (R7),
  and Lead Detail was not opened.
- **The busy fixture is 10 notes and a long summary.** A card with 50
  notes, or an address popup open at 1240, was not measured.
- **F3 is unchanged and still carried.** Add note and Save task remain
  white browser defaults; the new controls in this phase carry the estate
  treatment, but the carried instances were not fixed, by instruction.
- The completion popup shows fields the shared definition knows. A
  blocking key it does not know is **displayed as unenterable** rather
  than dropped - that path exists and has not been exercised, because no
  such key exists today.
