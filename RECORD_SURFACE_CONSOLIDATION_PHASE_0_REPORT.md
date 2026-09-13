# ROUND B, Phase 0: confirmation and the retirement inventory

Read-only. Prior facts re-confirmed against the current tree; the new work
is the **capability** inventory and the pointer census. Two censuses, both
calibrated, over 912 files.

---

## THE HEADLINE: TWO PREMISES DO NOT HOLD, and one is R4's

**Neither blocks the round. Both change what Phase 1 must build**, and R4's
changes what "do not touch it" means.

### 1. R4's premise is false: the create-actions are NOT on the Contacts list

R4 says *"Test Bed / Opportunity creation stays where it is (the Contacts
list screen)"*.

**Measured**: `cd-create-test-bed` and `cd-create-opportunity` exist in
**exactly one place** - `StageActions.tsx`, rendered by **exactly one
thing** - `ContactHost`, **which is the screen R5 retires.**

The Contacts list screen (`#view-contacts`) carries **a "Mine" toggle and
the rows. No create actions at all.**

> **So "leave them where they are" and "retire that screen" cannot both be
> done. Retiring it deletes them.**

### 2. Retiring the screen removes FOUR capabilities, and two are unnamed

**Verification 49's clause, and this estate has paid for it once already**:
*a census of fields is not a census of the surface - the swap then removed
five working capabilities, because not one of them is a field.*

| capability | component | named by a ruling? |
|---|---|---|
| link, change or create the account | `LinkAccountPanel` | **partly** - R2's account section |
| view and edit the **account's own details** | `AccountDetailsModal` | **partly** - R2 |
| **PARK the contact**, with a date and a reason | `ParkForm` | **NO** |
| **stage progression** - Qualify, Nurture - **and create-from** | `StageActions` | **NO**, and R4 assumes otherwise |

**All four are rendered only by `ContactHost`.** `FieldRow`, `Card` and
`Collapsible` are shared with the Account, Reference and Test Bed surfaces
and survive untouched.

---

## 1. Re-confirmed, unchanged

| | |
|---|---|
| contact / Unqualified | **6** |
| contact / Nurture | **0** |
| **contact / Qualified** | **10** |
| the Contacts list | `renderContactGrid('contacts-rows', c => c.status === 'Qualified', ...)` |
| its row-click | `onclick="navigate('contact-detail', '<id>')"`, `app.js:5683` |
| the Leads card | `LEADS_PIPELINE = ['Unqualified', 'Nurture']` |

**`contact-detail` is still the only detail view those 10 have.**

---

## 2. R3: the surface exists, the ENTRY must be built

**`LeadCardActions` line 87:**

```js
setStep(missing.length ? 'incomplete' : 'account')
```

**The surface opens only when something is missing.** With a complete
record, Qualify goes straight to the account step.

**But the component needs little.** It renders **all** `CONTACT_FIELDS` and
`ADDRESS_FIELDS` prefilled from the record and marks only what `blocking`
names - **with `blocking` empty it already renders every field and zero
markers.**

**So R3 is: an entry point, a mode flag to drop the "Please complete
missing data" eyebrow, and a save path that does not try to advance
qualification.** The rendering half is done.

---

## 3. R2: where the account lives

| | |
|---|---|
| the link | **`records.parent_record_id`** to an `account` record |
| coverage | **10 of 10** Qualified contacts have one |
| the fetch today | `ContactHost` does its own `GET /api/accounts` for the picker's options |

**ONE SOURCE, and it is the record's own `parent_record_id`.** The account
section reads the linked account; it must not open a second path to
"which account is this" - the shared surface already receives the record.

**And R2's "account section" is TWO capabilities, not one**: choosing or
changing the account (`LinkAccountPanel`) and reading or editing **the
account's own details** (`AccountDetailsModal`). **A section that only
does the first loses the second.**

---

## 4. R5: the pointer inventory

**90 file-anchor pairs across 912 files**, calibrated both ways, anchors
assembled from parts so the instrument cannot match its own source.

| anchor | files | in code |
|---|---|---|
| `view-contact-detail` | 22 | 20 |
| `loadContactDetail` | 12 | 11 |
| `ContactHost` | 25 | 23 |
| `ContactView` | 9 | 8 |
| `setContactReturnView` | 22 | 21 |

**`setContactReturnView` is NOT `contact-detail`'s to retire.** It reaches
11 React tests, 3 gate suites and `shell-services.ts`, and its consumers
include the Test Bed door, the reference host and the field rows. **It is
shared navigation infrastructure the screen happens to use.**

### The three-consumer constraint: TWO of three dissolve

| component | after `ContactHost` retires | verdict |
|---|---|---|
| **`NotesHistory`** | `LeadCard`, **`TestBedHost`** | **does NOT dissolve** |
| `FollowUpTask` | `LeadCard` only | **dissolves** |
| `LeadFieldInput` | three, all `leads/` | already leads-only |

**R5 assumes all three dissolve. `NotesHistory` keeps the Test Bed**, so
its optional-prop discipline stays.

---

## 5. R1: the row-click

**One line**: `app.js:5683`,
`onclick="navigate('contact-detail', '${c.id}')"`.

**What changes depends on the shape Phase 1 takes** - whether the shared
surface becomes what `contact-detail` renders (the view id stays, its
CONTENT is replaced) or the list navigates somewhere new. **The first is
far cheaper**: 20 in-code references to `view-contact-detail` keep working,
including six Leads probes and three gate suites.

**Recommended: replace the screen's CONTENT, keep its id and route.** R5's
"retire the bespoke screen" is then the retirement of `ContactHost`,
`ContactPanel` and their layout - not of the view.

---

## Decisions Phase 1 needs

1. **R4, and it is the round's shape.** The create-actions are on the
   screen being retired. Either they move onto the consolidated surface
   (contradicting "do not touch"), or the retirement keeps
   `StageActions` alive somewhere. **Nothing in R5 can be built until this
   is ruled.**
2. **Park and stage progression**: the consolidated surface needs both for
   a contact, or the capabilities are lost. **Neither is named by a
   ruling.**
3. **R2 is two capabilities**, not one - the picker and the account's own
   details.
4. **Retire the CONTENT, keep the view id** - recommended, and it makes 20
   in-code references and three gate suites a non-event.
5. **`NotesHistory` keeps a frozen consumer.** The optional-prop discipline
   stays for it.

---

## What surprised

**A reach measurement reported "(nothing renders it)" for five components
`ContactHost` demonstrably renders.** A shell-escaped regex became a
literal backslash, so the matcher could not match anything.

**It would have said the capability gap was EMPTY** - the single most
dangerous wrong answer this phase could produce, on the round that retires
a screen serving live records. Caught because the answer contradicted a
file I had just read, and the rewritten matcher **carries a known-present
control**: `NotesHistory` must be found in 3 files or the run refuses.

**And the capability extractor first counted TypeScript generics as
components** - `useState<BlockingState>` - reporting six phantom
capabilities. Discriminated by the character before the `<`, and
calibrated on a generic explicitly.

**Both are the shape this round is meant to be watching**, and neither was
a threshold: they were matchers that could not fail correctly. **Verification
47's new remedy - take the threshold from the requirement - would not have
caught either.** That is worth knowing for the close.

---

## F5 fired again, on variance, and it was not touched

The pre-commit hook refused this report's first commit:

> *the heaviest chunk took **1201ms** warm over 9564 rows in 3 tags, past
> the **889ms** ceiling*

**Re-run twice with no change, it PASSED both times.** Same signature as
its previous firing - 1022ms against 889 while the table had grown by 69
rows, ruled then as **variance, not growth**.

**Nothing was changed.** The carried ruling is explicit: **review the
DERIVATION, not a third reactive step-down.** This is the second firing on
variance, which is **evidence for that review** rather than licence to move
the number.

**Recorded here so the derivation review has two data points when it is
scoped.** Population today: 92,459 `record_revisions`, 58,497 `records`.

---

## What this does NOT establish

- **Nothing about how the consolidated surface will look.**
- **The bespoke screen's field-level parity.** This phase counted
  CAPABILITIES; the fields themselves are next, and are what John's walk
  will judge.
- **No live measurement of `contact-detail` itself** - it was read, not
  driven. Phase 1 must screenshot it **before** retiring it, or the parity
  claim has no baseline.
