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
| | \u2191 amended 2026-09-06: **per-branch**. Same-as-account ON reads **15 / 11**. See the Round 5 addendum | | |
| Opportunity / Commercials | **0** | **0** | **39** |
| Test Bed | 16 | 6 | 5 |
| Contact | 15 | 0 | 0 |
| Account | 15 | 2 | 0 |
| **total** | **68** | **13** | **23** |

> **THE COMMERCIALS ROW WAS CORRECTED 2026-09-05, at Migration Round 3 Phase 0.**
> It read `1 | 0 | 15`. **Re-run instrument, the same one this table names -
> counting rendered rows on one record, default tab - plus two source scans:**
> `.ref-field-display[tabindex]` and `.ref-field-display.readonly` both return
> **0** on the live Commercials panel, and `ref-field`, `fieldDisplayKeydown`
> and `data-key` return 0 in `opportunity-deal.js` and in the panel's own
> markup region. **There is no click-to-edit row on Commercials and there is no
> read-only row.**
>
> The direct-input figure is now the **live control count on the default tab**:
> 39, being 35 text inputs, 3 selects and 1 textarea, every one carrying an id.
> It excludes the detail panel's 11 margin inputs, which are on the same panel
> and not on that tab. The previous 15 has no recorded instrument and is not
> reconcilable with it.
>
> **The 81 total below is left as it was measured** and is not re-derived here:
> re-running it across all five surfaces is its own exercise, and a number
> half-corrected is worse than one wholly stale.

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
> ## SUPERSEDED 2026-09-11: ESCAPE NOW REVERTS
>
> **John ruled A3 at the Leads round's Phase 0 sign-off, knowing it touches
> surfaces outside Leads.** Escape reverts the focused field to its last saved
> value, on **all four** surfaces the row serves - Contact, Test Bed, Reference
> and Account.
>
> **The superseded decision is left in place below rather than deleted**, and
> the signature line above points here rather than silently changing meaning.
> Verification 23 is explicit that two correct decisions taken in different
> rounds produce a conflict nothing detects, and that **the fix is deletion of
> one, not reconciliation** - so this is recorded as a supersession with a date
> and an author, not as a second opinion.
>
> **What made the original defensible, and why it was still changed.** It was
> stated as a NEGATIVE on purpose, which the paragraph below explains made it
> read as specification rather than as a description of existing code. That is
> exactly why it could not simply be overwritten: somebody chose it. The ruling
> is that a row behaving differently by surface would be worse than either
> rule, so the change is applied everywhere at once.

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
  onRequestClose(): void         // Escape. SUPERSEDED 2026-09-11 - see below
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

---

# Addendum, 2026-09-05 (third entry): first contact, verdicts

**The Account surface consumed the component.** Each of the eleven positions in
the first addendum now carries a verdict from behaviour rather than from
reasoning. Evidence: 23 surface tests, 24 slot tests, a live walk of 18 checks
on a real record, and a visual comparison against the vanilla at three widths.

| # | position | verdict |
|---|---|---|
| 1 | `value` is always a string | **CONFIRMED.** Every Account field is text or a select over strings |
| 2 | drafts live at the surface | **CONFIRMED, and load-bearing.** The name header ALREADY shared `acctEdits` in the vanilla; a row-owned store could not have expressed that |
| 3 | `orig` is never stored | **CONFIRMED.** After a save the record re-fetches and dirty recomputes to clean with no reconciliation step |
| 4 | the seed REPLACES | **CONFIRMED for text.** See 4b |
| 5 | which keys are seeds | **CONFIRMED**, unchanged |
| 6 | a rejected seed does not open the row | **AMENDED.** See below |
| 7 | closing does not clear a draft | **CONFIRMED**, walked live |
| 8 | discard leaves the row open | **CONFIRMED**, text and select alike |
| 9 | `canEditFields()`, no argument, silent refusal | **CONFIRMED**, and made concrete: true for `account-detail`, false for anything not yet ruled |
| 10 | the guard fails closed | **CONFIRMED, and it shaped the wiring.** A global `() => true` would fail OPEN on the two surfaces that have doors |
| 11 | no vanilla class names copied | **CONFIRMED with one carve-out.** The name header is not a `FieldRow`; it is a rebuild of a specific vanilla element and keeps `cd-name-display`, `cd-name-input`, `ref-field-edit`, `ref-field-discard`, because those are what style it |

## FINDING 4b (new): whether a seed reaches an editor is the EDITOR's property

`revealFieldControl` seeds only a `TEXTAREA` or a text/number `INPUT`. A
`<select>` is excluded and its own comment says why. So the row opens, the
select focuses, and the character is discarded to the browser's type-ahead.
**Ported, not improved.** `editorTakesSeed(field)` is where this lives.

## FINDING 6, AMENDED: two different rejections, and only one refuses to open

The original read *"a rejected seed does not open the row"*, written about the
`inputMode` guard: opening on a character the field will refuse shows an editor
that discarded the keystroke that summoned it.

**A select rejects EVERY seed**, so applied literally that sentence would make
three of the Account surface's rows keyboard-inaccessible - the opposite of
behaviour 4's purpose. Split:

- **the field's GUARD rejects it** (`inputMode`) - the row does NOT open. The
  original sentence, unchanged.
- **the EDITOR cannot hold it** (a select) - the row DOES open, focused, without
  a seed.

## The editor slot: LANDED

The interface in the second addendum entry is in production on the Account
surface. Three of its fourteen rows use the select editor. The 49 tests written
against the seven behaviours passed **byte-unchanged** through the refactor.

## And a note the contract did not have: the REVERT is a load-order property

Not about the row, but about how a migrated surface goes back, and it was found
by rehearsing rather than by reading.

**A bundle serving more than one surface cannot be reverted per-surface by
removing its script tag** - that would revert every surface it serves. And
restoring a vanilla tag is a no-op if the bundle loads afterwards, because both
write the same `window` name and the last one wins.

**Measured on a rehearsal branch: 69 React markers and ZERO vanilla rows on a
tree whose revert had been applied.** With the bundle loaded FIRST, restoring
one vanilla tag reverts exactly that surface, proven both ways.

---

# Addendum, 2026-09-06: the Reference tab's census, and six editor layers

**Added at Migration Round 5, Phase 0 close, before Phase 1 built anything.**
The Reference tab is the contract's birthplace: the seven behaviours were
taken from `openRefField` and its siblings. This is the first time the
document has been measured against the surface it came from.

## The census: the table's counts are per-BRANCH, and it did not say so

`scripts/round5/field-census.mjs`, on an initialised, exercised record, with a
second instrument (the source's own `ALL_EDITABLE_FIELDS`) agreeing exactly:
21 source keys, 21 rendered rows, none in either direction alone.

**The 21 / 5 in the table above is CONFIRMED, and it describes ONE BRANCH.**

| branch | click-to-edit | read-only |
|---|---|---|
| same-as-account OFF (the default) | **21** | **5** |
| same-as-account ON | **15** | **11** |

The six proposal-address rows swap from `refFieldRow` to `refReadonlyRow` when
the flag is ticked. The table's row for this surface is amended to read
`21 / 5 (15 / 11 with same-as-account on)`, and the totals stay as they are,
because the default branch is what they were counted from.

**Two of the 21 do not go through the row renderer at all.** `name` renders
from its own header markup and `summary` from static markup in `index.html`.
Both still open through the same generic `openRefField`, which is why they are
rows for the contract's purposes and not for a count taken from `refFieldRow`'s
call sites. A census of call sites reads 19.

## The editor slot's next four layers, and one that is not a row

Measured editor kinds across the 21: **8 text, 7 select, 4 date, 1
numeric-text, 1 textarea.** Text and select are in production since Round 2.

### A1. `editorTakesSeed` is generalised off `SelectEditor`'s NAME

It reads `editorFor(field) !== SelectEditor`, which names one editor rather
than the property. The vanilla's rule is `revealFieldControl`'s own:

```js
const takesText = input.tagName === 'TEXTAREA'
  || (input.tagName === 'INPUT' && (input.type === 'text' || input.type === 'number'))
```

and its comment says **"A date input and a select cannot hold an arbitrary
first character."** A date editor added under the current implementation would
seed a character the input discards, which is FINDING 6's original defect
arriving through a new editor.

**Ruled: an editor DECLARES whether it can hold a seed**, and
`editorTakesSeed` reads that declaration. Select and date declare that they
cannot; text and textarea declare that they can. `CLAUDE.md` Verification 37:
a rule that names a mechanism polices the mechanism, not the effect.

### A2. `showPicker` is a vanilla behaviour the React tree does not have

`revealFieldControl` calls `input.showPicker()` for a select or a date input
when the open came from a user gesture. **`showPicker` appears nowhere in the
React tree**, so the select editor already diverges silently and a date editor
would inherit it.

**Ruled: ported.** The row already knows whether an open came from a gesture,
and an editor that wants the picker asks for it on focus. Recorded as a
divergence closed rather than a feature added.

### A3. A display suffix

`duration` displays `12 months`. The suffix is display-only, appended in the
display half, and never part of the value. **Ruled: `suffix?: string` on the
descriptor, rendered by the display half only**, never by an editor and never
in the draft. A suffix that reached the value would make dirty wrong.

### A4. `min` on a date is DESCRIPTOR DATA, not a call-site argument

Round 5 Phase 0 FINDING 1: `DATE_FIELDS` declares `noPast: true` on both
`estClose` and `estGoLive`, and the render passes
`{ date, number, integer, suffix }` - `noPast` is not in the list. Measured:
`estClose` renders `min="2026-09-06"` because a separate call site hardcodes
it, and **`estGoLive` renders no `min` at all**.

Not a data-integrity hole: `isNotPastIsoDate` on the server rejects the same
thing independently. It is a declared property with no reader.

**Ruled: `min?: string` is descriptor data and the date editor reads it**, so
a field that declares the constraint gets it. The same keying as `inputMode`,
and for the same reason: a per-call-site argument is a to-do list that has to
be completed again on every new field.

### A5. A row whose original does not come from the payload

`estClose` reads `opportunity_details.forecast_close_date` through
`refFieldOrigValue`'s special case, and saves through the close-date-move
route. Save semantics are excluded from this contract deliberately and stay
excluded. **What the DESCRIPTOR must express is only that `value` is supplied
by the caller**, which it already does: the descriptor carries `value`, not a
payload key. **No change. Recorded so the next reader does not add one.**

### A6. The textarea editor takes a seed

`revealFieldControl` includes `TEXTAREA` in `takesText` explicitly, and its
comment says why: it is "the single field on each of those screens that a
person is most likely to tab to and start typing into". **Ruled: the textarea
editor declares that it CAN hold a seed**, unlike select and date.

### A7. The checkbox is NOT a field row

`commAddressSameAsAccount` is a `<input type="checkbox">` with an `onchange`,
rendered inside the proposal-address block. It writes into the same draft
store and rides the same batched save, and its dirty is by COMPARISON - the
handler deletes the draft when the new value equals the original, which is
behaviour 1 applied to a boolean.

**Ruled: it is a DIRECT INPUT on the surface, not a row**, and it is the
contract's `direct inputs` column rather than its `click-to-edit` column. It
has no display half, no door, no seed and no discard. What it shares with the
rows is the draft store and the bar, which are surface-level by behaviour 2
and behaviour 6.

## And a finding against behaviour 7, on this surface, today

**Behaviour 7 says the read-only variant has "no opener and no tab stop".
`refReadonlyRow` emits neither. The rendered rows carry `tabindex="0"`
anyway.**

The author is `app.js`, not the row: `EDIT_OPENING_SELECTOR` lists
`.ref-field-display` with no `:not(.readonly)`, and the ownership sweep sets
`tabindex` and `aria-disabled` on every match. `aria-disabled="false"` on a
read-only row is the fingerprint, because nothing else on that surface writes
it.

**Ruled: the contract is right and the vanilla is wrong.** A React read-only
row has no tab stop. This is a deliberate, recorded divergence from the
vanilla in the owned case, and the reason is that the vanilla's behaviour is
an unintended side effect of a selector written about editable rows.

---

# Addendum, 2026-09-06 (second entry): SECOND contact, the Reference tab

**The surface the contract was TAKEN FROM has now consumed the component.**
Round 2's verdicts came from the Account surface, which has 15 rows, no
ownership door, and one editor kind beyond text. The Reference tab has 21
rows, the door the contract quotes, four editor kinds, a two-shape branch and
a sub-panel - so the eleven positions are tested here harder than anywhere.

Evidence: 24 surface tests, 18 descriptor tests, 21 editor tests, and an
11-injection sweep with a verified-snapshot harness, all in jsdom. Phase 2
walks it live.

| # | position | Round 2 verdict | verdict HERE |
|---|---|---|---|
| 1 | `value` is always a string | CONFIRMED | **CONFIRMED, and it decided the checkbox.** A boolean draft against a string original reads dirty forever under behaviour 1. `'true'` and `''` are the two states |
| 2 | drafts live at the SURFACE | CONFIRMED, load-bearing | **CONFIRMED, and load-bearing a second way.** The same-as-account flag is not a row, and it still shares the store - which is the only reason it can ride the batched save |
| 3 | `orig` is never stored | CONFIRMED | **CONFIRMED** |
| 4 | the seed REPLACES | CONFIRMED for text | **CONFIRMED**, unchanged |
| 4b | whether a seed reaches an editor is the EDITOR's property | new in Round 2 | **CONFIRMED AND GENERALISED. See A1.** It was implemented as `editorFor(field) !== SelectEditor`, which names one editor. A date editor added under that would have seeded a character the input discards |
| 5 | which keys are seeds | CONFIRMED | **CONFIRMED** |
| 6 | a rejected seed does not open the row | AMENDED in Round 2 | **CONFIRMED as amended.** Both halves now have three members each rather than two: the guard refuses and does not open; select, date and checkbox open without a seed |
| 7 | closing does not clear a draft | CONFIRMED | **CONFIRMED** |
| 8 | discard leaves the row open | CONFIRMED | **CONFIRMED** |
| 9 | `canEditFields()`, no argument, silent refusal | CONFIRMED | **CONFIRMED, and it reached a surface that HAS a door.** Round 2's Account surface had none, so this is the first real exercise: 21 rows refuse by click, by Enter, by Space and by seed |
| 10 | the guard fails CLOSED | CONFIRMED | **CONFIRMED, and it is not academic here.** `CAN_EDIT_BY_VIEW` has no `opportunity-detail` line today, so an unwired Reference tab refuses every row - which is the safe direction and is what the seam's default already does |
| 11 | no vanilla class names copied | CONFIRMED with one carve-out | **CONFIRMED, no carve-out needed.** The name header is a `FieldRow` here, not a rebuilt element |

## What the second contact changed in the document

**Behaviour 6's wording.** *"Dirty count is computed across all open drafts"*
was read as describing the vanilla. Measured: the vanilla COMPUTES the count
and shows none - `updateRefEditBar` uses it as a boolean. The React bar shows
it. The contract says the bar aggregates; this surface shows what it
aggregated, and that is a deliberate improvement recorded rather than a silent
one.

**Behaviour 7 is right and the vanilla is wrong**, ruled in the previous
addendum: the five read-only rows carry `tabindex="0"` because `app.js`'s
ownership sweep matches `.ref-field-display` with no `:not(.readonly)`.

**Behaviour 2 gained a second kind of consumer.** The door has always been
about ROWS. The same-as-account flag is a direct input with no row around it,
so the guard has to reach it separately - it is disabled rather than refused
at a door it does not have. **A surface's door covers its direct inputs too,
and that is not derivable from behaviour 2 as written.**

## And one thing the contract still does not cover, named rather than fixed

`estClose` reads `opportunity_details.forecast_close_date` and saves through a
different route with a mandatory reason. The descriptor expresses the read
(it carries `value`, not a payload key) and says nothing about the write,
because save semantics are excluded deliberately. **Phase 2 is where that
lands**, and it is the one row whose write path is not the batched save.

---

# Addendum, 2026-09-07: the LOOKUP editor, and why a string list could not carry it

Written **before** the Contact surface's build, from the census rather than from
either implementation. Migration Round 6, Phase 1.

## The gap, measured

The Contact census is **15 fields in four editor kinds**: 11 text, 2 select, 1
textarea, and **1 that no proven layer can express**.

`FieldDescriptor` declares `options?: string[]`, so **a select's value and its
label are the same string**. That is true of every select the migration has met
so far - Region, Source, Opportunity Type - because their stored value IS the
words on screen.

**Industry is not.** It is `records.industry_id`, a foreign key. The stored
value is an id nobody should ever read, and the readable form is a name that
lives in another table. The vanilla renders it through a second row builder,
`cdColumnFieldRow`, whose display half calls `cdIndustryName(currentId)` and
whose edit half emits `<option value="${o.id}">${o.name}</option>`.

## A8. AN EDITOR'S OPTIONS ARE `{id, name}` PAIRS, AND THE STRING FORM IS THE
## DEGENERATE CASE

**Ruled: `options` accepts `Array<string | {id, name}>` and is normalised to
pairs at the descriptor.** A bare string `s` means `{id: s, name: s}`.

The generalisation goes this way round - pairs as the general form, strings as
the special case - rather than adding a second `lookupOptions` key beside the
first, for the reason `CLAUDE.md` Verification 20 gives: two declarations of
"the choices this field offers" agree today and drift later. One shape, and the
existing string form keeps working **by construction rather than by
inspection**, which is what makes it safe to apply to the eleven select rows
already in production.

## A9. THE DISPLAY HALF RESOLVES THROUGH THE SAME LIST THE EDIT HALF OFFERS

**Ruled: the display half renders `name` for the stored `id`, resolved from the
descriptor's own options, never from a second lookup.**

This is the half a string list hid. With value and label identical, the display
half could render the raw value and be right by accident. With a real lookup,
rendering the raw value puts a UUID on the screen.

A second resolver - a `nameFor(id)` helper reading a cache the descriptor does
not own - would be Verification 20 exactly, and the version it replaces is the
vanilla's: `cdIndustryName` reads `industriesCache` while the edit half reads it
again to build options. **Two readers of one list, in adjacent lines.**

## A10. AN UNRECOGNISED STORED ID KEEPS ITS PLACE

**Ruled: a stored id absent from the options list is still rendered as a
choice**, labelled with whatever readable form is available and falling back to
the id itself.

The precedent is this project's own, from the milestone grid: *"an unrecognised
stored milestone keeps its option in the select."* The reason is the same. A
select that silently drops a value it does not recognise turns "this record
points at an industry that has since been renamed" into "this record has no
industry", and the next save writes that erasure to the database. **A default is
an initial value, not a fallback** (Architecture 11), and dropping an unknown
option is a fallback wearing a tidier name.

## A11. THE OPTIONS ARE FETCHED BY THE SURFACE, NOT READ FROM THE SHELL

`industriesCache` is declared `let` at `frontend/app.js:5065`. Migration Round
2's rule: a `let` at the top level of a classic script is a LEXICAL name that no
bundle can read - not a coupling to carry over, a coupling that was never
possible.

**Ruled: the surface fetches `/api/industries` itself**, the same ruling Round 5
took for `terminusStaffCache` on the Reference tab. One fewer shell global
rather than one more accessor.

## What this addendum does NOT decide

**Whether the lookup editor needs a type-ahead.** The vanilla renders a plain
`<select>` over every industry, and the count is small enough today that this
is not a question. It becomes one at the Account picker, which is a search
already, and that is a different control rather than a bigger version of this
one.

**Whether `options` should be async.** They are fetched, so a row can render
before its choices arrive. Ruled by construction instead: the surface holds the
fetched list and passes descriptors built from it, so a descriptor never carries
a pending list. If a later surface needs per-row async options, that is a new
entry rather than a widening of this one.

---

# Addendum, 2026-09-07 (third entry): FIFTH contact, the Contact surface

**The first surface to need an editor the slot could not express.** Account had
15 rows and one kind beyond text; the Reference tab had 21 rows, a door and four
kinds; the deal form had eleven margin inputs and a census. Contact has 15 rows
and looked like the easiest of the four - and it carried the one field a
`string[]` cannot describe, which is why A8 to A11 exist.

Evidence: 17 surface tests, 15 blocking tests, 9 link-panel tests, 14 new editor
and row tests, and an **18-injection sweep, 18/18 detected**, verified-snapshot,
reverted green, seven files byte-identical. All jsdom; Phase 2 walks it live.

| # | position | Reference verdict | verdict HERE |
|---|---|---|---|
| 1 | `value` is always a string | CONFIRMED, decided the checkbox | **CONFIRMED, and it decided the lookup.** The value is an id string and the label is a name; keeping `value` a string is what let the pair form be additive rather than a new type |
| 2 | drafts live at the SURFACE | CONFIRMED, load-bearing twice | **CONFIRMED** |
| 3 | `orig` is never stored | CONFIRMED | **CONFIRMED** |
| 4 | the seed REPLACES | CONFIRMED | **CONFIRMED** |
| 4b | whether a seed reaches an editor is the EDITOR's property | CONFIRMED AND GENERALISED | **CONFIRMED, and the lookup inherited it for free.** A lookup is a select, so it declares it cannot hold a seed, and A1's per-kind declaration meant no change |
| 5 | which keys are seeds | CONFIRMED | **CONFIRMED** |
| 6 | a rejected seed does not open the row | CONFIRMED as amended | **CONFIRMED** |
| 7 | closing does not clear a draft | CONFIRMED | **CONFIRMED** |
| 8 | discard leaves the row open | CONFIRMED | **CONFIRMED** |
| 9 | `canEditFields()`, no argument, silent refusal | CONFIRMED, first real door | **NOT EXERCISED, and that is a finding rather than a pass.** Contact has NO ownership read: measured, zero occurrences of `is-not-mine`, `owner_id` or `canEditFields` in `contact-detail.js`, and the shell sweep touches only the Opportunity and Test Bed views. The Account preserve ruling applies by precedent |
| 10 | the guard fails CLOSED | CONFIRMED | **CONFIRMED by construction and untested here**, for the same reason as 9 |
| 11 | no vanilla class names copied | CONFIRMED | **CONFIRMED, with one deliberate adoption.** `.field-blocked` is the vanilla's tint class and is kept, because the stylesheet rule is shared and the tint is a treatment rather than a structure |

## What the fifth contact changed in the document

**The editor slot gained a kind that is not a shape.** Text, select, date,
textarea and checkbox are all distinguishable by what the CONTROL is. A lookup
is a `<select>` too: what differs is that its value and its label are different
things. **The slot was extended by generalising the DATA rather than adding a
member**, which is why A8 reads as one declaration with a degenerate case
instead of a sixth editor.

**And it exposed that the row has TWO DISPLAY PATHS.** The standalone path
renders `field.value`; the connected path renders `rows.valueOf(name)`, the live
draft. Every test written for A9 passed against the first while the second - the
one every real surface uses - still put a raw id on the screen. The contract had
never had reason to say the two paths must agree, because until a lookup they
rendered the same string. **They must, and now do.**

## What the fifth contact did NOT test

**The door**, positions 9 and 10, for the reason in the table: this surface has
none to test. The Reference tab remains the only real exercise.

**Anything live.** Every verdict above is jsdom. The Reference tab's own round
recorded five defects that no assertion saw and a screenshot did, and nothing
in this phase changes that: the surface has not been rendered in a browser, so
its styling, its geometry and its computed visibility are unmeasured.

**The name header as a row.** It is one here, where the vanilla makes it static
markup - the same departure the Reference tab took, and for the same reason.
That is a claim about behaviour parity that only the Phase 2 visual comparison
can settle.

---

# Addendum, 2026-09-07 (fourth entry): SIXTH contact, the Test Bed field surface

**The first surface whose door was already broken.** Account had none, the
Reference tab had the contract's own, Contact had none again. Test Bed has one
that **does not work**, and that is what this contact tested.

Evidence: 28 descriptor and bounds tests, 16 cost-preview tests, 13 door tests,
5 save-path tests, and a **10-injection sweep, 10/10 detected**, reverted green,
five files byte-identical. All jsdom; Phase 2 walks it live.

| # | position | Contact verdict | verdict HERE |
|---|---|---|---|
| 1 | `value` is always a string | CONFIRMED | **CONFIRMED** |
| 2 | drafts live at the SURFACE | CONFIRMED | **CONFIRMED, AND LOAD-BEARING IN A NEW WAY.** The cost preview reads the live drafts without owning them, so a preview and a save cannot disagree about what is on screen |
| 3 | `orig` is never stored | CONFIRMED | **CONFIRMED** |
| 4 | the seed REPLACES | CONFIRMED | **CONFIRMED** |
| 4b | whether a seed reaches an editor is the EDITOR's property | CONFIRMED | **CONFIRMED** |
| 5 | which keys are seeds | CONFIRMED | **CONFIRMED** |
| 6 | a rejected seed does not open the row | CONFIRMED | **CONFIRMED** |
| 7 | closing does not clear a draft | CONFIRMED | **CONFIRMED** |
| 8 | discard leaves the row open | CONFIRMED | **CONFIRMED** |
| 9 | `canEditFields()`, no argument, silent refusal | NOT EXERCISED | **CONFIRMED, AND IT IS THE POINT OF THIS CONTACT.** All four entry paths refuse on all 28 rows |
| 10 | the guard fails CLOSED | NOT EXERCISED | **CONFIRMED.** No registry line exists for this view until the swap, so the surface refuses everything |
| 11 | no vanilla class names copied | CONFIRMED with one adoption | **CONFIRMED**, with `.pg-card` and `.ref-cards` adopted as before |

## What the sixth contact changed in the document

**Position 9 got its second real exercise, and its first against a BROKEN
door.** The Reference tab proved the contract's door works. Test Bed proves it
**fixes something**: the vanilla's `openTbField` has no ownership check at all,
so its three entry paths disagree - the mouse is blocked by
`pointer-events: none`, and **the keyboard is not**. `tabIndex` stays 0, the row
takes focus, and Enter opens it. Measured live in Phase 0b.

**Behaviour 2 removes the disagreement by construction**, because there is one
hook and no second mechanism to keep in step.

**AND A4 WIDENS: A BOUND MAY DEPEND ON A SIBLING'S DRAFT.**

A4 made `min` descriptor data, and every date so far carried a constant. Here
the go-live floor is the install date **as currently typed**, and the install
ceiling is the go-live date. The vanilla mutates `min`/`max` on the inputs in
place precisely because *"re-rendering the row would throw away an open edit"*.

**The React row has no such constraint**: the draft lives in the controller, so
the descriptor can simply be rebuilt with a new bound and the open editor keeps
what was typed. **A4 is unchanged; what is recorded is that its data may be
derived per render**, and the vanilla's in-place mutation is a workaround for a
constraint this component does not have.

## A recommendation this contact makes and does not take

**A row the door refuses should drop its tab stop, the way a `readOnly` row
already does.**

Measured: a refused row still carries `tabIndex="0"`, takes focus, and then
refuses. **That is already the fix** - the vanilla's row focuses AND opens - but
it leaves a keyboard user landing on a stop that does nothing.

**Not taken here**, because it changes the shared component across four
surfaces and is therefore a contract decision rather than a phase's. Recorded so
it is decided rather than drifted into.

## What this contact did NOT test

**Anything live.** Every verdict is jsdom. The door was measured live on the
VANILLA in Phase 0b; the React door has not been.

**Scoring and units**, which are Phase 1b and are 35 of this surface's 136
names.

---

# Addendum, 2026-09-07 (eighth entry): A12. A REFUSED ROW DROPS ITS TAB STOP

**RULED BY THE BUSINESS.** The seventh contact recorded this as a
recommendation it would not take, on the grounds that it changes the shared
component across four surfaces and is therefore a contract decision rather than
a phase's. It has now been taken.

## A12. On a surface whose door refuses, a row has no tab stop

**The rule, and it is behaviour 7's own logic rather than a new one.**
Behaviour 7 says a read-only row has "no opener and no tab stop", and the
reason is that a stop which cannot be acted on is a stop that lies. **A row the
door refuses is in exactly that state**, so it gets exactly that treatment.

The two are one rule stated for two causes of the same condition:

| the row cannot be opened because | tab stop |
|---|---|
| the DESCRIPTOR says it is read-only (behaviour 7) | none |
| the DOOR refuses this viewer (A12) | none |

## What was measured, and it is why this is worth a ruling

**Phase 0b measured the vanilla Test Bed's door and found it PRESENTATIONAL:
the mouse was blocked and the keyboard was not.** A refused row carried
`tabIndex="0"`, took focus, and then refused. The React door already improves
on that - it refuses on both paths - but a refused React row still carries the
stop, so a keyboard user tabs onto a control that does nothing and gets no
signal that the reason is ownership rather than a bug.

**Distinct from the vanilla's fault.** The vanilla's is a HOLE: focus, then
open, then edit. This is not a hole; the row refuses correctly. It is a stop
that means nothing, which is Verification 27's distinction between a property
of the document and a property of the person doing the task.

## Scope, and it is deliberately the shared component

Four surfaces carry the shared row today. **The rule is the component's, not
each surface's**, because the alternative is four implementations that agree
now (Verification 20). A surface whose door always opens is unaffected: the
condition is the door refusing, not the door existing.

## Implementation is DEFERRED to Round 7 Phase 2, as ruled

Not built in Phase 1b. **Phase 1b is behind the line and Test Bed's vanilla is
still the live surface**, so a change to the shared component reaches three
already-swapped surfaces the moment it lands, and it should land in the commit
that is being walked rather than in one that is not.

**What Phase 2 owes this entry:**

1. The shared row drops `tabIndex` when the door refuses, by the same branch
   behaviour 7 already uses for `readOnly`.
2. An injection proving it: restore the stop, watch a test fail. The two causes
   are asserted SEPARATELY, because one branch serving both is exactly the
   arrangement where a later edit satisfies one and quietly drops the other.
3. The refused row still READS. Dropping the stop must not drop the row's
   display half, and the assertion says so by name - Verification 7, what must
   REMAIN as well as what must change.
