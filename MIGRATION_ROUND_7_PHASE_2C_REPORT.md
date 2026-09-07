# Round 7 Phase 2c: the swap that still is not takeable

**Precondition:** Phase 2b session 2 committed at `563c971`, 21-stage gate
green, reach asserting RENDERED 20 / LOGIC-ONLY 0 / ABSENT 0.

**No swap.** The vanilla Test Bed is still live.

---

## WHAT IS NOT BUILT, first, per build-discipline rule 15

| item | state |
|---|---|
| 1. the swap | **NOT TAKEN.** Measured below |
| 2. A12 in the swap commit | **NOT IMPLEMENTED.** There is no swap commit |
| 3. the primary write path live | **NOT WALKED.** Nothing to walk |
| 4. re-navigation live, visual comparison | **NOT DONE.** Same reason |
| 5. injections | **DONE** for what this session built |

**The scope discovery is the deliverable**, and it is the second time in this
round. What is new is that the instrument built to prevent exactly this said
the swap was ready.

---

## THE FINDING: the reach gate's population is a FILE, and the swap's is a VIEW

`test-bed-accounting.test.mjs` reads **20 of 20 capabilities rendered**, and
that reading is correct. Its population is `frontend/test-bed-detail.js`'s 136
top-level names.

**The Test Bed detail view is also built by `app.js`**, and Phase 2b's stage-tab
shell replaced part of that file without anything measuring the rest.

**Verification 25's population clause, arriving at the instrument that exists to
stop a swap taking working capabilities off a live screen.** The clause reads:
an instrument can be demonstrably working somewhere and blind on the population
the claim covers. That is this, exactly.

### What the React tree does not have

Enumerated in `scripts/round7/tb-view-surface.mjs`, **one declared disposition
per name**, and asserted by the accounting suite:

```
GAP  (20 names, 574 lines)
      99  renderTestBedDetail      the view render - header, stat strip, banner, landing
      95  loadTestBedDetail        the view load
      92  renderTestBedDocuments   the documents panel CONTENT
      47  renderTbClosedPanel      the terminal tab CONTENT
      45  renderTbStageApprovals   the approvals panel CONTENT
      44  confirmStageDocument     confirming a stage document
      26  tbLandOnStageAfterLoad   the landing input StageTabs takes as a prop
      22  convertTestBed           convert to Opportunity
      21  wireTbNextStageButton    the Next Stage ACTION
      19  saveStageDocumentUrl     a stage document URL
      17  tbArrivingFresh          the fresh-arrival input
      11  applyConfirmedApproval   an approval decision
      11  refreshTbStagePanels     re-loading the open stage after a write
      10  wireTestBedConvertOnce   convert wiring
       6  resetTestBedConvertForm  convert form reset
       2  tbDocKey / tbNextStageState / currentTestBed / tbDetailStages
       1  tbFreshNavigation
```

**Three of them are the stage panel's own content**, which item 3's walk
explicitly requires:

- `ReadPanel panelId="tb-stage-documents-section"` is given **no children** by
  the host. It renders its empty-state sentence and nothing else.
- `ReadPanel panelId="tb-stage-approval-row"` likewise.
- The terminal branch returns `panelsVisible: false` and renders **nothing** -
  where the vanilla shows the completed record, superseding an earlier "renders
  nothing" ruling for a documented reason.

Measured rather than read: `confirmStageDocument`, `buildStageTrackListHtml`,
`renderTbClosedPanel` and `tb-closed` appear in **zero** files under
`frontend-react/src/testbed`.

**And the Next Stage button is inert.** `tabModel.nextStageState` decides
whether it is enabled, correctly and with injections behind it. Nothing is wired
to its click.

### Why Phase 2b could not see this

Phase 2b's instruction was to build the stage-tab shell so the five LOGIC-ONLY
capabilities would render, and it did exactly that, measured by the reach
instrument. **The shell's siblings in `app.js` were never in the population**,
so building the frame moved the gate to green while the frame's contents stayed
in the file being retired.

The session-1 report's own line - *"the five capabilities Phase 1b built and
nothing imported now render"* - is true. It is a claim about
`test-bed-detail.js`.

---

## The instrument, corrected

**A regex over function bodies was tried first and was wrong in both
directions.** `createTabStrip` mentions no Opportunity id though the Opportunity
uses it, so it read as Test-Bed-only; `renderTestBedDetail` mentions
*Opportunity* in a comment about converting, so it read as shared. Two runs gave
1,057 and 269 lines. **Neither number was defensible.**

Replaced with a **declared enumeration** - Verification 41's shape, where the
enumeration itself is the instrument - covering every `app.js` name that builds
this view, each with one of four dispositions: a React counterpart, shared with
the Opportunity, the list view, or a gap.

The accounting suite now carries **three more assertions**: the parsed gap set
equals the recorded one exactly, every recorded gap still exists in `app.js`,
and the swap is not takeable while the set is non-empty. **The ratchet shape
from Phase 2b, on the second population.**

### Calibration

The standalone enumeration, three ways, both reverts byte-identical:

| injection | result |
|---|---|
| a declared name that is not in `app.js` | REFUSED |
| a gap reclassified as covered | 574 lines / 20 names -> 527 / 19 |
| every gap covered | verdict flips to TAKEABLE |

The suite gate, `scripts/round7/inject-phase-2c.mjs`, verified-snapshot harness:
**6/6 detected, reverted run GREEN, both files byte-identical.**

**One silent, classified by the harness itself.** *A NEW gap appears in app.js
and nobody records it* came back SILENT with **1 failed** - non-zero, so the
matcher missed rather than an assertion being absent. It was anchored on the
standalone script's refusal, which the suite does not run; the test that
actually falsifies it is the exact-set one. Re-anchored, 6/6.

---

## What the swap needs before Phase 2c can run

**574 lines across 20 `app.js` names**, and they are not evenly weighted:

**The three that block the walk** - documents content, approvals content, the
closed panel - are 184 lines and are the ones item 3 names directly.

**The view's own load and render** are 194 lines and include the read-only
banner, the header strip and the landing inputs `StageTabs` already takes as
props but nothing supplies.

**The rest** - the Next Stage action, document confirmation, convert to
Opportunity, the post-write panel refresh - are 196 lines.

**Two are shared and stay:** `buildStageTrackListHtml` and
`renderStageApprovalsRows` are the Opportunity's too, so the approvals content
is a REUSE rather than a rebuild, which is the cheapest of the three.

---

## Surprises

**1. The gate said takeable and it was wrong about the question, not the
answer.** Phase 2's finding was an instrument that measured file existence
instead of reachability. This is the same instrument, now measuring
reachability correctly, over a population that is one file where the decision is
about a view. **Two different failures of the same measure in one round.**

**2. The regex classifier gave two different defensible-looking numbers.**
1,057 and 269, from the same question asked with two exclusion patterns. Neither
was reported. A declared list is slower to write and is the only thing here that
can be audited.

**3. A path bug surfaced loudly rather than silently, which is worth
recording.** The new assertion read `new URL('../round7/...', ROOT)` and
resolved outside the repository. It threw `ENOENT` and named the wrong path.
Had it resolved to an empty file instead, the gap set would have parsed as `[]`
and the test would have failed with a diff nobody could interpret - which is why
the "no gaps parsed, so this assertion is vacuous" guard is in the test and is
one of the six injections.

---

## Gate

**All 21 stages passed.** Pure **485/485**, database 94/94, react 785/785, all 0
fail, typecheck clean, 14 HTTP probes. Every figure parsed from the run.

The pure suite grew by 3 (482 to 485, the view-population assertions).

**Not pushed. No swap. Phase 3 does not follow from here** - what follows is a
decision about the 574 lines.
