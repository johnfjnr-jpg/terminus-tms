# Migration Round 2, Phases 1 and 2: the editor slot and the Account surface

**2026-09-05.** Gate green at **20 stages**, React suite **133/133**. Nothing
pushed. Phase 3 not started.

---

## 1. The slot refactor, and the 49-unchanged proof

**The proof first, because it is the claim that matters.**

```
before the refactor  9d3e5d6f178d4f182a2fccf1a7fd71ceb3060127c1786741e9030f2f504f5783
after  the refactor  9d3e5d6f178d4f182a2fccf1a7fd71ceb3060127c1786741e9030f2f504f5783
                     UNCHANGED        Tests  49 passed (49)
```

`frontend-react/src/__tests__/field-row.test.tsx` is **byte-identical**. Not one
assertion was edited to fit the new shape. Had one failed, the refactor would
have moved behaviour and that would have been the finding.

**What moved out:** the `<input>` and its `onChange`/`onKeyDown`.
**What stayed:** draft state, the ownership door, dirty, the tab stop, the
keydown opener, the seed character, discard, the visibility swap, and the
`inputMode` guard - which now runs in the ROW's `onChange`, so an editor has
nowhere to skip it.

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

`options` on the descriptor selects the select editor, so a caller declares
**data** rather than wiring - the same reasoning that keyed the numeric guard on
`inputMode` rather than on a list of field names.

**24 new tests** cover the select and the slot's own claims: an editor cannot
bypass the door, cannot own dirty, cannot smuggle a value past the declared
guard, and cannot be operated while the row is closed.

---

## 2. First contact: a verdict on each of the eleven findings

The addendum's eleven positions, each confirmed, amended or overturned by this
surface's behaviour.

| # | position | verdict |
|---|---|---|
| 1 | `value` is always a string | **CONFIRMED.** Every Account field is text or a select over strings. Nothing needed a number |
| 2 | drafts live at the surface | **CONFIRMED, and load-bearing.** Phase 0 measured `ACCT_ALL_EDITABLE_FIELDS` as 15 including `name`, and `saveAcctFields` reads `acctEdits` for all of them - so the name header ALREADY shared the store. A row-owned draft could not have expressed that |
| 3 | `orig` is never stored | **CONFIRMED.** After a save the record re-fetches, descriptors carry the new values, and dirty recomputes to clean with no reconciliation step |
| 4 | the seed REPLACES | **CONFIRMED for text**, and see 4b below |
| 5 | which keys are seeds | **CONFIRMED.** Unchanged |
| 6 | a rejected seed does not open the row | **AMENDED.** It was written about the `inputMode` guard. A select rejects EVERY seed, and refusing to open would make three rows keyboard-inaccessible. Split: a seed the field's GUARD rejects does not open; a seed the EDITOR cannot hold opens without it |
| 7 | closing does not clear a draft | **CONFIRMED.** Escape on a row leaves the bar counting it, walked live |
| 8 | discard leaves the row open | **CONFIRMED**, on text and select alike |
| 9 | `canEditFields()`, no argument, silent refusal | **CONFIRMED, and the ruling made it concrete.** True for `account-detail`, false for anything not yet ruled |
| 10 | the guard fails closed | **CONFIRMED, and it shaped the wiring.** A global `() => true` would fail OPEN on two surfaces that have doors |
| 11 | no vanilla class names copied | **CONFIRMED with one deliberate exception** - see the parity statement |

**Finding 4b, a new entry for the addendum** (written into the contract at Step
B): whether a seed reaches an editor is a property of the EDITOR.
`revealFieldControl` seeds only a textarea or a text/number input; a `<select>`
is excluded and its own comment says why. So the row opens, the select focuses,
and the character is discarded to the browser's type-ahead. **Ported, not
improved.**

---

## 3. The walk

**Live, on a fixture Account, through the real server: 18 of 18 checks pass.**
Fixtures torn down; residue re-queried across accounts, contacts, opportunities
and test beds - **all clean**.

| claim | evidence |
|---|---|
| structure | 14 click-to-edit rows, 2 read-only (`dateCreated`, `parentAccount`), 3 selects, 14 tab stops |
| the name header | `H1`, no tab stop - **preserved, not fixed** |
| text recipe | open, type, discard-restores, reopen, type, save |
| select recipe | open, choose, discard-restores, reopen, choose, save |
| the header | shares the surface draft store: 3 changes counted across a text row, a select and the header |
| the server | holds all three saved values; an untouched field unmoved |
| the parent link | `parent_account_id` PATCHed **alone**, no payload, no save bar, row updates |
| the door | **no row refuses**, all 14 |

**Component tests:** 23 surface tests plus the 24 slot/select tests. React suite
**133/133** in the gate.

**Eight calibration injections, every one fired, reverted clean at 133** - with
the verified-snapshot harness, final reverted run included:

| injection | result |
|---|---|
| select loses its empty option | 1 failed |
| the select seed is no longer dropped | 1 failed |
| save sends the whole payload | 4 failed |
| `expected_revision` dropped | 1 failed |
| a blank name is allowed | 1 failed |
| the parent link joins the save bar | 2 failed |
| the name header gains a tab stop | 1 failed |
| Region loses its options | 2 failed |

---

## 4. The re-points

| # | location | what was done |
|---|---|---|
| 1 | `index.html` script tag | commented out, the vanilla file stays in tree |
| 2 | `index.html:383` `onclick="openAcctField('name')"` | **removed**, preserved in the comment the revert restores |
| 3 | `index.html:386` `onclick="discardAcctField('name')"` | **removed**, same |
| 4 | `opportunity-headline.test.mjs` | **re-pointed, three-part template** |
| 5 | `class-rules.test.mjs` `STATE_CLASSES` | **corrected** |

**Entry 4** read `frontend/account-detail.js` and asserted `label: 'Terminus
Lead'` survived. Unchanged it would have gone on **passing against a file the
browser never fetches** - the second instance of the Round 1 `ds-row` shape. Now:
off the dead file; the premise re-measured while there (Test Bed still labels it
in vanilla, Account labels it in the React descriptors - two files, two
languages, one claim); both sides asserted individually, so the last vanilla
consumer's departure fails the test **as an instruction to delete it**; plus a
clause that the dead file is not loaded.

**Entry 5** was `'field-editing': 'account-detail.js and contact-detail.js…'` -
half of it false the moment the tag went. **Nothing would have failed**: it is a
description inside a data structure, used as documentation and never asserted.
Corrected to name `contact-detail.js` and to say where the React tree expresses
the same state.

**One assertion updated rather than re-pointed, and the distinction is
deliberate.** `shell.test.tsx` asserted the bundle adds **exactly one** global
and failed when the Account loader was registered. That claim changed **by
instruction** - two surfaces, two loaders - so the test follows it, and the
**exactness is preserved**: still a set equality, so an accidental third global
still fails. That is a different situation from the 49 field-row tests, which had
to pass unchanged because the refactor was meant to move nothing.

---

## 5. Pixel parity

**The stylesheet is untouched.** Not one rule added, removed or changed.

The React rows carry the neutral `field-row*` class names from Round 1, per
addendum finding 11 - the consuming surface decides styling. **The surface
containers keep their vanilla identities exactly**: `detail-head`, `eyebrow`,
`sub`, `ref-cards`, `pg-card`, `pg-card-title`, `data-row`, `data-row-label`,
`empty-state`, `btn-text`, and the ids `acct-detail-name`, `acct-detail-number`,
`acct-detail-rows`, `acct-billing-rows`, `acct-shipping-rows`, `acct-parent-row`,
`acct-parent-search-panel`, `acct-contacts-list`, `btn-back-account-detail`.

**The one deliberate exception to finding 11**, and it is the finding's own
carve-out working as intended: the **name header** keeps `cd-name-display`,
`cd-name-input`, `ref-field-edit` and `ref-field-discard`. It is not a
`FieldRow`; it is a rebuild of a specific vanilla element, and those classes are
what style it. Copying them is the parity requirement, not a violation of the
row's neutrality.

**Not pixel-verified at three widths.** The brief puts the walk in Phase 3, and
this report does not claim a visual comparison it has not run.

---

## 6. What surprised

### a. Two shell globals the React tree cannot reach, and the fix removed couplings instead of adding them

`terminusStaffCache` and `accountsCache` are declared **`let`** at `app.js` top
level. A classic script puts `function` and `var` on `window`; **`let` and
`const` do not go on `window` at all**. Confirmed in the browser - both read
`undefined`.

So the vanilla surface reads them as **lexical** globals from the same script
scope, which a bundle can never do. The React tree fetches
`/api/terminus-staff` and `/api/accounts` itself, which **removes two couplings
rather than adding two accessors to `app.js`**.

This sharpens Round 1's `window.api` finding considerably. That one works today
and breaks when `app.js` becomes a module. **These do not work at all across a
script boundary**, and the difference is one keyword.

### b. `loadAccountDetail` was called BARE, not optionally

`app.js:214` read `loadAccountDetail(id)` - not `window.loadAccountDetail?.(id)`
as the approval view had. With the vanilla unloaded and no bundle, that is a
**`ReferenceError` thrown out of `navigate()`**, taking the whole navigation
with it rather than silently doing nothing. Guarded the same way, and the
visible-error path is the same.

### c. The create route silently ignores address fields

`POST /accounts` with `billingCountry: 'Singapore'` stores **`null`**. Measured
directly: every address key comes back `null` on create. `fixtures.mjs`'s
`freshTestBed` passes the same field and it is ignored there too.

**Pre-existing, unrelated to the migration, not fixed.** Recorded and queued
(build discipline 10).

### d. Three probe faults, and all three looked like product defects

The first live walk reported 3 of 18 failing. **All three were the instrument.**

- **discard "did not restore"** - the probe expected `'Singapore'` because the
  fixture POST passes `billingCountry`; measured, the route ignores it, so the
  field was empty and discard restored empty correctly. Fixed by reading the
  original **from the screen** instead of assuming it.
- **"nothing else moved" read `null`** - same cause.
- **"12 of 14 rows refused to open"** - the probe clicked all fourteen and
  asserted inside **one synchronous `page.evaluate`**, so every assertion read
  the DOM **before React re-rendered**. The door was open the whole time; the
  probe was measuring the previous frame.

Verification 17 three times in one probe. The tell each time was that the
failure DETAIL showed a value that was correct for a different question.

### e. The 133-test suite went green on its first run again

Same signature as Round 1 Phase 4, and the same answer: eight injections, all
fired. A green first run is the tell, not the proof.

---

## 7. Gate

```
MERGE GATE  20 stages
  PASS  reachability                          103ms
  PASS  session precondition                  204ms
  PASS  pure suite                 440/440 pass, 0 fail
  PASS  database suite              92/92 pass, 0 fail
  PASS  react suite                133/133 pass, 0 fail
  PASS  react bundle freshness
  PASS  14 HTTP probes
All 20 stages passed.
```

`dist` rebuilt in the same commit as its source; freshness stage green at
`ac148f95…`.

---

## Standing at the close

Not pushed. Phase 3 not started. `frontend/account-detail.js` is in tree and
unloaded. **The revert is three `index.html` edits plus the two re-points**, as
enumerated in Phase 0 and now confirmed by having made them.
