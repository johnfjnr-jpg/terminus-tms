# Migration Round 6, Phase 2: the swap, built and not taken

Session of 2026-09-07.

---

## WHAT IS NOT DONE, FIRST

### THE SWAP IS BUILT, REGISTERED, AND NOT TAKEN

The React Contact view is complete for the **fields** and the **Qualify
workflow**, walked live at **35/35**, and the bundle registers it. The vanilla
is loaded after it and re-assigns `window.loadContactDetail`, so **the vanilla
is what runs.** Removing one line takes the swap.

**It is not taken because 39% of the surface was never migrated, and nobody
knew.**

| behaviour | vanilla lines | migrated |
|---|---|---|
| the account-details modal | 193 | no |
| the park form | 153 | no |
| the notes history | 117 | no |
| unqualify | 38 | no |
| delete / create-opportunity | 23 | no |
| **total** | **524 of 1,327** | **no** |

**Phase 0 censused FIELDS, and not one of those five is a field.** The field
census, its live second instrument, the fifth-contact checklist and an
18-injection sweep all passed on a surface missing two fifths of its behaviour,
because **every one of them was asking about rows.**

That is Verification 33 exactly: every measure has a shape, and what falls
outside it is found by looking or not at all. It was found by putting the two
surfaces side by side.

**Taking the swap would have removed five working capabilities from a live
screen**, and `CLAUDE.md` rule 15 is explicit that a scope discovery is a report
rather than a quiet reshape - measuring it precisely and stopping beats
delivering a fifth of it.

**Verified live after restoring the tag:** the vanilla runs, its notes, park and
delete are back, nothing is stuck loading, and the back button works. 5/5.

### What Phase 2b needs

The five behaviours above, enumerated as behaviours the way the Qualify workflow
was in Phase 0 - the park form has an unsaved-changes warning and its own focus
trap, the notes history is append-only with one entry per save session, and the
account-details modal has two modes. **None of that is in any census yet.**

---

## 1. The swap, as built

One commit. `main.tsx` registers `loadContactDetail` as a **whole-view**
migration on the Account pattern, so `createRoot` owns `#view-contact-detail`.
That is what makes Phase 1's duplicate-id disposition true rather than merely
planned, and the ledger entry is updated from a requirement to a fact.

### C1: the seam, and the direction inverts

`app.js:306` bound the back button to `cdReturnView`, a `let` at the top level of
a classic script. Shared lexical scope made the read work; **a bundle could
never have satisfied it**, because `let` never reaches `window`.

```js
// before
document.getElementById('btn-back-contact-detail')
  .addEventListener('click', () => navigate(cdReturnView))

// after - and it works under BOTH states, which the first version did not
const fromSeam = typeof window.contactReturnView === 'function' ? window.contactReturnView() : null
const fromVanilla = typeof cdReturnView !== 'undefined' ? cdReturnView : null
navigate((fromSeam ?? fromVanilla ?? 'leads') === 'contacts' ? 'contacts' : 'leads')
```

The React view owns the answer and pushes it through `setContactReturnView`; the
shell asks. `typeof` is safe on a binding whose script never loaded, so the
vanilla path is live again after the restore.

**The dispatch is guarded too.** `loadContactDetail(id)` was a bare call, so a
missing registration would be a `ReferenceError` and a blank panel.
`loadContactDetailOrSayWhyNot` says it is a build fault, on the Account
precedent.

### C5, landed

The 409 sentence comes from the shell's own renderer through the seam, with the
plain sentence kept as the fallback. **A surface wording its own drops the
reload control**, so the person is told to reload and given no way to. Proven
live: the stale write renders the shell's HTML *and its button*.

### The door

**Open**, by the Account preserve ruling's precedent, because the measurement is
the same: no ownership read anywhere on this surface, and the shell sweep
touches only two other views. Added in the swap commit because the seam fails
closed.

---

## 2. The walk: 35/35, residue 0

`scripts/round6/walk-contact.mjs`. Every editor kind, the batched save, the
Qualify workflow end to end, the link round trip, and the return view both ways.

### The Qualify workflow, in detail

| check | result |
|---|---|
| a blocked qualify tints the rows the server named | `address, city, industry, jobRole, summary` |
| **C2: the INDUSTRY row is tinted** | **yes** - the gate says `industry_id`, the row is `industry`, and the vanilla never landed it |
| `parent_record_id` tints the Account CARD, not a row | yes |
| nothing said about an unplaceable blocker | correct |
| the record did NOT move | `Unqualified` |
| resolving Industry clears ITS tint and leaves the others | 5 → 4 |
| **resolving did not qualify as a side effect** | `Unqualified` |
| qualifying moves the record and lands on contacts | `Qualified` |

### THE WALK FOUND FOUR DEFECTS, AND THEY ARE ONE FACT

`root.render()` **re-renders** the component instead of mounting a new one, so
every mount-shaped assumption stops holding on a repeat navigation.

1. **`is-loading` never cleared.** `detailLoaded` sat in an effect keyed on
   `[settled]`, which does not change when a cached query is already settled.
   The view stayed at `class="wrap is-loading"` **with the panel fully rendered
   underneath it, permanently.** Round 41 item K's own failure, through a
   memoised effect rather than an early return.
2. **The back button was GONE.** `createRoot` clears its container, so the
   static `#btn-back-contact-detail` was destroyed and app.js's load-time
   listener was left bound to nothing. Both migrated views before this one
   already reproduce their back button - **app.js:5258 still binds a dead
   listener to the Account one** - and this now does the same.
3. **The record went stale.** `useQuery` saw no new observer, so it served the
   cached row: after a successful qualify the next visit still read
   `Unqualified` and Back went to leads. `main.tsx` passes a `navToken` now.
4. **The host held its own stale copy.** `useState(contact)` seeds once and
   ignores every later prop, so the refetch corrected the view and not the host
   - and **the stale reader was the one deciding where Back went.**

**Each was hidden behind the one before it.** Verification 18: a calibration
that does not move the number has failed to run rather than passed.

### And a fifth, in the lookup shipped in Phase 1

The industry row rendered a **raw UUID** before `/api/industries` answered,
because A10's fallback - an unrecognised id shows as itself - also fires when
the list is simply not loaded. Those are different states and only one is A10's,
so the fallback now applies **only once there is a list**.

### Five probe faults, corrected

A document-wide `[data-key]` count that read 19 because the hidden Reference
markup carries rows too; a wait satisfied by the pre-fetch state; a fixture that
could not be created sparse; a `page.type` into a focus-trapped textarea; and a
`catch` added so a throw stops discarding every check before it.

---

## 3. The visual comparison: 19/19

`scripts/round6/visual-contact.mjs`, three widths, on exercised states.

**It asserts its two captures are of DIFFERENT implementations before comparing
them** - Round 5's reconciliation of Round 2, where identical geometry to the
pixel turned out to be one tree captured twice. The vanilla is reached by the
**load-order revert at runtime**, which is what restoring the tag does.

| width | React first row | vanilla first row |
|---|---|---|
| 1240 | 876px | 314px |
| 1920 | 1556px | 314px |
| 3440 | 3076px | 314px |

**Both render 15 rows, neither overflows, both open editors when exercised.**

**And then the screenshot, which is what found the real thing.** The vanilla is
three titled cards in a responsive grid with a status tag, an eyebrow, notes and
five actions. The React surface is one flat column stretching to 3076px, with
unstyled section titles and none of the above. **Every programmatic check
passed on both.**

The layout divergence is not fixed and not deliberate: it is downstream of the
scope gap, because two of the missing behaviours are the sections the cards are
made of. Phase 2b takes both together.

---

## 4. The ledgers

**Coupling, both ways** - `scripts/tests/contact-coupling.test.mjs`:

| direction | assertion |
|---|---|
| what reads the vanilla | 6 entries, each disposed, including the one coupled test as the retirement precondition |
| what the React surface reaches back for | exactly seven seam names, asserted |
| window | read directly **nowhere** |
| the vanilla's lexical state | all sixteen names asserted absent |
| strings | eleven prose dispositions |

**Duplicate ids** re-run on the swapped state: 3/3, with the Contact entries
updated from *"Phase 2 must register whole-view, or rename"* to the confirmed
fact.

---

## 5. Calibration

**5/5 detected**, reverted green, four files byte-identical. Each of the four
walk-found defects plus the lookup boundary, reinstated and caught.

`contact-view.test.tsx` is what makes them evidence: it renders the way
`main.tsx` does - one root, re-rendered per navigation - which nothing in jsdom
had done before, and which is the only reason these were invisible.

---

## Surprises

**Two fifths of a surface was missing and four separate instruments said it was
complete.** They were not four measures; they were one question - *are the rows
right?* - asked four ways. Verification 33's own clause about a set assembled
from one worry.

**The walk's four defects were one defect.** Every mount-shaped assumption in a
view registered through `main.tsx` is wrong on a repeat navigation, and the
other two migrated views share the pattern - `AccountView` and `ApprovalView`
both key `detailLoaded` on `[settled]` and both serve cached data on a
re-navigation. **Not measured on those two, so it is a finding rather than a
claim**, and it is on the list.

**The one-line revert did what it exists for.** It has been described in three
round reports and this is the first time it has been used in anger.

---

## Findings

| # | finding | state |
|---|---|---|
| S1 | 524 of 1,327 vanilla lines never migrated | **swap held back**, Phase 2b |
| S2 | React layout is one flat column against three cards | **open**, downstream of S1 |
| S3 | `detailLoaded` / stale query on repeat navigation | **fixed here**, and the same pattern is unmeasured in Account and Approval |
| S4 | the back button destroyed by `createRoot` | **fixed here** |
| S5 | the host held a seeded record | **fixed here** |
| S6 | A10 fired on an unloaded option list | **fixed here** |
| S7 | `email` and `mobile` cannot be emptied - the route validates format on `''` | **open**, found staging the walk fixture |
| KC1 | `key-contacts` GET route does not exist | **carried** from Phase 1 |

---

## Gate

**All 21 stages passed** on `ddde7f7`, and again on the commit this report lands
in, clean.

Pure 465/465, database 94/94, react 545/545, all 0 fail, typecheck clean, and 14
HTTP probes. Every figure parsed from the run rather than typed.

**And a green gate is emphatically not a green surface here.** Every stage
passed on the swapped tree too, with two fifths of the surface missing. Nothing
in this gate looks at what a screen HAS - it checks that what is there behaves -
and the gap was found by a screenshot and a line count.

**Not pushed. Phase 3 follows on sign-off, and the swap should not be signed off
until the five behaviours land.**
