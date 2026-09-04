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
