# The field-row behaviour contract

**Written 2026-09-05 as Migration Round 0, item 1. Scoping only: no product code
was written for it.**

This is **the behaviour a React reimplementation must preserve**, written down
before any of it moves, so the migration can be verified against a contract
rather than against a memory of how the screens felt. Everything here was
measured from the running system, not read off the source.

Companion to `MIGRATION_ROUND_0.md`, which carries the estimate and the
strangler order.

---

## What exists today: five implementations

Measured by counting rendered rows on one record per surface, default tab:

| surface | click-to-edit rows | read-only display rows | direct inputs |
|---|---|---|---|
| Opportunity / Reference | 21 | 5 | 3 |
| Opportunity / Commercials | 1 | 0 | 15 |
| Test Bed | 16 | 6 | 5 |
| Contact | 15 | 0 | 0 |
| Account | 15 | 2 | 0 |
| **total** | **68** | **13** | **23** |

**81 display rows on default tabs.** The "~89 touch points" figure from the
earlier assessment is consistent once non-default tabs are counted; 81 is what
is measured here, and the difference is not worth resolving before the work
starts.

The row factories are `refFieldRow`, `cdFieldRow`, `acctFieldRow`, `tbFieldRow`
and `cdColumnFieldRow`, plus a separate record-name header editor
(`cd-name-display`). **Five implementations of one idea**, which is the
duplication the migration exists to remove.

---

## The seven behaviours

Taken from `openRefField` in `frontend/opportunity-reference.js` and its four
siblings. **A React field row satisfies all seven or it is not a replacement.**

### 1. Draft state per field, compared not flagged

Each implementation holds `{ draft, orig }` keyed by field name - `refEdits`,
`cdEdits`, `acctEdits`. **Dirty is `draft !== orig`, computed, never an event
flag set on change.** This is deliberate and predates the migration: a flag goes
wrong when a person types a value and types it back.

### 2. ONE DOOR, and it carries the ownership guard

Every click-to-edit row on a surface opens through a single opener, which
begins:

```js
if (document.getElementById('view-opportunity-detail')?.classList.contains('is-not-mine')) return
```

**This is load-bearing and must not be distributed into the rows.** Its own
comment records why: it covers every field that exists AND every field added
later, and it has **no timing dependency**, unlike the CSS treatment and the
disabled-flag sweep which both run at render. The defect it fixed was a
non-owned record whose display div was still clickable, opening an editor whose
select was `pointer-events: none` but not disabled - so it stayed operable by
keyboard, and an owner change could be chosen and only refused at save.

**In React**: one guarded edit-entry hook, not a check per row.

### 3. Display and edit swap by visibility, never by removal

The display div hides and the edit div shows. Nothing is removed and recreated.
Round 41's sixth walk ruled this for decision controls and the same reasoning
applies here: a control that vanishes reads as "what did I just break".

### 4. Keyboard parity, including the seed character

Rows carry `tabindex="0"` and a `fieldDisplayKeydown` handler, and the opener
takes a `seedChar`: typing a character into a **closed** row opens the editor
AND keeps the keystroke. A React row that opens on click but drops the first
typed character has lost a behaviour nobody will report and everybody will feel.

### 5. Discard restores the original

`discardRefField` deletes the draft, restores `orig` into the input, clears the
dirty class, and re-renders the edit bar. Discard is not "close".

### 6. A shared edit bar aggregates across rows

Dirty count is computed across all open drafts on the surface, and save and
discard-all act on the set. **The bar is a property of the surface, not of a
row**, which is why the row component cannot own it.

### 7. The read-only variant is the same row without a door

`.ref-field-display.readonly` renders the identical shape with no opener and no
tab stop. 13 of the 81 rows are this. A React implementation that reaches
read-only by disabling the editable row will get the tab order wrong.

---

## What the contract does NOT cover, and must be decided separately

- **Field-specific editors.** Dates, staff pickers, currency and the numeric
  guard are per-field concerns layered on the row, not part of it.
- **The numeric input guard.** Keyed on `inputmode` since Round 41's U1, so a
  field that declares what it takes inherits the constraint. **A React port must
  keep that keying** - the whole finding was that a per-field guard is a to-do
  list that has to be completed again on every new field.
- **Save semantics.** Which fields belong to one payload, and the revision
  handshake, are the record's concern and are already server-side.

---

## How to verify a replacement

For each of the 81 rows: open it, type, discard, reopen, type, save; then repeat
the sequence on a record owned by somebody else and confirm the door refuses at
step one. **The seven behaviours above are the checklist**, and the count is the
coverage: a replacement verified on the Reference tab's 21 rows has been
verified on a quarter of them.

**And the fixture warning applies here more than anywhere.** `CLAUDE.md`
Verification 47: a fixture shaped to the implementation tests the
implementation. These behaviours are written from the CURRENT code, so a React
test derived from the new component will agree with itself. **The tests for the
replacement are derived from this document, not from the component.**

---

# Addendum, 2026-09-05: eleven findings from the first derivation

**Added at the Round 1 Phase 4 close.** The React field-row component was built
from the document above and nothing else - the five vanilla implementations were
not opened, for either the component or its tests, which is `CLAUDE.md`
Verification 47 applied at the component level.

**That derivation found eleven places this contract is silent or
underdetermined.** Each carries the position taken and the reasoning. **All
eleven are revisitable on first contact**, when Round 2's first row-bearing
surface consumes the component: that contact is the real proof, and this is the
checklist to run it against.

The component is `frontend-react/src/field-row/`; its tests are
`frontend-react/src/__tests__/field-row.test.tsx`, 49 of them, nine injections
calibrated.

| # | the silence | position taken |
|---|---|---|
| 1 | Behaviour 1 says `draft !== orig` strictly, but not what type `orig` is | **`value` is always a string.** A numeric `orig` would make every numeric field permanently dirty against an input's string, and behaviour 1 exists so that typing a value and typing it back reads clean |
| 2 | Where the draft store lives is implied, never stated | **At the SURFACE**, not in the row. Forced by behaviour 6: a row that owned its draft could not be counted by anything above it |
| 3 | Nothing says what happens if the record reloads under an open editor | **`orig` is never stored** - read from the descriptor on every comparison. No second copy to drift, and a reload that brings the record to what somebody typed reads CLEAN rather than dirty against a value nobody holds |
| 4 | The seed character: replace or append? | **Replace.** A closed row receiving a keystroke is somebody starting to type; appending gives `Acme LtdX`. Nothing is lost, because discard restores |
| 5 | Which keys are seeds | A single printable character with **no Ctrl, Meta or Alt**. Enter and Space open WITHOUT a seed. Navigation and editing keys are not seeds |
| 6 | Behaviour 4 and the `inputmode` keying are never put together | **A rejected seed does not open the row.** Opening on a character the field will refuse shows an editor that discarded the keystroke that summoned it |
| 7 | Does closing a row clear its draft? | **No.** If closing cleared it, close and discard would be one operation, and behaviour 5 exists to say they are two |
| 8 | "Discard is not close" says what discard is NOT | **The row stays OPEN.** Restoring the original into the input is pointless if the input is then hidden |
| 9 | The guard's signature, and what refusal looks like | **`canEditFields(): boolean`, no argument, silent refusal.** A field-name parameter nothing uses would be a defaulted parameter hiding an incomplete change (Verification 24). Round 2's Phase 0 decides what the shell's implementation reads |
| 10 | What if the shell provides no guard at all? Cannot arise in the vanilla | **FAIL CLOSED.** Failing open makes an absent ownership door look exactly like a present one, on the surface whose purpose is stopping somebody editing a record that is not theirs |
| 11 | Class names and the DOM contract | **No vanilla class names are copied.** Visibility uses the `hidden` ATTRIBUTE, which is load-bearing: a hidden subtree is out of the tab order by specification, so a closed row's input cannot be reached by keyboard - the second half of behaviour 2's own recorded defect |

**One observation about this document rather than about the component.**
Behaviours 5 and 6 are both stated as **negatives** - "discard is not close",
"the bar is a property of the surface, not of a row". With the vanilla source
open, a negative reads as a note about how the existing code happens to work.
With only this document, a negative IS the specification, and both forced a
structural decision (findings 8 and 2).

**Working from the contract without the source made it sharper to work from,
not vaguer**, which is worth knowing before Round 2 rules on whether to keep
that constraint.

---

# Addendum, 2026-09-05 (second entry): the editor slot

**Added at Migration Round 2, Phase 0 close, on first contact with the Account
surface.** Ruled by John as route 3 of three offered.

## What forced it

Three of the Account surface's fourteen click-to-edit rows are `<select>`s:
`terminusLead` (a staff picker, options from `terminusStaffCache`),
`billingRegion` and `shippingRegion` (five fixed options each).

The Round 1 component rendered an `<input>` and nothing else, and its
`FieldDescriptor` had no `options`. **So the first surface to consume the
component could not render 3 of its 14 rows** - and this document excludes the
missing piece in writing:

> *"Field-specific editors. Dates, staff pickers, currency and the numeric
> guard are per-field concerns layered on the row, not part of it."*

`terminusLead` is a staff picker. Named, and excluded.

## The ruling: the slot IS that sentence, implemented

Not a departure from the contract. **"Layered on the row, not part of it" is a
description of an interface**, and until Round 2 nothing implemented it.

> **The row owns state, the door, dirty and keyboard. Editors are pluggable.
> Text and select are the first two.**

```ts
interface FieldEditorProps {
  field: FieldDescriptor
  value: string                  // the draft if there is one, else the original
  onChange(next: string): void   // a CANDIDATE; the row applies its own guard
  onRequestClose(): void         // Escape. The row closes; it does NOT discard
  focusRef: RefObject<HTMLElement | null>
  testId: string
}
```

The descriptor gains `options?: string[]` and `editor?: 'text' | 'select'`.
**`options` present selects the select editor**, so a caller declares DATA
rather than wiring - the same reasoning that keyed the numeric guard on
`inputMode` rather than on a list of field names.

## What an editor structurally cannot do, each asserted

- **Bypass the door.** It is only ever mounted inside the row's edit half, and
  the row opens that half through `requestOpen`. An editor holds no controller
  reference and cannot open anything.
- **Own dirty.** It receives `value` and `onChange`. It cannot read the
  original, cannot see another field, and cannot set a flag. An editor
  reporting the value it was given produces no dirt.
- **Smuggle a value past the declared guard.** `acceptsValue` runs in the ROW's
  `onChange`, on the whole candidate. There is nowhere for an editor to skip it.
- **Be operated while the row is closed.** The edit half carries `hidden`, and a
  hidden subtree is out of the tab order by specification.

## Behaviour 4 and a select: MEASURED, not chosen

`window.revealFieldControl` in `frontend/app.js` computes

```js
const takesText = input.tagName === 'TEXTAREA'
  || (input.tagName === 'INPUT' && (input.type === 'text' || input.type === 'number'))
```

**A `<select>` is not in that set**, and the function's own comment says why:
*"Only a free-text control can take a character. A date input and a select
cannot hold an arbitrary first character."*

**So on the vanilla surface today, typing a character at a closed select row
opens the row, focuses the select, and DISCARDS the character.** That is ported
exactly rather than improved. The keystroke is not wasted: once the select has
focus the browser's own type-ahead takes it.

**Behaviour 4 is therefore amended, not overturned.** "The seed character is
kept" is true of every editor that can hold one, and whether an editor can hold
one is a property of the editor. `editorTakesSeed(field)` is where that lives.

## The empty option, and why it is not cosmetic

The select editor renders an empty option ahead of the declared ones.

**Without it a select is a one-way door**: once a value is chosen there is no
way back to unset, and "not recorded" stops being reachable from the screen.
That is `CLAUDE.md` Architecture 11 arriving through an editor - a default is an
initial value, and a field must be clearable and stay cleared.

## The proof the refactor was a MOVE and not a rewrite

**The 49 tests written against the seven behaviours in Round 1 pass UNCHANGED
through it**, byte-identical file, sha256 `9d3e5d6f…`. They were not edited to
fit the new shape. Had one failed, the refactor would have moved behaviour, and
that would have been the finding.
