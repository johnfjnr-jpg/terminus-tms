# Round 8 Phase 2: the retirements

**Precondition:** Phase 1 committed at `b748a8e`, gate green.

**NO VANILLA SURFACE FILE REMAINS.** `app.js` is 8,037 lines, down from 8,990.

---

## The two-claims verifier, and its third clause

`scripts/round8/retired.mjs`. A retirement is two claims and the second almost
never gets an assertion (Verification 7):

| claim | how |
|---|---|
| 1. the file is gone | `existsSync` |
| 2a. nothing in CODE names it | every `.js/.mjs/.ts/.tsx/.css/.html`, **comments stripped** (Verification 39) - prose naming a retired file is a record, not a dependency |
| **2b. no SCRIPT TAG names it, live or commented** | **new**, and it is Phase 0's finding |

**Clause 2b exists because the estate had already written the rule and then
broken it.** From `index.html`, about the Reference tab:

> *A commented tag naming a deleted file is worse than none: it reads as an
> escape route somebody might reach for.*

Round 7's close deleted `contact-detail.js` and left its commented tag. A
revert instruction pointing at nothing is a coupling, not a comment.

**Both files now read RETIRED on all three claims.**

---

## 1. `test-bed-detail.js` - 3,282 lines

**Sized at 10 failing tests, per Phase 0, not the brief's stale 4.**

| disposition | tests |
|---|---|
| **RETIRED with the file** (evidence about it) | `test-bed-accounting` (5), `save-payload-declared` (1) |
| **RETIRED**, exemption dropped | the `tb-unit-field` hook exemption |
| **HALVED** | the PATCH-wrapper precondition: `tbPatch` retires, `addContactNote` stays |
| **RE-POINTED**, because the property outlives the file | the cost-key agreement, now React's `COST_INPUT_KEYS` against the same route schema; the "Terminus Lead" rename, now the React descriptors |

**The re-points are the ones worth naming.** Both assert *one contract, one
caller* - a preview and a save must send the same keys, and the Test Bed keeps
the Opportunity's word for its lead. Neither property changed; only where the
caller lives.

---

## 2. `contact-detail.js`'s retirement, completed

**The tag block is removed outright**, and so is the Test Bed's, replaced by a
comment saying what the revert now is: `git show <the retirement commit>`.

**`live-form`'s two tag inversions retired with their subjects**, including the
one Phase 0 found reading backwards. Its message said *"the vanilla Contact tag
is GONE, so the one-line revert has nothing to restore"* while **requiring the
tag's presence** - correct when written, and by Round 8 an assertion demanding
a pointer to nothing.

**And the dead half of the back button went with it.** `app.js:414` read
`window.contactReturnView` **and** the vanilla's lexical `cdReturnView` as a
fallback. With the file deleted that binding can never exist; the branch was
permanently dead.

---

## THE ONE DEPARTURE FROM INSTRUCTION

**The brief says `setContactReturnView` retires with `contact-detail.js`. It
does not, and the measurement is why.**

Removing it fails two `ContactView` tests. It **replaced** the lexical read
rather than depending on it: the React view owns the answer and pushes it
through the seam, which is the whole point of the C1 pattern. It outlives the
file it was built to work around.

**What did retire is the vanilla FALLBACK beside it**, above. The seam member
stays; its predecessor is gone.

---

## 3. The dead shell code - 33 names, 953 lines

Deleted per Phase 0's per-name evidence. **Bottom-up by line range**, because
deleting top-down shifts every later range and silently cuts the wrong code.

**Reading the result needed the constant read past**, exactly as in Phase 0:
every per-name deletion there failed one test, always Round 7's accounting
bookkeeping, so the raw output read as *nothing is dead*. Classified by
failures other than that one, **31 were dead and 2 carried couplings**.

**Landing all 33 broke exactly the three Phase 0 predicted:**

| broke | disposition |
|---|---|
| the `tb-tab-current-dot` hook exemption | **RETIRED** - `markTbCurrentStageTab` was its sole querier |
| *THE OLD PATH REFUSES rather than going quiet* | **RETIRED** - the function it guarded is deleted, so there is no path left to refuse. It did its job and caught nothing further |
| *the read-only class is applied from ONE value* | **RE-POINTED** - below |

**Nothing else broke.** 953 lines, and the only failures were the three whose
subjects went with them.

---

## The re-pointed toggle assertion - Phase 0's F1 closed

It required **exactly two** `is-not-mine` toggles in `app.js`, one per doored
view. That was right when both views loaded there, and had become **a detector
requiring dead code to remain**: Round 7's swap left the Test Bed's sweep inside
a function whose first statement throws, so one of the two it counted was
unreachable.

**The dead code is gone, so the count is ONE** - the Opportunity's, the only
view `app.js` still loads. The Test Bed's toggle is asserted where it lives, in
`TestBedView.tsx`.

**And the property moved with the door.** Since Phase 1 the class decides
nothing. What this still asserts is that the class has **one writer per view,
driven by one answer** - because two writers would dim a record the door lets
you edit, or the reverse. The `app.js` toggle must read `canEditFields`; the
React one must read the shared `notMine`.

---

## 4. The ledgers, and the rename list

**Both coupling ledgers split.** Direction A - every file that reads the vanilla
- **retired with it**: the file is gone, so the claim is vacuous, and *a ledger
that can only pass is not a ledger*. Direction B survives as
`seam-ledger.test.mjs`, because what the React tree reaches back for is not
about either file.

**Five one-round harnesses retired** whose subject was a deleted file, and
`enumerate-retirement.mjs` **lost its default target**, which named one - the
same fault as the commented tag, in a tool that outlives both retirements. It
now requires the caller to name what to size.

**The rename list stays empty, and it is now ASSERTED.** Phase 0 measured it
empty; a deletion can expose a name too, so `seam-ledger` asserts that no
`app.js` top-level name collides with a bundle global. Round 7's defect -
`async function loadTestBedDetail` overwriting the React registration because
`app.js` loads second - cannot return silently.

---

## 5. Calibration - 4/4

`scripts/round8/inject-phase-2.mjs`, hardened harness. **Reverted run GREEN,
all three files byte-identical.**

| injection | verdict |
|---|---|
| a SECOND toggle appears in `app.js` | DETECTED |
| the live toggle stops reading the door's own answer | DETECTED |
| the React toggle stops reading the shared derivation | DETECTED |
| **a commented tag naming a deleted file comes back** | DETECTED |

### The final reverted run went RED with every file byte-identical

**Twice**, and both times the harness was the cause.

**A literal `<script src="/test-bed-detail.js">` in the harness satisfied the
verifier's own claim 2b**, and then a *comment describing* one did the same.
Verification 39 exactly: a file that contains the string a scan looks for
satisfies that scan.

**Two fixes, and neither is an exemption**, because an exemption list rots and
the check is worth more absolute:

1. **The verifier anchors claim 2b at a LINE START.** A real tag - live or
   commented out - begins its line; a mention inside a `//` comment does not.
   Claim 2b reads the raw file on purpose, so the discrimination has to come
   from position rather than from stripping. **Calibrated both ways**: prose
   about a tag passes, a real appended tag fails, `index.html` restored
   byte-identical.
2. **The harness names neither retired file.** It assembles both from parts, so
   nothing in the repository contains the strings except history.

**That final pass is the only thing that caught either.** Every injection had
already been detected and every file compared byte-identical.

---

## What this does NOT establish

**Nothing ran in a browser.** 953 lines are dead *to the suite*, which does not
open the app. Names reached only through inline `onclick` in `index.html` would
not fail a test - the risk is small because that markup lives inside containers
`createRoot` clears, but it is stated rather than assumed. **Phase 3's live walk
is what would find one.**

**The Opportunity's door is still asserted by source, not behaviour** - carried
from Phase 1, and Phase 3 owes it.

---

## Gate

**All 21 stages passed.** Pure **474/474**, database 94/94, react 915/915, all 0
fail, typecheck clean, 14 HTTP probes.

The pure suite fell by 25 (499 to 474): retired detectors, not lost coverage -
each named above with its disposition.

**Not pushed. Phase 3 follows on sign-off.**
