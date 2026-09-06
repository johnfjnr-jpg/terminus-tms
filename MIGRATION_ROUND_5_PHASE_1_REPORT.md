# Migration Round 5, Phase 1: the surface, behind the line

Session of 2026-09-06. Nothing registered, no `app.js` change, no swap. The
vanilla Reference tab is still the live one.

---

## Nothing is unfinished

All six items landed. The one thing this phase changed course on is recorded
under *item 6*, and it improved the work rather than reducing it.

---

## 0. The contract amendments, dated, before any build

Two entries appended to `MIGRATION_FIELD_ROW_CONTRACT.md`, both before a line
of product code was written.

**The census, and the table amended AT THE SITE.** `21 / 5` is confirmed and
describes ONE BRANCH; same-as-account ON reads `15 / 11`. The head table now
carries that inline as well as in the addendum, because the table is what a
reader quotes and a correction that lives only in an addendum is the one-way
promotion `CLAUDE.md` warns about.

**Seven editor rulings, A1 to A7.** A1 (the seed declaration generalised off
`SelectEditor`'s name), A2 (`showPicker` ported), A3 (suffix is display-only),
A4 (`min` is descriptor data), A5 (no change, recorded so nobody adds one),
A6 (textarea takes a seed), A7 (the checkbox is a direct input, not a row).

**And behaviour 7 ruled against the vanilla**: the read-only rows carry a tab
stop the row renderer never emitted, authored by `app.js`'s ownership sweep.
The contract is right; the divergence is deliberate and recorded.

## 1. The editor layers, red before green

`frontend-react/src/__tests__/field-row-editors.test.tsx`, derived from the
addendum with the vanilla unopened.

**RED FIRST: 10 failed, 11 passed** on the first run. The 11 were the existing
text and select behaviour and the `inputMode` guard — the right shape, because
every new claim failed. **GREEN: 21/21.**

**A1 is the ruling that mattered.** `editorTakesSeed` read
`editorFor(field) !== SelectEditor`, which polices one mechanism rather than
the effect. The vanilla's own rule excludes a date input too and says so in as
many words. **A date editor added under the old condition would have opened
its row on a character the input then discards** — finding 6's original defect
arriving through a new editor rather than a new field. It is a per-kind
declaration now, and A1.4 asserts the function no longer names `SelectEditor`
at all.

**A2**: `showPicker` appeared nowhere in the React tree, so the select editor
had been diverging from the vanilla silently since Round 2. Ported, wrapped so
a `NotAllowedError` leaves the field open and usable.

**The Round 1 seven-behaviour tests are byte-unedited and still pass**, which
is the contract's own proof that this was a MOVE.

## 2. The rows

`descriptors.ts` is built from the CENSUS, not from the vanilla's constants —
which a bundle cannot read at all, since they are module-scope `const` in a
classic script. 18 descriptor tests assert the census's numbers, with the
two-shape count **computed rather than restated**: C4 derives `21 + 5` and
`15 + 11` from the descriptors themselves.

**A4 is fixed by construction.** `min` is declared on the descriptor, so both
no-past dates carry it and the two actuals do not. M1 names the regression if
it ever returns: *"estGoLive lost its min again — the vanilla defect has been
reproduced."*

**Same-as-account, both branches.** Ticking re-renders the six address rows
read-only carrying the ACCOUNT's values live; S2 asserts the count, S3 that a
copied value cannot be opened at all, S5 that an account with no shipping
address renders the note rather than six empty rows. **S4 asserts B2 and B3
together**: the flag rides the batched save, and ticking back to the original
clears the draft rather than leaving a touched flag.

**`name` and `summary` are rows here**, not the static-markup bypass they are
in the vanilla. Nothing in the contract made them special; only the vanilla's
markup did.

## 3. The door, both directions, in jsdom

| test | claim |
|---|---|
| D1 | MINE: all 21 rows open |
| D2 | NOT MINE: all 21 refuse, by click |
| D3 | NOT MINE: all 21 refuse on Enter, Space **and a seed character** |
| D4 | NOT MINE: the direct-input checkbox is refused too, and records no draft |
| D5 | REGISTRY ABSENT: all 21 refuse — fails closed, per finding 10 |
| D6 | the guard is consulted at EVERY attempt, never captured at render |

**D4 is the one that would have been missed.** The same-as-account flag is a
direct input with no row around it, so the door has to reach it separately.
That is not derivable from behaviour 2 as written, and it is now recorded in
the contract.

**The wiring position from Phase 0 is unchanged and NOT YET APPLIED.**
`CAN_EDIT_BY_VIEW` has no `opportunity-detail` line, and adding one is an
`app.js` change this phase is forbidden. **So the surface today refuses every
row**, which is D5's state and the safe direction. Phase 2's swap commit adds
the line.

## 4. Key contacts

Its own component, per Phase 0's decision. **K3 and K7 are the decisive
pair**: a stance change arms its own row and does NOT make the surface bar
dirty, and a surface save carries no key-contact data at all. Its six routes
are named in one `KC_ROUTES` object so a reader can see the whole surface
area, and every write lands immediately.

## 5. The first-contact checklist

All eleven positions plus 4b carry a verdict in the contract's new second
entry. **All twelve CONFIRMED**, three of them strengthened by this surface:

- **Finding 1** decided the checkbox's representation. A boolean draft against
  a string original reads dirty forever under behaviour 1's strict comparison.
- **Finding 9** reached a surface that HAS a door for the first time — Round 2's
  Account surface has none, so this is the first real exercise of it.
- **Finding 10** is not academic here: with no registry line, every row
  refuses.

**And behaviour 2 gained a second kind of consumer**, which the contract now
says: a surface's door covers its DIRECT INPUTS too, not only its rows.

## 6. The injection sweep — and the course correction

`scripts/round5/inject-phase1.mjs`, verified-snapshot harness: full-path keys,
snapshot asserted before injecting, restore compared byte-for-byte after every
injection with a stop on mismatch, unique-anchor requirement, and a final
reverted run. **11/11 detected, reverted run green, all six files
byte-identical.**

Including the three the instruction named: the bar's count, a read-only row
gaining a tab stop, and same-as-account leaving a copied value editable.

### The sweep's one SILENT injection was the valuable result

A3 says the suffix is display-only and never reaches the value. The first
injection came back **SILENT**, and Verification 51's rule is that a silence
has to be explained rather than accepted.

Two things were wrong and only the second mattered. The injection was weak —
it added a placeholder, which no assertion reads. Underneath that: **the
suffix was rendered NOWHERE AT ALL.** It was declared on the descriptor and
displayed by neither half, so *"it never reaches the value"* was true **by
absence**, and R6 passed on a claim with nothing behind it. The vanilla shows
`36 months`.

The display half renders it now, in both variants, appended only when the
value is non-empty — the vanilla's own rule, so an unset duration reads as a
placeholder rather than a bare `months`. R6 asserts it is shown, R7 that
typing never carries it into the draft, R8 that an empty field does not show
it. Two real injections replaced the weak one, one per half of the claim, and
both fire.

### Two results worth reading precisely

**`estGoLive loses its min` and `the date editor drops its min` fail different
tests** — the descriptor's and the editor's. That is what makes A4 a keying
rather than a call-site argument: both ends are asserted independently.

**`the door is captured at render` catches only D4**, because the rows go
through `useFieldRows`' own guard and only the direct-input checkbox reads the
panel's copy. **The injection is narrower than its name.** It fires, so the
verdict stands, but it does not prove what its title claims — D6 is what
proves the no-timing-dependency property.

---

## Surprises

**The suffix was declared and never rendered**, and only a silent injection
found it. Every assertion about it passed while it did not exist. This is the
second round running in which a Verification 51 silence has named something
real.

**The read-only rows needed no new code.** `FieldRow` already refuses a tab
stop by construction — no `tabIndex` and no edit half — so behaviour 7 was
satisfied before this surface arrived. The injection had to ADD a tab stop to
make it fail, which is the right direction for a guard.

**The panel briefly kept the flag in two stores** and reconciled them with a
`setState` during render. It typecheck-passed and worked, and it is exactly
Verification 20's shape. Replaced with one handler that writes both, so there
is a single moment where they change and it is a user action.

---

## What this phase does NOT establish

- **Nothing has run in a browser.** Every result here is jsdom. The door has
  been calibrated both directions against an injected guard, not against a
  real record owned by somebody else.
- **The shell registry line is not written**, so the surface as built refuses
  every row until Phase 2's swap commit adds it.
- **The save path is not exercised.** `onSave` is a prop the tests assert
  against; the 409 handshake, the close-date-move route and the notes append
  are Phase 2's.
- **`estClose`'s write path is the one row that is not the batched save**, and
  it is named in the contract rather than solved.

## Phase 2's not-owned fixture: nothing blocks it

Checked rather than assumed. The admin client reaches `records`, two distinct
`owner_id` values already exist, and `is-not-mine` is computed from
`opp.owner_id !== currentSession.user.id` — so an admin write to `owner_id` is
all the fixture needs, exactly the Round 4 stage-write pattern.

**And the record stays visible after the change**, which is what makes it
usable: `records_select` is `auth.uid() is not null`, so a re-owned record is
still readable by the test account. The fixture produces a record the user can
SEE and must not EDIT, which is the state the door is about.

---

## Gate

Recorded below once measured.

**Not pushed. Phase 2 not started.**
