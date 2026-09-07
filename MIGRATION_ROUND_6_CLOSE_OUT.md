# Migration Round 6 close-out: the retirement debt, then Contact

Closed 2026-09-07. Phases R, 0, 1, 2, 2b and 3, **35 commits through the close-out**, plus this file's own gate-recording
commits after it.

Counted, not typed - `git log --oneline | grep -c "Round 6"` - and stated as a
range rather than a number for the reason `CLAUDE.md` already records about
`CURRENT_STATE.md`: **a file cannot name the commit it is in.** Written as a
bare figure it was 29 (a range starting in the wrong place), corrected to 35,
and 36 by the time the gate was recorded. The chase is the tell that the shape
was wrong, not the number.

---

## What is NOT done, first

**`frontend/contact-detail.js` is not retired, and by policy it should not be.**
The one-round confidence window is *"a superseded file is deleted after the next
full round completes with no revert needed"*, and the swap landed **this** round.
It retires at Round 7's close.

**Sized by sandbox deletion, as the standing rule requires: FOUR failing tests**,
and all four are mechanical:

| test | disposition at Round 7's close |
|---|---|
| `class-rules` :: every declared state class is actually toggled | drop the `.field-editing` entry - its own comment says the failure IS the instruction |
| `surface-accounting` x 3 | the **map** retires with the file; `topLevelNames` is the reusable instrument and stays, re-pointed at Test Bed |

**`frontend/opportunity-reference.js` is gone and nothing regressed.** Re-checked
this phase: the file is absent, no live tag names it, and its eight remaining
mentions in the markup are prose.

---

## Against the brief's exit gate

**1. The retirement debt is zero.**

`opportunity-deal.js` (2,255), `deal-feedback.js` (36), the parity suite, the
coupling ledger and `probe-fact-census.mjs` are gone; `opportunity-reference.js`
(1,055) with five Round 5 instruments and its ledger. Both two-claims verified
with the repository's stripper, and every surviving mention disposed.

**No policy exceptions outstanding.** The one Round 5 recorded is discharged.

**2. Contact's census rows and the Qualify workflow pass live, and the checklist
has written verdicts.**

`walk-contact.mjs`, **50/50, residue 0**, on the closing tree. The 15 census
rows, all four editor kinds, the batched save with its one note, the 409 through
the shell's own renderer, the Qualify workflow end to end, the link round trip,
the return view both ways - and the five capabilities Phase 2 discovered
missing.

The fifth-contact checklist carries twelve verdicts, **two of them recorded as
NOT EXERCISED rather than passed**: positions 9 and 10, because this surface has
no ownership door to test.

**3. The estate ledger restates the remaining coupled counts with instruments,
and Test Bed's retirement precondition is sized by sandbox deletion.**

Below, and **four failing tests** for Test Bed - the hook exemption, the two
PATCH wrappers, the client/route key agreement, and the "Terminus Lead" rename.

---

## The round this will be remembered for

**A swap was taken, and reverted, because two fifths of a surface was missing and
four instruments said it was complete.**

The Contact fields were censused twice, with two instruments, reconciled,
checked against a twelve-position checklist and covered by an eighteen-injection
sweep. The swap then removed the notes history, the park form, unqualify, delete
and the account-details modal - **524 of 1,327 lines** - because not one of them
is a field.

**They were not four measures with a shared gap. They were one question - are
the rows right? - asked four ways.**

The remedy is `scripts/tests/surface-accounting.test.mjs`: map every top-level
name to a named capability, and treat an unmapped name as a finding. **It is
forty lines. What it cost to not have was a swap taken and reverted.** It is a
standing Phase 0 item now, and it found two capabilities beyond the five a
screenshot showed.

**And it counts `window.X = function`.** Phase 0's own inventory anchored on
keywords at line start and reported **61 names where there are 76** - fifteen
invisible, among them the unqualify, delete and account-modal entry points.

---

## The corrective note on Rounds 1 and 2's walk certifications

**Rounds 1 and 2 certified their surfaces as walked. Both shipped with defects a
walk cannot see, and this round measured them.**

`ApprovalView` (Round 1) and `AccountView` (Round 2) both keyed `detailLoaded`
on a settled flag and both served cached data on a second navigation. Driven
through the harness `main.tsx` actually uses - one root, re-rendered -
`detailLoaded` fired **once across two navigations** on each.

**A walk visits a record once.** So does every jsdom test that mounts fresh.
Neither instrument could have found this, and neither round was careless: the
shape was invisible to the method.

**The certifications are not withdrawn - they were true about what they
measured.** What is corrected is the inference: *"the surface was walked"* did
not mean *"the surface works on the second visit"*, and until this round nobody
had asked. Both are fixed, and `renavigation-family.test.tsx` is what stops it
recurring.

---

## What looking found that no assertion could

**The visual comparison, again.** Phase 2's screenshot is what revealed the
capability gap: 19 programmatic checks passed on a surface missing two fifths of
its behaviour, because every one measured rows, widths and overflow.

**And the layout divergence was closed by adopting the application's own
classes**, not by inventing any: `.pg-card`, `.pg-card-title` and `.ref-cards`
already existed. View height at 1920 fell from 1184 to 956; three cards across,
reflowing to two then one with no media query.

Three divergences remain and **all three are deliberate**, recorded at their
sites: the name is a `FieldRow` rather than an H1, the edit bar sits at the
bottom rather than Cancel/Save top-right, and the status tag sits on the eyebrow
line.

---

## The revert rehearsal

**The one-line restore, on a branch, walked: 10/10.** The vanilla runs, its
fields, notes, park, unqualify, delete, modal markup and link control are all
back, nothing is stuck loading, a field opens, and the back button works - which
it does because `app.js` asks the seam and falls back to the vanilla's own
lexical `cdReturnView`.

**Exactly ONE expected failure**, `live-form` :: *THE REACT CONTACT VIEW IS THE
LIVE ONE*. That is the swap's own detector, and a revert being visible to the
gate is the point of it.

**A finding from the rehearsal itself.** `git checkout main` carried the
uncommitted revert **back onto main**, because checkout keeps changes that do
not conflict. Round 14 lost work to that manoeuvre and Round 15 recovered from
it; this is the same hazard in the other direction. The tree was restored and is
byte-identical to `16f6074`. **A rehearsal commits on its branch, or stashes,
before checking out.**

---

## The estate ledger

**Loaded vanilla, from the live markup with comments stripped:**

| file | lines |
|---|---|
| `frontend/app.js` | 8,905 |
| `frontend/test-bed-detail.js` | 3,260 |
| **total still loaded** | **12,165** |

Down from 13,437 at Round 5's close: **Contact's 1,327 lines are unloaded.**

**In tree, unloaded:** `contact-detail.js` 1,327, due at Round 7's close under
the one-round window, sized at four failing tests.

**Deleted this round:** `opportunity-deal.js` 2,255, `deal-feedback.js` 36,
`opportunity-reference.js` 1,055, plus the parity suite, two coupling ledgers,
six Round 5 instruments and `probe-fact-census.mjs`.

**React:** the suite is 580 tests, up from 485 at Round 5's close.

**Coupling ledgers and detectors, with their instruments:**

| instrument | what it holds |
|---|---|
| `contact-coupling.test.mjs` | both directions, 6 entries disposed, 7 seam names asserted, 16 lexical names asserted absent, 11 prose dispositions |
| `surface-accounting.test.mjs` | 76 names to 11 capabilities, calibrated three ways |
| `no-duplicate-ids.test.mjs` | 9 files disposed, with a rot guard; **caught two real clashes** |
| `renavigation-family.test.tsx` | three registered views, driven as the shell drives them |
| `adopted-identity.test.mjs` | unchanged |

**Retirement preconditions, sized by sandbox deletion:**

| file | failing tests |
|---|---|
| `contact-detail.js` | **4** |
| `test-bed-detail.js` | **4** |

---

## Rules

**Five extensions, no new numbers.** Numbering byte-identical at 81.

- **Verification 51** gains the caveat that keeps it usable: **five silences in
  one round were the MATCHER**, not a missing detector. The tell is a silent
  verdict with a non-zero failure count.
- **Verification 47** gains the re-navigation clause: a harness reproduces how
  the code is **invoked**, not merely what it is given.
- **Architecture 8** gains ported sequencing: a guarantee resting on synchronous
  execution is not preserved by porting the calls in the same order.
- **Verification 49** gains the accounting: a census of fields is not a census
  of the surface, with an automatable remedy rule 33's general one does not
  give.
- **Verification 14** gains its commonest shape: an assertion inside
  `if (collection.length)` is a silent skip wearing a pass.

The fresh-assertion presumption was checked and is **already** Verification 47's
own clause - recorded as re-confirmed rather than duplicated.

---

## Carried items

| item | state |
|---|---|
| **KC1**: `ReferenceHost` GETs a `key-contacts` route that does not exist | open, Round 5's, asserted no-wider by the walk |
| **`Unqualified -> Parked`** is a configured gate rule the stage order forbids | open, server-side, affects the vanilla equally |
| **`marginPresentation` has two readers** that disagree about absence | open, Round 6 Phase R, Architecture 11 |
| **`email` and `mobile` cannot be emptied** - the route validates format on `''` | open, found staging a walk fixture |
| **two declaration gaps** in the shared libs, hidden by `require`'s `any` | open, named at the site |
| three unread endpoint fields | open, from Round 2 |
| the create-route address nulling | open, from Round 3 |
| the bridge tolerance, stated but not enforced as a refusal | open, from Round 1 |
| `contractorStaged` unreachable row | open, asserted unreachable |
| `window.api` never assigned | open, and it is the `app.js` round's problem |
| **`WRITABLE_NUMERIC_KEYS` dead import** | **CLOSED** - died with the deal form, as Round 3 predicted |

---

## Round 7 entry context

**12,165 lines still loaded, across two files.**

**Test Bed is the surface: `frontend/test-bed-detail.js`, 3,260 lines**, and it
is the **second real ownership door** - `app.js` sweeps `is-not-mine` onto
`view-test-bed-detail`, so positions 9 and 10 of the field-row checklist get
their second genuine exercise.

**THE ACCOUNTING INSTRUMENT IS MANDATORY IN ITS PHASE 0**, before any census of
fields. That is this round's whole lesson, and Test Bed is 2.5 times the size of
Contact.

**The shell inventory as it now stands**, for the `app.js` round after:

- **`let`/`const` at top level are LEXICAL** and no bundle can read them. The
  Contact surface added `industriesCache` to the measured list; `accountsCache`
  and `terminusStaffCache` were already on it.
- **`window.X = function` is a THIRD form** the keyword-anchored scan misses
  entirely, and it hid fifteen names on one file. Any inventory taken before
  this round is undercounted.
- **The C1-pattern seam items accumulate.** `setContactReturnView`,
  `staleWriteHtml`, `confirmDiscard`, `requestChangeReason` and
  `currentUserEmail` all exist because a surface needed something the shell held
  lexically or in DOM. Each is one accessor rather than one coupling, and the
  seam is now seven names wide.
- **`app.js` grew by 57 lines this round**, to 8,905: the guarded Contact
  loader, the door entry and the two-state back button.

---

## Gate

**All 21 stages passed** on `1c571d7`, the tree this close-out landed on, clean.

Pure 469/469, database 94/94, react 580/580, all 0 fail, typecheck clean, and 14
HTTP probes. Every figure parsed from the run rather than typed.

The pure suite grew from 452 to 469 and the react suite from 485 to 580 across
the round.

**And what a green gate still does not mean here, stated because this round is
the proof.** Every stage passed on the Phase 2 tree too - with two fifths of the
Contact surface missing. Nothing in this gate asks what a screen HAS; it asks
whether what is there behaves. The gap was found by a screenshot and a line
count, and the instrument that would have found it earlier is forty lines that
did not exist until Phase 2b.

Transcript: `.verify/verify-1203432715205583.txt`

**Not pushed. The round closes on John's word.**
