# Migration Round 1, Phases 2 and 3: the approval view, migrated and tested

**Built 2026-09-05**, as one session with one report, per John's ruling of this
date. Gate green at 18 stages before reporting. Nothing pushed. Phase 4 not
started.

---

## 1. What was built

### Phase 2, the view

| file | what it is |
|---|---|
| `approval-types.ts` | the endpoint's shape, typed from the endpoint |
| `approval-format.ts` | formatting only, with the line to arithmetic drawn explicitly |
| `ApprovalRow.tsx` | the migrated `row()`, composing elements instead of interpolating markup |
| `ApprovalBlocks.tsx` | the five blocks |
| `ApprovalView.tsx` | the frame, the query, the error slot, the staleness sentence |

The Phase 1 placeholder is gone. All five blocks render, and every point of the
brief's twelve-point list is covered by a check named in section 4 or 5.

### Phase 3, the tests and the two new gate stages

| file | what it is |
|---|---|
| `src/__tests__/fixtures.ts` | page objects produced by the real `buildApprovalPage` |
| `src/__tests__/approval-shapes.test.tsx` | the thirteen shapes, rendered and asserted |
| `src/__tests__/shell.test.tsx` | registration, mount, `detailLoaded`, staleness |
| `scripts/check-dist-fresh.mjs` | the committed bundle matches the source that built it |

Both wired into `npm run verify` **and** into CI, deliberately in both: a stage
that exists in only one of the two can be skipped by whichever path somebody
happens to use.

### The click-time guard, Phase 2 item 7

`frontend/app.js` called `window.loadApprovalPage?.(id)`. That optional call was
correct while the vanilla file defined the function unconditionally. **The
migration changed what absence means**: the function is now registered by a
built bundle, and a bundle can be absent for ordinary reasons. Measured in
Phase 1, `?.()` then did nothing at all, with no error anywhere.

It now renders a sentence saying this is a build fault rather than a problem
with the deal, and it still calls `detailLoaded`, so Round 41 item K holds on
that path too.

---

## 2. Which shapes were walked LIVE, and which only by fixture

The live walk is a Puppeteer probe against a real fixture Opportunity through
the real server. **23 of 23 checks pass.** The probe is scratch, and the fixture
was torn down: re-queried afterwards across opportunities, contacts, accounts
and test beds, all clean.

| # | shape | live | by fixture |
|---|---|---|---|
| 2 | stated absence, no baseline | **yes** | yes |
| 6 | missing cost basis, in use | no | yes |
| 7 | missing cost basis, not in use | no | yes |
| 8 | empty `notRecorded` | no | yes |
| 9 | version absent / version present | **yes** (present) | yes (absent) |
| 12 | conditional disclosure fires | **yes** | yes (both directions) |
| 1 | bridge present and comparable | no | yes |
| 10 | baseline present, NOT comparable | no | yes |
| 11 | exposures without a worst month | no | yes |
| 13 | absent governing input fails loud | no | yes |
| 3 | bridge not reconciling | no | yes, and see below |
| 4 | unexplained residual | no | yes, and see below |
| 5 | unassigned keys | no | yes, and see below |

**Why the sandbox reaches so few.** Every unreached shape needs a state a fresh
Opportunity does not have: an APPROVED prior version (1, 10), a catalog with a
product missing (6, 7), a fully-populated payload (8), or a bridge state that is
structurally unreachable (3, 4, 5). Producing an approved baseline through the
browser means driving the whole transition-request workflow, which is a
different feature's test.

Also walked live, and not shapes: `detailLoaded` on success and on failure, the
staleness sentence in both halves, the error slot carrying the server's own
sentence, the five blocks absent on failure, the back button surviving an error,
and the click-time guard in both directions.

---

## 3. THREE BRIDGE BRANCHES CANNOT BE REACHED, AND THAT IS A FINDING

This is the round's most substantial finding and it is about the enforcement
rather than the view.

**Non-reconciling.** `rounding` is the display error of
`closing - opening - sum(steps)`. Sequential attribution telescopes, so the true
value is 0, and each `toFixed(2)` contributes at most 0.005 across `steps + 2`
terms. **`tolerance` IS `(steps + 2) x 0.005`.** The error bound and the
tolerance are the same quantity, so `reconciles` can be false only if
telescoping itself fails.

Measured, not only argued: **810 payload pairs. 273 produced a non-zero rounding
line. Not one failed to reconcile.**

**Unexplained.** `total - summed`, zero for the same telescoping reason.

**Unassigned keys.** `pricedKeys()` minus every key a step claims. Computed:
**23 priced, 30 claimed, and the difference is EMPTY.** No payload change can
leave a priced key unaccounted for.

**This is not a defect and the branches should stay.** All three are fail-safes
for a FUTURE change: a step applied out of order, or a new priced key added to
the calculation and not to a step. That is exactly what they are for.

**What it means is that Verification 21's own concern applies to its own
remedy.** Round 38 recorded that a bridge which always adds up is telling an
approver nothing, and set a tolerance so the reconciliation could fail. The
tolerance was derived from the same bound that limits the error, so **the check
still cannot fail on today's code**. It is a correct guard against a future
change and it is not evidence about the present one.

It is Verification 9 with the detector's own author having built it carefully:
a detector that has never fired, and in this case *cannot* fire, is an assertion
rather than a control. **On the list rather than fixed here**, because changing
what the tolerance means is a pricing-page decision, not a migration one.

The three renderings are still tested. The state is produced in the suite by the
system's own `checkReconciliation`, given step effects that do not telescope,
which is precisely the condition the guard exists for. That is documented at the
site rather than passed off as an ordinary fixture.

---

## 4. The tightened assertion, before and after

`scripts/tests/commercials-wiring.test.mjs`.

**BEFORE (Phase 1).** Named the live vanilla consumers, plus a comment promising
to name the React tree once it rendered `ds-row`:

```js
  const liveConsumers = ['../../frontend/app.js', '../../frontend/opportunity-deal.js']
    .map((rel) => readCode(new URL(rel, import.meta.url)))
  assert.ok(liveConsumers.some((src) => /ds-row/.test(src)), ...)
```

**AFTER.** The React tree is named, and the promise is closed rather than left
describing a tightening that has already happened:

```js
  const vanillaConsumers = [...].map((rel) => readCode(new URL(rel, import.meta.url)))
  assert.ok(vanillaConsumers.some((src) => /ds-row/.test(src)),
    'no loaded vanilla file uses .ds-row any more; if that is deliberate, delete this half')

  const reactConsumers = ['../../frontend-react/src/ApprovalRow.tsx']
    .map((rel) => readCode(new URL(rel, import.meta.url)))
  assert.ok(reactConsumers.some((src) => /ds-row/.test(src)),
    'the React approval view no longer renders .ds-row, so the rule below has lost its new consumer')
```

**Both sides are asserted individually, not as "some consumer exists."** The
whole migration is the vanilla side going away one file at a time. When the last
vanilla consumer goes, that line fails, and **the failure is the instruction to
delete it** rather than a defect to work around.

---

## 5. Pixel parity

**The stylesheet is untouched. Not one rule was added, removed or changed.**
Every rule-bearing class is reproduced exactly: `ds-row`, `ds-label`,
`ds-value`, `pg-item-note`, `msg-error`, `msg-warning`, `tag`, `appr-frame`,
`appr-frame-close`, `card`, `eyebrow`, `detail-head`, `sub`, `btn-text`,
`label`. So are the inline styles, including `min-width: 0` on the row's left
cell, which is what lets a long label ellipsis instead of forcing the row wide.

Characters the vanilla emitted as HTML entities (`&nbsp;`, `&middot;`, `→`) are
written as the code points they stood for and render identically.

**ONE DEMONSTRABLE EXCEPTION, and it is required by the brief rather than
chosen.** On a failed fetch the vanilla set the error line and RETURNED, leaving
whatever the five blocks last rendered on screen. On a second failed load that
is a live error sentence sitting above another deal's figures. Brief point 5
requires that the five blocks do not render stale content, so here they do not
render at all, and the frame does, so the approver still has the way back.

Reported rather than absorbed. Asserted in both suites.

---

## 6. Calibration evidence

### The click-time guard

| direction | result |
|---|---|
| registration present | **silent**, no `#appr-missing-bundle` in the container |
| registration deleted | **fires**, renders the sentence, and still calls `detailLoaded` |

Both in the live browser walk, against the real server.

### The dist staleness stage

**Determinism first, because the whole stage rests on it.** Three builds
including one after deleting `dist` entirely produced the same sha256
`ca188446…`. Not assumed.

| direction | result |
|---|---|
| a real source edit (a rendered sentence, not a comment) | **FAIL**, both hashes printed |
| after reverting that edit | **PASS** |
| the working tree afterwards | **unchanged**, committed bundle restored |

The restore path is exercised on every run, including the failing one, so the
stage is safe to run anywhere.

### Four React assertions

Injected, watched fire, reverted:

| injection | result |
|---|---|
| render the version reason with `dangerouslySetInnerHTML` | 1 failed |
| fire `detailLoaded` only on success | 2 failed |
| stop rendering the not-comparable caveat | 6 failed |
| register a second global from the bundle | 7 failed |

---

## 7. What surprised

### a. React destroys the container's static markup, and Phase 1 hid it

`createRoot` CLEARS its container on first render. So the moment the bundle
mounted, the back button, the eyebrow, the title and the five card headings
inside `#view-opportunity-approval` were **destroyed**.

**Phase 1 shipped that and nobody saw it**, including me, because Phase 1's
probe read the container's `innerText` and got the placeholder alone. A
placeholder is expected to look bare, so "everything else is missing" reads
exactly like "the placeholder rendered."

React now owns the whole view and reproduces the frame exactly. The markup stays
in `index.html`, dead while the bundle is loaded, because that is what keeps the
Phase 5 revert to one script tag.

**The general shape: a probe that asserts what SHOULD be there cannot see what
used to be there and no longer is.** Verification 7's moved-thing rule from the
other direction, and the reason it went unnoticed is that the expected output
was deliberately minimal.

### b. My own comment satisfied my own scan, within the minute

A scan for `dangerouslySetInnerHTML` across the React tree returned a hit. The
hit was **the comment in `ApprovalRow.tsx` saying there is none**, written by
the same hand in the same minute as the scan.

That is Verification 39's third instance verbatim, and I had read the rule this
session. Knowing a rule confers no ability to spot its instances.

### c. The comment stripper could not read the migration's own file types

Fixing (b) meant reading through `scripts/lib/strip-comments.mjs`, which
**threw**: `kindOf` had no case for `.ts` or `.tsx`. Every Verification 39 scan
was therefore structurally unable to look at the React tree at all.

It throws rather than answering wrongly, which is the good failure. Now
`.ts/.tsx/.mts/.jsx` read as `js`, and **that is a claim, not a convenience**:
TypeScript adds no comment syntax and no literal syntax that changes where a
comment can start, and `{/* … */}` in JSX is a JS comment inside a JS expression
container. JSX has no HTML comments at all.

Calibrated in both directions per Verification 39's second half: a comment in a
`.tsx` fails to satisfy a scan, and stripped `.tsx` keeps its class names, its
declarations, its generics, its optional unions, and comment syntax inside a
string literal.

### d. `git checkout` reverted a calibration to the LAST COMMIT and destroyed the phase's work

The calibration harness injected a fault, ran the suite, then reverted with
`git checkout <file>`. For `ApprovalView.tsx` that restored the **Phase 1
committed** version, wiping the entire Phase 2 rewrite. For the two untracked
files it reverted nothing at all and left the injections in place.

**All four detectors fired correctly. The harness was the broken part.**

**Caught by the final "reverted" pass**, which is the one thing a calibration
harness reliably reports, and the second time in two rounds that pass has caught
its own harness. Round 41's Verification 44 instance was a basename collision;
this is the same family with a different mechanism: **`git checkout` is a revert
to the last COMMIT, not to the pre-injection bytes, and on a mid-phase tree
those are different things.** A harness must snapshot the actual bytes.

### e. Four endpoint fields have no reader at all

`buildApprovalPage` returns four things nobody renders, and the vanilla view did
not render them either:

| field | what it says |
|---|---|
| `ask.staleBasisWarning` | cost basis over twelve months old; approval requires explicit acknowledgement |
| `ask.ageingBasisNote` | basis between six and twelve months old |
| `ask.unpricedWarning` | units with no Base Cost batch, so the margin above is overstated |
| `frozenTerms` | the terms a version froze |

Two are worth separating. **`frozenTerms` carries a comment in the lib saying
"Verification 22: ... THIS IS WHAT READS IT."** There is no reader. That is
Architecture 9's fourth variant: a sentence that was a plan, recorded in the
voice of a fact.

And **`staleBasisWarning`'s own comment says it was "raised to block 1 because
it changes what the headline margin MEANS."** It is not in block 1. It is
nowhere.

`unpricedWarning` is the least serious: block 4 renders the same fact from
`costBasis.missingDetail`, so an approver does see it. It is a second reader
that happens to be unread rather than a missing disclosure.

**Reported, not built.** The brief's twelve-point list is Phase 2's scope and
names none of them, and rendering a stale-basis warning that says approval
"requires explicit acknowledgement" needs an acknowledgement control to exist.
Build discipline 10: recorded, scoped, queued.

### f. Two probe faults that looked like product faults

Both cost a diagnostic pass and both were the instrument.

**`innerText` applies CSS `text-transform`.** `.eyebrow` is uppercase, so the
heading `1. The ask` comes back as `1. THE ASK` and two checks failed against
correct rendering.

**A row is three siblings, not one sentence.** `Against target` / note / value
render in that DOM order, so a regex spanning label to value fails on the note
between them.

Verification 17 both times: a probe that fires correctly and measures the wrong
thing. The tell in both cases was that the *detail* field in the failure showed
text that read correctly.

### g. The gate reported the React stage with no number

`node:test` prints `# pass 440`; vitest prints `Tests  37 passed (37)`. The
gate's parser matched neither, so the React stage read **PASS with no count** -
and this report quoting "37/37" would then have been a hand-typed second reader,
which is precisely the fault Verification 20's addendum exists to prevent.

The parser now reads vitest's three shapes, calibrated on all of them
(pass-only, with failures, with skips). Every number in section 8 is emitted by
the run.

---

## 8. Gate

```
MERGE GATE  18 stages
  PASS  pure suite                 440/440 pass, 0 fail
  PASS  database suite              92/92 pass, 0 fail
  PASS  react suite                 37/37 pass, 0 fail
  PASS  react bundle freshness
  PASS  14 HTTP probes
All 18 stages passed.
```

Live walk: **23/23 checks**, fixture torn down, no residue in opportunities,
contacts, accounts or test beds.

---

## 9. Decisions taken under the standing delegation rule

Recorded with reasoning, revisitable.

- **vitest + jsdom** as the React test runner, dev-only. It is Vite's own
  companion, needs no separate transform config for TSX, and runs the shape
  tests and the DOM-mounting shell test under one command.
- **`renderToStaticMarkup` for the shape tests**, a real `createRoot` mount for
  the shell test. The shell test then exercises the same mount path `main.tsx`
  uses rather than a testing-library approximation of it.
- **`dist` stays committed**, with the staleness stage as the control. A clean
  checkout serves a working approval view with no build step; the stage stops
  the bundle drifting from its source.
- **Rebuild-and-diff rather than a timestamp** for that stage. A timestamp
  answers "was it written after the source", which is true of a build of
  DIFFERENT source and false after a checkout that writes both at once.
- **The comment stripper reads `.ts/.tsx` as `js`**, justified at the site and
  calibrated in both directions.
- **Both new stages in the merge gate AND in CI**, duplication on purpose.

---

## Standing at the close

Not pushed. Phase 4 not started. `frontend/opportunity-approval.js` is in tree
and unloaded; the Phase 5 revert is still one script tag.
