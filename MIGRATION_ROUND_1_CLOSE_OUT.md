# Migration Round 1: close-out

**2026-09-05.** Five phases, all signed off. Gate **19/19**. Nothing pushed:
the round closes on John's word, and the push happens then.

---

## The exit gate for Round 2, answered

The brief names three conditions, "confirmed by John, not inferred from the
work feeling substantial". The evidence for each is below, with what it does
NOT cover stated beside it.

### 1. The twelve-point walk, and the rehearsed revert

**The walk. 23 of 23 checks pass** against a real fixture Opportunity through
the real server, on the migrated state. Points covered live:

| point | covered live by |
|---|---|
| 2 defaults render as value plus provenance | a system default rendering `0 (system default, set 2026-08-29)` and its note |
| 3 the staleness sentence | `priced at revision N` present, and the moved half asserted absent BEFORE the stub and present after |
| 4 `detailLoaded` on every exit path | success AND failure, with the counter calibrated 1 to 2 |
| 5 error state | the server's own sentence in the slot, the five blocks absent, the way back surviving |
| 6 bridge honesty states | one of four live: stated absence |
| 7 stated absence | the sentence renders, not an empty block |
| 9 version absent / present | present, with the approve sentence and its provenance |
| 11 escaping | markup on a version reason renders as literal text, `window.__pwned` false, zero `<img>` |
| 12 back button | present, correct text, and it survives an error |

**Two points the sandbox cannot reach and why.** Points **1** (nothing computed
client-side, asserted against a bridge's own figures) and **10** (opening and
closing FRAME the bridge, with the rule above the closing row) both require a
bridge, and a bridge requires an APPROVED prior version. Producing one through
the browser means driving the whole transition-request workflow, which is a
different feature's test.

**Both are covered in the Phase 3 fixture suite**, against page objects produced
by the real `buildApprovalPage`. Three of the four honesty states are covered
there too.

**The revert, rehearsed on a branch and then discarded.** The vanilla view
renders in full against the real server: five blocks filled, back button,
`detailLoaded` fired, **zero React markers, and the bundle never requested**.
The tree was verified **byte-identical** to the pre-rehearsal state afterwards
by hashing every tracked file.

**AND THE REHEARSAL FOUND THE PROCEDURE WAS ONE LINE SHORT.** The gate goes red,
1 of 19, on `commercials-wiring.test.mjs`'s assertion *"the vanilla approval
view is unloaded"* - which is that assertion **doing exactly its job**, because
a revert is a live tag on that file on purpose. It must not be softened, so the
revert is **two edits in one commit**. Recorded in the brief.

**No gate stage exists only for the React tree.** Both React stages - the suite
and the bundle-freshness check - still PASS on the reverted state, which is
correct rather than a hole: the React source is still in the repository and
still builds, it is simply not served.

### 2. The field-row component, seven behaviours, contract-derived tests

**49 tests, nine injections, every one fired.** Built from
`MIGRATION_FIELD_ROW_CONTRACT.md` with the five vanilla implementations
unopened.

Each behaviour carries the negative that fails when it is absent rather than
merely present-looking: type-and-type-back reads clean (1); a refused door
refuses Enter, Space **and** a seed character (2); open and close leaves the
same two nodes, asserted by identity (3); the seed keystroke **lands in the
input** (4); discard is **not** a close (5); a lone row produces no bar (6); a
read-only row has neither a tab stop nor an input to disable (7).

**The eleven findings are the first-contact checklist.** Appended to the
contract as a dated addendum: the position taken and the reasoning for each,
revisitable when Round 2's first row-bearing surface consumes the component.
Two changed the design - `orig` is never stored, and the door fails **closed**.

**What this does NOT establish:** the component has no production consumer, by
ruling. Surviving first contact is the real proof and it has not happened.

### 3. The re-derivation discipline

**Held.** Every test written this round was derived from a contract document or
from the brief's behaviour lists:

- the approval view's thirteen shapes, from the Phase 0 enumeration and the
  brief's twelve points, with fixtures produced by the real
  `buildApprovalPage`;
- the shell test, from points 4 and 5;
- the field-row suite, from the contract document with the vanilla unopened.

**The one re-pointed assertion is the recorded template for the remaining 105.**
`commercials-wiring.test.mjs`'s `ds-row` block. What makes it a template is not
that it was re-pointed but **what re-pointing it exposed**: the original premise
was wrong. The approval page was never why the rule stayed - `app.js` has five
uses, `opportunity-deal.js` three, `index.html` two, and the file being unloaded
had one.

So the template has three parts, and the second is the one that will be skipped:

1. **Re-point off the dead file**, or the assertion goes on passing by reading
   code the browser never fetches.
2. **Measure the premise while you are there.** The sentence explaining why an
   assertion exists is a claim, and it was written when the screen looked
   different.
3. **Assert both sides individually**, not "some consumer exists". When the last
   vanilla consumer goes, the test fails, and **that failure is the instruction
   to delete it** rather than a defect.

---

## What held

- **The seam.** One module reads `window.*`; no component reaches for it. It
  absorbed the field-row's ownership door in Phase 4 without a shape change.
- **The revert story.** One script tag through four phases, and the vanilla file
  never moved. The rehearsal cost half an hour and found a real gap.
- **Pixel parity.** The stylesheet was not touched. One departure, reported
  rather than absorbed, and required by the brief rather than chosen.
- **Determinism.** Three builds including one from a deleted `dist` produced the
  same sha256, which is what lets the freshness stage exist at all.
- **The calibration habit.** Nine injections in Phase 3, nine in Phase 4, three
  directions on the session pre-stage, both directions on the dist stage and the
  click-time guard. **Everything that was calibrated fired.**

## What surprised, across the round

**React destroys the container's static markup, and Phase 1 hid it.** The probe
read `innerText`, found its placeholder, and reported a clean mount. A
placeholder is expected to look bare, so "everything else is gone" and "it
worked" produced the same reading. Now `CLAUDE.md` Verification 7.

**Two calibration harnesses destroyed the work they were calibrating, in
consecutive phases, by unrelated mechanisms.** `git checkout` reverts to the last
COMMIT; zsh does not word-split an unquoted variable. Full-path keying was
followed the second time and was not the problem. **Neither verified its own
snapshot or its own restore.** Both times the final "reverted" pass caught it.
Now `CLAUDE.md` Verification 44.

**Three bridge branches cannot fire, measured rather than argued.** `reconciles`
can only be false if telescoping fails, because the tolerance IS the error bound.
810 payload pairs: 273 rounding lines, zero non-reconciliations.

**My own comment satisfied my own scan within the minute**, and fixing it
revealed the comment stripper could not read `.ts` or `.tsx` at all - so every
Verification 39 scan was structurally blind to the React tree.

**The session pre-stage nearly shipped unable to detect the thing it exists to
detect.** Its first version asked `/api/config`, which needs no auth, and PASSED
against a deliberately corrupted token. Caught by calibrating, not by reading.

**Working from a contract with the source closed made it SHARPER.** Two
behaviours stated as negatives forced structural decisions that would have read
as incidental notes with the vanilla open. Now `CLAUDE.md` Verification 47.

**A green suite on its first run is the tell.** 49 tests, no red-green cycle.
That is the signature of tests written to agree with the component, and the
injections are what turned it into evidence.

---

## Open items carried forward

Named, scoped, and none of them fixed this round. Build discipline 10.

### 1. The bridge tolerance cannot fail

`reconciles` is false only when telescoping fails, and telescoping cannot fail
on today's code: every priced key is claimed by a step (23 priced, 30 claimed,
difference empty). Round 38 set that tolerance so the reconciliation COULD fail;
it still cannot.

The branches are correct fail-safes for a future change and should stay. **What
the tolerance means is a pricing decision, not a migration one**, which is why
it is here rather than in a commit.

### 2. Four endpoint fields have no reader

`ask.staleBasisWarning`, `ask.ageingBasisNote`, `ask.unpricedWarning`, and
top-level `frozenTerms`. The vanilla view did not render them either, so this is
not a regression.

Two are sharper than the others. **`frozenTerms` carries a comment in
`src/lib/approval-page.js` reading "Verification 22: ... THIS IS WHAT READS
IT."** There is no reader. And **`staleBasisWarning`'s comment says it was
"raised to block 1 because it changes what the headline margin MEANS"** - it is
not in block 1 and it is nowhere.

Rendering the stale-basis warning needs an acknowledgement control to exist,
because the sentence says approval "requires explicit acknowledgement". That is
a feature, not a render.

### 3. `window.api` is never assigned

`api` is an implicit global from a classic script: `app.js` declares it at top
level, and there is no build step and no `type="module"`, so it lands on
`window` without anyone writing `window.api =`. Three vanilla modules already
depend on that.

It works today and **breaks silently at runtime, not loudly at build, the day
`app.js` becomes a module** - which is where this migration ends. Queued for the
`app.js` round. Recorded at the seam, which is the one place it will need
fixing.

### 4. Smaller, and recorded where they live

- **`dist` is committed**, so it is a second reader of the React source. The
  freshness stage covers staleness and the server's startup guard covers
  absence. No action pending; named so it is not rediscovered.
- **The `CURRENT_STATE.md` staleness test watches `supabase/migrations`,
  `supabase/seeds` and `src/routes` only.** This round added an entire frontend
  workspace and the test reads "not stale", correctly by its own definition and
  blind to the round. Regenerated anyway.

---

## Gate and reconciliation

```
MERGE GATE  19 stages
  PASS  session precondition
  PASS  pure suite                 440/440 pass, 0 fail
  PASS  database suite              92/92 pass, 0 fail
  PASS  react suite                 86/86 pass, 0 fail
  PASS  react bundle freshness
  PASS  14 HTTP probes
All 19 stages passed.
```

**`CURRENT_STATE.md` staleness check, run and stated.** The recorded SHA
`aca2df9` **is** an ancestor of HEAD, and **no watched configuration source
changed since it**. The file was therefore not stale by its own test.
Regenerated anyway, because the rule is that a round is not complete until it is.

**The diff reconciles against this round's phases, every line:**

| what moved | accounted for by |
|---|---|
| generation stamp and commit | mechanical |
| tag distances 138 to 147, 109 to 118 | **+9**, the nine commits since the last generation. `aca2df9` sits two behind `origin/main`, so seven are this round's and two landed with the Round 0 push |
| soft-deleted revisions 30,604 to 31,924 | probe fixtures created and torn down in Phases 1, 2 and 5 |
| **live counts: 113, unchanged** | **the residue check, restated by the generator** |
| configuration | **nothing changed.** No migration, no seed, no route |

**Live counts unchanged is the same claim the residue check makes**, arrived at
by a different instrument: opportunities, contacts, accounts and test beds all
clean after the walk.

---

## Standing at the close

Not pushed. **Five sign-offs, each with a matching commit and none missing**,
counted rather than assumed (build discipline 7):

| signed off | commits |
|---|---|
| Phase 0, investigation | `02738a5` |
| Phase 1, the Vite shell | `97b8b87` |
| Phases 2 and 3, one session by ruling | `28887fc`, `72946fe` |
| Phase 4, the field row | `32a1477` |
| Phase 5, close-out | `164f523`, `6ebba00`, and this commit |

**Eight commits on `main` ahead of origin.** A first draft of this report said
nine, hand-typed. Verification 20's addendum caught it: any number describing a
run is emitted by the run, and `git rev-list --count` is the run.
`frontend/opportunity-approval.js` is in tree and unloaded. The field-row
component ships unconsumed.

**Round 2 does not start until the exit gate above is passed on John's word.**
