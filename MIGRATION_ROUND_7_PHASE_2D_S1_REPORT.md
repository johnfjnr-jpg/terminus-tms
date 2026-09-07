# Round 7 Phase 2d, session 1: what blocks the walk

**Precondition:** Phase 2c committed at `c2f9fe0`, 21-stage gate green, the
`app.js` enumeration asserting 574 lines across 20 names.

**No swap.** The vanilla Test Bed is still live.

---

## The enumeration, before and after

| | names with no React counterpart | vanilla lines |
|---|---|---|
| **before** | **20** | **574** |
| **after** | **14** | **365** |

Six gaps closed in the same commit, per the ratchet rule:
`renderTestBedDocuments`, `renderTbStageApprovals`, `renderTbClosedPanel`,
`wireTbNextStageButton`, `tbNextStageState`, `tbDocKey`.

Both populations now have a gate. The file population reads 20/20 rendered; the
view population reads 14 gaps and refuses the swap.

---

## What was built

Enumerated first as a dated addendum - **M1-M8, A1-A9, Z1-Z6, X1-X4** - then
tests red first:

```
Error: Failed to resolve import "../testbed/documents" from
  "src/__tests__/testbed-panel-content.test.ts". Does the file exist?
```

**46 tests: 29 on the models, 17 on the rendered halves**, the latter through
one root re-rendered.

### M: the documents panel

**The union is the whole design and it is now asserted.** `reference_docs` is
the stage's catalogue; `completable_documents` is the per-document state from
`stage_gate_rules`. The two tables hold names as **independent free strings with
nothing aligning them**, so intersecting would make a mismatch *invisible* - the
document would silently vanish. The union shows it, and **a document listed with
no Confirm control is a legible symptom of exactly that misalignment**.

**M4 and M5 are two different silences and must stay two.** A catalogue-only
document says *Not gated*; an approved one shows nothing. Collapsing them into
one blank would hide the very misalignment M2 exists to surface, and the
injection that collapses them fires.

### A: the shared track list

Built in `src/shared/`, **consumed by the Test Bed host now**. The Opportunity's
consumption is recorded below as a follow-on re-point, not duplicated -
Verification 20.

**`recordType` throws rather than defaulting.** It decides whether the
pre-workflow approve control may be clicked, and a default would hide a missed
call site. The vanilla throws by hand for exactly this reason; the React
component keeps it, and the injection giving it a default fires.

**A version-scoped track is never clickable and names its version.** Its
sign-off is held against an issued major, not a stage row, and *"approved"
without naming what was approved is the claim this model exists to make
precise*. Scope is **read from the rule the gate reads**, never inferred from a
stage name - the injection that infers it from `Proposal` fires.

### Z: the closed panel

**Read-only is structural, not cosmetic**: the endpoint returns no gate rule and
no required_status, so there is nothing a control could act on. The test asserts
**zero inputs and zero buttons in the whole subtree** rather than checking for a
particular one.

**It degrades honestly.** A Test Bed can reach Closed with documents missing via
the backward transition path, so the shortfall is stated - *3 of 4 produced. 1
were never recorded.* - and a document never produced **says so** instead of
rendering a blank line that reads like a missing URL.

### X: the Next Stage action

T7 already decided enablement and was injection-covered; **nothing was wired to
the click**. `nextStageFor` derives the state, sorted by `sort_order` rather
than trusting the route's array order, and the button now calls the shell's
transition.

---

## Two C1-pattern shell seams added

`usesWorkflow` and `attemptTransition`. Both are answers the shell owns and a
bundle cannot reach.

**`usesWorkflow` is deliberately not re-derived.** It is the same list the
server branches on, published on `window` by an `index.html` module, and
Verification 41 records what removing it cost last time. A second derivation
would be Verification 20 exactly.

**`attemptTransition`'s fourth argument is named for what it is.** It read as an
element id for several rounds and never was one - the transition only ever
compared it. The seam names it `recordType` rather than carrying a comment
explaining what it is not.

---

## ONE SHELL FIXTURE, and it is a finding about the test estate

Adding two members to `ShellServices` broke **nine test files at once**, each of
which hand-built the whole literal. The obvious fix was to paste two lines into
each.

**That is Verification 47's shape: five copies of a wrong shape agree with each
other perfectly.** A single `shellServices()` builder now lives in
`fixtures.ts`, built from the contract with a harmless default for every member,
and the nine files pass only what their test is about. The next service added to
the seam costs one line.

---

## Calibration

`scripts/round7/inject-phase-2d.mjs`, verified-snapshot harness.
**27/27 detected, reverted run GREEN, all seven files byte-identical.**

The 2c gate was re-anchored after the six closures moved its anchors, and
re-run: **6/6.**

### Two silences, both classified correctly by the harness

**`M2: the gated list decides the order` - 6 failed, so the MATCHER missed.**
It was anchored on *M1 the CATALOGUE decides the order*, and that test **does
not fail** under this injection: with the gated list leading, its two
assertions still hold by luck. Re-anchored on the union test, which is what the
injection actually falsifies.

**`X1: the array order decides the next stage` - ZERO failures, so a MISSING
ASSERTION.** The fixture shuffled to `[Closed, Qualification, Site Assessment]`,
where **the unsorted answer after Qualification is also Site Assessment**. The
test could not tell the two states apart - Verification 17 exactly. Re-shuffled
to a list where unsorted gives `Closed` and sorted gives `Site Assessment`, with
an assertion on the fixture itself so it cannot silently stop differing.

---

## Standing detectors

| detector | result |
|---|---|
| accounting (both populations) | 12/12 |
| duplicate ids | 3/3 |
| computed visibility | 2/2 |
| node stability | 4/4 |
| **casing collisions** | **caught one, unprompted - see below** |

---

## Surprises

**1. The casing detector fired on its own, one session after being built.**
`closedPanel.ts` beside `ClosedPanel.tsx` - the fourth instance of this
collision in three sessions, and **the first found by a machine rather than by a
broken build**. It named the pair and the file it was protecting came back
byte-identical.

**2. The bundle freshness stage failed, and that is the reach work being real.**
Previous sessions changed `src/testbed/*` and the committed bundle did not move,
because **nothing imported those modules** - the tree-shaken output was
identical. This session wired them to the host and the bundle changed by design.
The stage that caught it is the one measuring whether the committed artefact is
what the source builds.

**3. React maps `onBlur` to `focusout`, not `blur`.** A `blur` dispatch does not
bubble and reaches nothing, so the M7 test read as a broken handler when the
handler was fine. Same family as Verification 6's write-side clause: a synthetic
event and a real one are not the same event to the framework.

**4. A database flake, recorded rather than swept.** `atomicity: 40 genuinely
concurrent appends` failed once with **1 of 40 appends refused**, under full
suite contention. It passes in isolation and passed on the re-run. **Nothing in
this session touches that path** - the change is frontend and scripts only.
`CLAUDE.md` Verification 46 records the same shape from the record-freshness
incident: a new writer on `records` inheriting the append advisory lock. **On the
list, not fixed here**, and worth naming because a once-in-N failure on an
atomicity test is exactly the kind that gets re-run until it is green and then
forgotten.

---

## The follow-on re-point, recorded

**The Opportunity still uses `buildStageTrackListHtml` in `app.js`.** The React
`StageTrackList` is consumed by the Test Bed host only. Re-pointing the
Opportunity is a separate change with its own walk, and duplicating the logic
into a second React component would be the thing Verification 20 exists to stop.

---

## What remains before the swap

**14 names, 365 lines**, which is sessions 2 and 3 of Phase 2d:

| session | lines | names |
|---|---|---|
| 2: the view's load and render | 194 | `renderTestBedDetail`, `loadTestBedDetail`, the landing inputs, `currentTestBed`, `tbDetailStages` |
| 3: the rest | 171 | doc confirmation, approval decisions, panel refresh, convert to Opportunity |

---

## Gate

**All 21 stages passed.** Pure 485/485, database 94/94, react **831/831**, all 0
fail, typecheck clean, 14 HTTP probes. Every figure parsed from the run.

The react suite grew by 46 this session (785 to 831).

**Not pushed. No swap. Phase 2e is not reachable until the enumeration reads
zero gaps.**
