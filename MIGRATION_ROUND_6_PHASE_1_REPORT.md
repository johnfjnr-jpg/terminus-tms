# Migration Round 6, Phase 1: the live half, then Contact behind the line

Session of 2026-09-07. Nothing registered, no `app.js` change, no swap. The
vanilla Contact view is still the live one.

---

## Nothing is unfinished

Every item landed. Two things are recorded as **not exercised** rather than
passed, and both are in the checklist where a reader will look for them: the
ownership door, because this surface has none, and everything visual, because
nothing has been rendered in a browser.

---

## 1. The gate, and the deferred live half

**All 21 stages passed on `3b4fb7f`**, every stage RUN - 452 pure, 92 database,
480 react, 14 HTTP probes. The Phase 0 blocker is gone.

### 1a. The close-date walk: 18/18

`scripts/round6/walk-close-date.mjs`, live against the dev server.

| | measured |
|---|---|
| a fresh opportunity | holds no forecast close date |
| a FIRST recording | no dialogue, **the server holds it**, not counted as a move, note written |
| a MOVE | dialogue opens, **nothing written** before a reason is given |
| an EMPTY reason | refused, dialogue stays open, says why |
| confirmed | **server holds the new date**, move counted, reason written as prose |

That is the defect Phase R found, closed and proven live rather than in jsdom.

### FIVE PROBE FAULTS, and three are worth keeping

**`page.type` writes NOTHING to an `input[type=date]`.** Verification 6's write
clause says to drive a controlled input with real keystrokes, because a
synthetic write is deduped by React's value tracker. Measured, **the two
remedies swap round for a date input**: plain character events never reach its
segments, and the native setter lands because a freshly opened editor has
nothing in the tracker to dedupe against.

**`offsetParent` is `null` for a `position: fixed` element, by specification.**
The reason dialogue reported shut while it was open on screen with its heading
rendered. **The same expression sat in the WAIT condition**, where it is always
true, so the wait resolved instantly and every assertion after it measured the
state before the write. Verification 7's counterfactual, and Verification 4's
clause from the other side: **the computed property is the visibility test.**

**The api client returns a `{status, ok, data}` wrapper**, and the probe read
through it as if it were the record. So the server appeared to hold nothing
while the POST returned **200**. Verification 47's response-fixture clause.

The other two: a reason box driven by `page.type` that the dialogue's focus trap
never let it reach, and a 404 counted as a page error.

### 1b. The census's second instrument: 11/11

On a record that had **initialised, computed and been exercised**, per
Verification 49.

The two instruments agree on all 15 fields and **disagree on exactly one editor
kind - and the DOM is right.** `summary` is a **TEXTAREA**. The Phase 0 report
recorded it as text by assuming the row renderer; it is static markup, which the
source instrument cannot see at all.

**So the census is FOUR editor kinds, not three:** 11 text, 2 select, 1 lookup,
1 textarea. The source instrument now says `static` for the two fields it cannot
answer for, rather than guessing.

### FINDING KC1, pre-existing and queued

`ReferenceHost` GETs `/api/opportunities/:id/key-contacts` on every load and
**no such GET route exists** - only POST, DELETE and the stance POST. The Key
Customer Contacts card never receives anything from the server.

Round 5's, not this round's, so it goes on the list under rule 10. The walk now
asserts the 404 is **exactly that one path and no wider**, so it cannot be
forgotten or quietly spread.

---

## 2. The lookup editor: A8 to A11, and the contract first

**The addendum was written and committed before any code**, from the census with
neither implementation open.

The gap is one field. `options?: string[]` makes a select's value and label the
same string - true of every select the migration had met, because their stored
value **is** the words on screen. **Industry is a foreign key.**

| ruling | what it settles |
|---|---|
| **A8** | `options` accepts `{id, name}` pairs; a bare string is the degenerate case `{id: s, name: s}` |
| **A9** | the display half resolves through the **same list** the edit half offers |
| **A10** | an unrecognised stored id **keeps its place**, appended so it can never displace a real choice |
| **A11** | the surface fetches its own options; `industriesCache` is a `let` no bundle can read |

**RED FIRST: 12 of 14 failed.** A8.2 and A11 passed correctly - the string form
and the seed rule were already right, and the generalisation must not disturb
them.

### And the row has TWO display paths, which I nearly shipped half-fixed

The standalone path renders `field.value`; the connected path renders
`rows.valueOf(name)`, the live draft. **Every A9 test passed against the first
while the second - the one every real surface uses - would have put a raw UUID
on the screen.**

Verification 20 at the smallest possible scale: two readers of one value inside
one component, with the tests reaching only one. Found by asking what the
connected row does, not by a failing test, so the two tests covering it were
written red on purpose.

---

## 3. C2, resolved through the server's own rule

### The arithmetic, stated exactly

The 14 fields gating Qualified break down as **12 that match a row by name, 1
that is the Account card, and 1 that reaches its row only through a
declaration.** The Phase 0 report said "13 land, 1 does not", counting the card
among the 13. The breakdown is now asserted so the three groups cannot drift
into each other.

The mapping is **declared**, not derived by stripping `_id`: a suffix rule is a
guess about names the database chooses. And `unplaceable()` surfaces any blocker
the screen could not place **on the screen itself**, so the defect cannot recur
silently.

### One definition, two readers

`RECORD_COLUMN_FIELDS` and the emptiness rule **moved to `src/lib`**. They lived
in a route module that imports the database client, so no browser and no bundle
could read them - which is why the vanilla carried a copy commented as *"the
exact same rule"*, the phrase `CLAUDE.md` names as marking an unproven equality.

They agreed when measured. They are one definition now, so agreement is not
something anybody has to keep checking.

**AND `export { X } from '...'` CREATES NO LOCAL BINDING.** The move landed
first as a bare re-export, and the route's own uses of the set threw a
`ReferenceError`. **The gates suite caught it** - three failures, in exactly the
population that exercises it - and the invariant now asserts both the import and
the re-export.

**The hand-copied gate list is a second reader**, so its agreement with the live
rows is asserted in the database suite where the rows are, calibrated in both
directions so an empty copy cannot agree with an empty read.

---

## 4. The surface

15 rows from the census in four editor kinds. The name is an **ordinary row**
rather than static markup, the same departure the Reference tab took.

**The save**: only-dirty, `industry` lifted to a column, **one note per save
session** naming the industry by NAME rather than by id, and the revision
handshake read **off the record** rather than a shell global - the vanilla keeps
it in a `let` no bundle could read, and it does not need to, because it arrives
as `latest_revision_number`. One fewer coupling rather than one more.

**The Qualify workflow** per its enumeration: a 422 tints, resolution clears
against the reloaded record and **never by re-attempting**, and a blocking list
belongs to its own record.

**`legalEntity` is ported as writable-and-unrendered.** A migration adds no
renders: giving it a row would be inventing a field the vanilla never had.

### 3a. C1 ruled, and the plan recorded

`app.js:306` binds the back button to `cdReturnView`, a `let` in
`contact-detail.js`. Classic scripts share one global lexical scope so app.js can
read it today; **a bundle cannot, and the binding is registered at load.**

**Ruled: the host owns the state now, and `app.js:306` is adapted in the SWAP
commit.** Doing the app.js half now would open a binding on a surface nobody can
see - the same reasoning that put the Reference tab's door in its swap commit
and not before. `returnViewFor` is built and tested against that plan.

### The link-account panel

On the Account parent-link precedent: a search, a result list, and a write that
lands **immediately** rather than joining the batched save.

**Two guards built from Round 4's finding rather than copied from the vanilla.**
The in-flight check is a **ref**, not state: `if (inFlight) return` against a
state variable cannot fire, because two clicks in one tick read the same stale
closure value. And **C6 is closed rather than reproduced** - the vanilla's dirty
path returns before setting its flag, so two rapid clicks while dirty both open
the discard dialogue.

Both are exercised against a **held promise**, so the second click happens while
the first is genuinely outstanding. Without that the guard is never reached and
the test asserts nothing.

---

## 5. Calibration

**18/18 detected**, across five families, verified-snapshot harness, reverted
run green, **seven files byte-identical**.

**The suite was green on its first run**, which is exactly the Verification 47
signature. The injections are what turn that into evidence.

**Three came back SILENT and all three were the matcher, not a missing
detector.** A test aborts on its FIRST failing assertion, so an `expect` string
taken from a later assertion never appears in the output. Test names are the
anchor. Each silence was explained rather than accepted, per Verification 51.

### The standing detectors

| detector | state |
|---|---|
| node stability | existing, covers the shared component across every editor kind |
| computed visibility | existing, `hidden-not-overridden.test.mjs` |
| **duplicate ids** | **new, and it found a defect this round introduced** |

---

## 6. THE DEFECT I INTRODUCED, found by the detector the brief asked for

**In item 1 I gave the React Reference bar `id="ref-save-all"`** so the reason
dialogue could return focus to it, matching the vanilla it replaces.

**Measured in the browser: two elements then carry that id.** The vanilla's
tab-action buttons live in `#opp-tab-actions`, **outside** the `#ref-vanilla`
block the swap hides. `getElementById` returns the first in document order, so
focus went to the vanilla button in a different container.

Renamed to `ref-react-save-all`, and the rule is now a test.

`scripts/tests/no-duplicate-ids.test.mjs` carries **a disposition per file**,
because the rule is not "never reuse an id" but **"never reuse one that will
still be in the document when yours is"**:

| file | disposition |
|---|---|
| `ApprovalView`, `AccountView` | **inside the mount container.** `register()` does `createRoot(getElementById('view-' + view))`, which clears it |
| `DealPanel`, `intake`, `panelParts`, `section36/4/5`, `VersionCard` | **LATENT.** The swap HIDES the vanilla block rather than clearing it, so both copies really are in the document - and nothing resolves those ids by `getElementById`. Architecture 8 exactly |
| `ContactHost`, `ContactPanel` | **Phase 2 must register whole-view, or rename.** The entry exists to force that decision |

**Calibrated by reinstating the real defect**: it fires and names the file and
the id. And the ledger has a rot guard, so an exemption that stops clashing
fails rather than sitting there waving through the next real one.

---

## Findings

| # | finding | state |
|---|---|---|
| KC1 | `ReferenceHost` GETs a `key-contacts` route that does not exist | **queued**, pre-existing from Round 5, asserted no-wider by the walk |
| - | the React Reference bar shared an id with the live vanilla button | **fixed**, mine, detector built and calibrated |
| - | two display paths in `FieldRow`, one unresolved | **fixed**, mine |
| - | `export { X } from` creates no local binding | **fixed**, mine, caught by the gates suite |
| C2 | the Industry row is never tinted when it blocks | **fixed** |
| C3 | the client duplicated the server's emptiness rule | **fixed**, one definition |
| C6 | the link panel's dirty path did not guard | **fixed** |
| C4 | `legalEntity` writable and rendered nowhere | **ported as-is**, recorded |
| C1 | `app.js:306` reads a lexical name | **ruled**, lands in the swap commit |
| C5 | Contact's 409 sentence is local where Reference uses the shell renderer | **carried**, see below |

**C5 is not closed.** The host still words its own 409. The Reference tab reads
`window.staleWriteHtml`, which carries a reload control the sentence alone does
not. Closing it means reaching the shell renderer through the seam, and that is
a swap-commit change for the same reason as C1.

---

## What this phase does NOT establish

- **Nothing has run in a browser.** Every Contact verdict is jsdom. Round 5
  recorded five defects that no assertion saw and a screenshot did.
- **The shell registry line is not written**, so nothing mounts.
- **The door is untested here** because this surface has none.
- **The Qualify workflow has not met a real 422**, only a stubbed one.

## Gate

**All 21 stages passed**, twice: once on `2d53510` with this report uncommitted,
and again on the closing tree, clean.

Pure 455/455, database 94/94, react 537/537, all 0 fail, typecheck clean, and
14 HTTP probes. Every figure parsed from the run rather than typed.

The database suite gained 2 and the react suite 57 across this phase.

**A green gate is not a green surface here**, and on this phase that is
stronger than usual: nothing has been rendered in a browser at all. The five
defects Round 5 found by opening a screenshot were invisible to every automated
stage, and this phase has not yet run the instrument that found them.

**Not pushed. Phase 2 not started.**
