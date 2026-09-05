# Migration Round 3, Session D2c: the split

**Scope executed:** the split only. No swap, no adoption, no re-points beyond
what the split broke. The vanilla form is still the live Commercials surface and
is unchanged in what it does.

---

## 1. The split as landed

| file | before | after |
|---|---|---|
| `frontend/opportunity-deal.js` | 2797 | 2252 |
| `frontend/opportunity-deal-versions.js` | absent | 652 |
| `frontend/deal-feedback.js` | absent | 36 |

`index.html` carries one new module tag after the form's, and the form's own
init now hands the version file its dependencies rather than the version file
reaching for them:

```js
window.initOpportunityDealVersions?.({ opportunityId, seam: dealFormSeam })
```

**Fifteen functions moved**, and the file is not a pure move: it was rewritten
against the ruled seam. `opportunityId` became the `opportunityId` init
parameter, the wire-once flag became module state, and the two outward feeds
(`window.oppCurrentVersionRejection`, `window.oppRefreshVersionActions`) are now
published by the version file rather than the form.

The version file imports six modules. Five are the `/lib` modules it already
used; the sixth is section 3's finding.

---

## 2. The adapter

The vanilla form implements the ruled seam directly, so the version machinery
talks to the same interface the React panel will later present:

```js
const dealFormSeam = {
  async freezeCurrentState() {
    if (isDealFormDirty()) {
      const saved = await saveDeal()
      if (!saved) throw new Error('the pricing could not be saved')
    }
    return { payload: readPayload(), contractorMilestones: readContractorMilestones(), catalogRates }
  },
  hasUnsavedChanges: () => isDealFormDirty(),
  readContractorMilestones: () => readContractorMilestones(),
  populateForm: (payload) => populateForm(payload),
  recompute: () => { const p = readPayload(); recompute(); return p },
}
```

Five members, matching the ruling exactly. The exact-set test asserts the five.

---

## 3. Findings

### 3.1 `populateForm` reset `versionRange`, so the coupling ran both ways

D2 measured the boundary in one direction: what the version machinery reaches
into the form for. It does not run only that way. `populateForm` set
`versionRange = 5`, which is **the form reaching into version state**, and a
one-way census cannot see it. It now lives in the version file's init.

### 3.2 `clearDealFeedback` was the one `export function` in the file, and the
measurement regex never matched it

Every scan of the form file, in D2 and since, matched
`^(?:async function|function|const|let|var)\s+(\w+)`. `clearDealFeedback` is
declared `export function`, so **it was invisible to every census taken of that
file**, and the split carried it out silently. The browser found it, as
`clearDealFeedback is not defined`.

It is the only `export` in the file, and nothing imports the file as a module
(every test reference is a `readCode` source scan), so the keyword was
vestigial - which is exactly why it survived unnoticed.

**Where it went, and why not the two obvious homes.** The function clears
`#deal-feedback`, owned by the form, and `#deal-version-feedback`, owned by the
versions card. Both halves call it, so neither can own it without reaching
across the boundary. It is not in the ruled seam and is not a candidate for one,
and `src/lib` is shared with the server and DOM-free. It became
`frontend/deal-feedback.js`, one definition, imported by both. Two copies of a
two-element clear is Verification 20's shape exactly.

### 3.3 The reason box was already version-side

My own D2 report says the reason box "lives in the form's DOM". Measured, it is
inside the Versions card, after `#deal-version-list`. No markup relocation was
needed. The instruction's item 1 asked for a move that was already done.

### 3.4 The refusal must precede the save, and the freeze is the only payload source

`saveVersion` refuses a version whose contractor milestones do not reconcile,
and that refusal **must not write**. But `freezeCurrentState()` saves, and it is
the only thing that returns a payload. The reconciliation base therefore comes
from `recompute()`, which reads the screen without writing.

That forced a divergence to be fixed rather than shipped: the React adapter's
`recompute()` already returned the payload it read; the vanilla's returned the
calculated result. **Two adapters for one seam member, disagreeing about what
the member returns**, which the exact-set test cannot see because it checks
names. Both now return the payload.

### 3.5 One deliberate duplication

`escapeSheet` (three lines, pure) exists in both files, recorded in a comment at
both sites. `WRITABLE_NUMERIC_KEYS` remains a pre-existing dead import in the
form file, untouched by this session and reported rather than removed.

---

## 4. The version workflow, verified against the vanilla form

Puppeteer, real server, real fixture, signed in as the test user. **22 of 22.**

| what was verified |
|---|
| the vanilla exposes the seam, and exactly the five ruled members |
| the version file registered its init; both outward feeds are live and come from the new file |
| the version list renders; the reason box is reachable from its home |
| a version is taken from a **clean** form and **no deal revision is written** |
| a version taken from a **dirty** form writes a deal revision **first**, and the record holds the edited value |
| the version froze the **saved** value, not the screen, and the form reads clean afterwards |
| the latest draft issues |
| a restore onto a clean form runs without a prompt, and loads the version it targeted |
| a restore over a **dirty** form raises the discard prompt |
| **a refused save takes no version, and the version card says so** |
| no page errors attributable to the page |

**Teardown and residue.** The fixture is torn down through `scripts/fixtures.mjs`,
which enumerates from the database by owner rather than from a file the harness
wrote. The residue query was **calibrated before it was trusted**: it read 0,
then 2 with a fixture live, then 0 again. A zero from a query never shown
reaching one is not a measurement.

**A defect in the probe, not the product:** `tearDown()` is the probe's last
statement and is not in a `finally`, so the runs that threw earlier in this
session left their fixtures live. A later successful run swept them, because
teardown enumerates every live record the test user owns rather than only its
own. Recorded rather than fixed, because the probe is a scratch artefact.

---

## 5. The re-point delta

**Three assertion blocks broke, all of them source-shape, all for the same
reason: they read `frontend/opportunity-deal.js` for version-machinery content.**

| file | test | disposition |
|---|---|---|
| `scripts/tests/commercials-wiring.test.mjs` | FINDING 5: the note says what the code does | **re-pointed, and split across both files** |
| `scripts/tests/transition-requests.test.mjs` | V1/V2/V4: the next major comes from the record | re-pointed to the version file |
| `scripts/tests/transition-requests.test.mjs` | the issue control targets a draft NEWER than the last issue | re-pointed to the version file |

Each carries the three-part re-point comment: off the old file and why leaving it
would be wrong, the premise re-measured, and both sides asserted individually.

**FINDING 5 is the one that changed shape rather than address.** Its claim is
that the deal is saved before a version is taken. That is still true, but its two
halves now sit either side of the seam: the version file proves the freeze
precedes the POST, and the form file proves the freeze IS a save that refuses by
throwing. **No single file can carry the claim any more**, so the test reads two.

While re-pointing it, a live hazard in the original: it located `saveVersion`
with `indexOf` and sliced from there. With the function gone, `indexOf` returns
-1 and `slice(-1)` is the **last character of the file**, so every assertion
below would have matched against a one-character string. It failed loudly here
because the assertions are positive. **The same shape passes silently whenever
the anchor is absent and the assertion is negative**, so presence is now asserted
before slicing on both sides.

**The ledger.** Round 3 Phase 0's classification stands, with three of the
seventeen source-shape blocks now re-pointed:

| class | blocks | status |
|---|---|---|
| behaviour (jsdom) | 38 | untouched, still passing against vanilla |
| source-shape | 17 | **3 re-pointed by the split**, 14 not re-pointed |
| stylesheet liveness | 8 | not re-pointed |

**The cause is worth distinguishing:** these three were re-pointed by a FILE
SPLIT, not by the React swap. The swap has not happened and nothing is reading
dead code yet.

---

## 6. Calibration

### 6.1 The adapter injections

Verified-snapshot harness, keyed on the full path, restore verified byte for
byte, final reverted run. **The reverted run is green at 24/24 in 18.4s.**

| injection | probe | verdict |
|---|---|---|
| the save is dropped from the freeze | 19/24 | **DETECTED** by `THE DEAL WAS SAVED FIRST` |
| the refused save is swallowed | 22/24 | **DETECTED** by `A REFUSED SAVE TAKES NO VERSION` |
| the discard prompt is skipped | 13/28 | **DETECTED** by `RESTORE OVER A DIRTY FORM RAISES THE DISCARD PROMPT` |
| the order is reversed: the payload is read before the save | 24/24 | **NOT DETECTED** |

**The fourth is a real result and is reported as one.** Reading the payload
before the save rather than after is **undetectable because it is a no-op**:
`saveDeal()` does not mutate the form, so the payload read either side of it is
the same. The order claim that has teeth is *save before the version is POSTed*,
and that one IS detected: injection 1 breaks it.

### 6.2 The re-points

Same method, against the pure suite. **All five fired, and the suite reverts
green.**

| injection | fired |
|---|---|
| POSITIVE: `highestIssued` removed | yes |
| POSITIVE: the empty-state label removed | yes |
| POSITIVE: the freeze no longer goes through the seam | yes |
| **NEGATIVE: the forbidden draft derivation reintroduced** | **yes** |
| **NEGATIVE: the old empty label reintroduced** | **yes** |

The two negatives are the point of the exercise. A negative assertion pointed at
the wrong file passes forever.

---

## 7. Two faults in my own instruments, both found by the calibration

### 7.1 The probe could not reproduce itself

The workflow probe waited on **fixed delays**. It read 22/22 standalone, twice,
and 19/22 on the fifth consecutive run inside the harness. **Two unstable
readings that happen to agree are indistinguishable from two stable ones**, so
the first calibration's verdicts were worthless even where they were right.

Every delay is now a wait on real state with its counterfactual stated. Two
were wrong in ways the delay had hidden: the restore click took the **first**
restore button rather than the row it named, and the refusal case **inherited**
its dirty precondition from the block before it. It now establishes its own.

### 7.2 The harness scored a probe that never ran as a detection

The session token expired mid-run. Three probes died on `401` and my harness
recorded all three as **DETECTED**, because it treated "no result" as "failed,
therefore caught". **An expired token read exactly like three successful
calibrations.**

It now stops hard when a probe produces no result, and prints each run's
duration: the runs that did nothing took ~130ms against a 19-40s normal.

**And the workflow probe now reports the CAUSE alongside the effect.** A refusal
check that fails says how many times the save was actually attempted, so "the
message did not appear" is distinguishable from "nothing was sent".

---

## 8. What is NOT done

- **No swap.** `initOpportunityDealPanel` is still unregistered; the vanilla form
  is the live Commercials surface.
- **No adoption.** The React panel does not drive the version machinery.
- **No re-points beyond the three the split broke.** 14 source-shape and 8
  stylesheet blocks remain pointed at the vanilla, correctly, because it is live.
- `WRITABLE_NUMERIC_KEYS` remains a pre-existing dead import in the form file.
