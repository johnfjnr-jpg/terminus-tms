# TEST BED COMMERCIALS RECOVERY: the brief

**Pure recovery. Render or restore what the old HTML had, from the old code.
No new features.**

The source of truth for every item is `frontend/test-bed-detail.js` and
`frontend/index.html`'s `#view-test-bed-detail` at **`54001c5^`** (the commit
before `54001c5`, "Round 8 Phase 2: the two vanilla surface files retired").
Both files are readable at that ref and were confirmed present: 3,281 lines
and the full view markup.

**Path: MEDIUM.** It is display work, and `DESIGN_PRINCIPLES.md`'s
proportionate-testing table would call that light. It does not qualify,
because the screen it lands on **computes and saves**. A rendered figure that
disagrees with the stored one is a data defect wearing a layout defect's
clothes. So: the affected suites plus a screenshot, as the light path asks,
**and** a live check that every rendered figure equals what the route
returned. No Phase 0 forensics beyond confirming the mount points, and no
both-direction injection sweep unless a behaviour changes.

---

## What this round does NOT do, recorded first

`CLAUDE.md` build discipline 15: the report's first section about an
unfinished item says it is unfinished, before any account of what was done.
The same applies to a brief's scope.

### Deferred, and NEW work rather than recovery. John's, later.

| | why it is not recovery |
|---|---|
| **Admin-catalog unit costs wired to Test Bed** (`base_cost_batches`, as Opportunities do) | The old Test Bed **hand-typed** its rates as payload fields. There is nothing to restore. It also needs a ruling the old code cannot supply: seeded at creation and then editable, or read live. That is `CLAUDE.md` Architecture 11, a default is an initial value and not a fallback |
| **Use Cases as an industry-taxonomy dropdown** | The old one was **free text**. A dropdown is a new control over new data |

### Carried, John's walk items, their own round

Next Stage button convention; the current-stage `*` marker; scroll-to-save;
History as its own tab; the Convert-to-Opportunity top button; the account
dropdown dialogue; the client-contact dropdown; drop mobile; the white
Add/document buttons.

**None of these is measured here**, and `TESTBED_RECOVERY_PHASE_0_REPORT.md`
says so in its own closing section. They are layout and placement, this round
is render and restore, and mixing them makes the walk unable to say which
change caused what.

---

## The four items

### L1: render the cost breakdown. The headline, and the frustration.

**The breakdown is already computed on every keystroke and thrown away.**
This is not a rebuild. Confirmed in the current tree:

| piece | state | site |
|---|---|---|
| the engine, `calculateTestBedCost` | **alive** | `src/lib/deal-calculator.js:376` |
| the wire mapping, `buildTestBedCostBreakdown` | **alive** | `src/routes/test-beds.js:24` |
| the preview route, `POST /api/test-beds/calculate` | **alive** | `src/routes/test-beds.js:108` |
| the stored breakdown on the record | **alive**, live-recomputed on every GET | `src/routes/test-beds.js:419` |
| the debounced runner, `createPreviewRunner` | **alive and firing** | `TestBedHost.tsx:317` |
| the result | **discarded into `setPreview`, never read again** | `TestBedHost.tsx:319` |
| the container | renders two words | `TestBedHost.tsx:275` |

```jsx
const costBreakdownNode = (
  <div data-testid="tb-cost-breakdown"
    className={preview ? 'tb-cost-unsaved' : undefined}>
    {preview ? <span data-testid="tb-cost-preview-marker">Unsaved figures</span> : null}
  </div>
)
```

**Do not rebuild the engine. Fill the container.**

**Type it properly.** Two `unknown`s carry this data today and both are the
same value:

```
TestBedHost.tsx:70    costBreakdown?: unknown
TestBedHost.tsx:100   const [preview, setPreview] = useState<unknown | null>(null)
```

The shape is not a guess. It is `calculateTestBedCost`'s return, read from
the source:

```ts
interface TestBedCostBreakdown {
  hardware: { totalUnits, hardwareCost, warrantyUnits, warrantyCost, avgHwCost }
  groups: {
    hardwareGroup: CostGroup   // row keys: hwSs, hwAqm, hwHemir, hwWarranty
    installGroup:  CostGroup   // row keys: inSs, inAqm, inHemir
    hostingGroup:  CostGroup   // row keys: hoSs, hoAqm, hoHemir
  }
  hostingMonthCost: number
  hostingTermCost:  number
  months:           number
  totalCost:        number
}
interface CostGroup { rows: { key, rawCost, rawPrice }[], rawTotalCost, rawTotalPrice }
```

**Read only the `*Cost` fields.** `rawPrice` and `rawTotalPrice` exist because
`buildCostGroup` is shared unchanged with the priced Opportunity path. A Test
Bed has no price or margin concept, and the old markup's comment says a test
asserted no price or margin figure renders anywhere on that tab. Keep that
true.

**Which source, and the choice is of INPUTS and never of arithmetic.** The old
line is one expression, and React already holds both halves:

```js
const b = tbCostPreview ?? tbBed.costBreakdown     // old
      →   preview       ?? record.costBreakdown    // React
```

Both come from the same server function, so a preview and a save cannot
disagree about how anything is added up.

**The four cards, in a `.ref-cards` grid:**

```
Cost summary                      Hardware
  Total Cost        <- FIRST        SafeSight (12 x <rate>)
  Hardware                          Air Quality (6 x <rate>)
  Installation                      HEMIR (1 x <rate>)
  Hosting x N months                Hardware subtotal

Installation                      Hosting (per month)
  SafeSight                         SafeSight
  Air Quality                       Air Quality
  HEMIR                             HEMIR
  Installation subtotal             Hosting subtotal / month
```

Three details that were measured rather than chosen, and are part of the
recovery:

- **Total Cost is FIRST, not last.** The old code records the measurement:
  total-last costs 185px because the three category rows push it down;
  total-first costs 45px, which is exactly the card's own chrome. Total-last
  put it below the fold at 1240 and 1920.
- **The hardware labels quote the DRAFT inputs while previewing.** Otherwise a
  row reads `SafeSight (12 x ...)` beside a figure computed from 14, which is a
  row contradicting itself. The old helper is
  `tbEffectiveValue(key) = draft || stored`; React's equivalent is the host's
  `drafts` over `record.payload`.
- **The unsaved marker sits in the CARD'S OWN TITLE**, not only in the save
  bar. A total a person cannot tell apart from a saved one makes the save bar
  advisory. The existing `tb-cost-preview-marker` testid is already in the
  tree and is cited by `testbed-draft-survival.test.tsx`: keep it
  (Verification 32).

**Weights matter and were a recorded defect.** Round 15 Phase 4 shipped this
card with its totals in the dimmed `.data-row-label` treatment meant for the
itemized rows a total is built from, making them the least prominent figures
on the tab. `CLAUDE.md` Verification 4 records it. The old code's three
helpers encode the fix: `line()` dim for itemized rows, `summaryRow()` white
for category totals, `summaryTotalRow()` heavier still for Total Cost, which
is the one row that is a sum of the rows above it.

### L2: restore the Reference "Qualification score" card

`tb-score-summary` appears **0 times** in the React tree. Dropped at the swap.

The old card, from `index.html:1064-1067` and the renderer at
`test-bed-detail.js:2046`:

```html
<div class="pg-card">
  <p class="pg-card-title">Qualification score</p>
  <p class="sub" id="tb-score-summary-sub">Recorded on the stage tabs.</p>
  <div id="tb-score-summary"></div>
</div>
```

One row per scoring criterion: the criterion name, the **current** (latest)
score or `Not scored`, and **the stage that score was recorded at**.

**Display only. Deliberately no control** - the card's whole job is to say
where scoring happens, and the sub-line is the half that makes the route
evident without one.

### L3: un-flatten the rate cards, and restore the unit annotations

**Old, four cards in `.ref-cards` (`index.html:1213-1225`):**

```
Unit Counts
Hardware Cost Rates ($ / unit)
Installation Cost Rates ($ / unit)
Hosting Cost Rates ($ / unit / month)
```

**Now, two cards** (`CommercialsCards.tsx:54-64`): `Sensor Counts`, then one
`Commercials` card holding all nine cost rows, **whose labels state neither
unit**. A hosting rate and a hardware rate read identically, and one is per
month.

The nine keys are already grouped correctly in the source, three by three:
`ss/aq/hemirUnitCost`, `ss/aq/hemirInstallCost`, `ss/aq/hemirHostingCost`.

**The constraint: `tb-card-sensors` and `tb-card-commercials` must survive.**
They are cited by two assertions in `testbed-draft-survival.test.tsx` (lines
161-170, both directions of last round's move) and by two probes,
`scripts/testbed-layout/probe-moves.mjs` and
`scripts/testbed-state/probe-r1-live.mjs`. A restructure is not a licence to
rename (Verification 32). Splitting `tb-card-commercials` into three means
deciding which card keeps that testid, or re-pointing all four call sites with
a disposition each (Verification 41). **Name the choice in the phase report.**

### L4: restore the Reference sub-tab strip

`tb-ref-subtabs` is absent. The Reference tab now stacks nine cards; the last
three were panes.

The old strip, `mountTbReferenceSubTabs()` at `test-bed-detail.js:642`:

```js
tabs: [
  { key: 'useCases',          label: 'Use cases' },
  { key: 'customerDocuments', label: 'Customer documents' },
  { key: 'history',           label: 'History' },
]
```

Two properties worth carrying, both recorded at the old site:

- **Mounted once per RECORD, not per render.** Rebuilding on every render
  snapped the open pane back to Use cases while somebody was working in
  Customer documents. Which pane is open is a position inside one record's
  content, so it resets between records and not between saves.
- **History is LAZY**, loaded when its tab is opened rather than on every
  record load.

**A naming disagreement to settle, not to inherit silently.** The old pane is
`Customer documents`; the React card is `Client Documents`
(`TestBedPanel.tsx:202`). Pick one and say which in the phase report.

---

## Phase 0: confirm the render targets. Light.

**The old code has already been read.** `TESTBED_RECOVERY_PHASE_0_REPORT.md`
inventoried it, and the sites are cited above with line numbers. Do not
re-read the whole old file.

What Phase 0 confirms, and it is a short list:

1. **The mount points**, live: the empty `tb-cost-breakdown`, and where L2,
   L3 and L4 attach in the current React.
2. **That the calc output is reachable to render.** It is. Confirm both
   halves specifically: `preview` is set on every draft change, and
   `record.costBreakdown` arrives on the GET. A dirty screen and a clean one
   are two different sources and the fallback is the one nobody exercises.
3. **The five questions below.** Each needs an answer before Phase 1, and
   each was found by measuring rather than by reading the brief.

### Q1. TWO READERS OF "TOTAL COST", AND THIS ROUND CREATES THE COLLISION

The header strip already renders a `Total cost` cell:

```
headerStats.ts:64   { label: 'Total cost', value: money(payload?.accumulated_cost) }
```

That reads **`payload.accumulated_cost`**, the persisted mirror. The
breakdown's Total Cost reads **`costBreakdown.totalCost`**, the live
recompute. `CLAUDE.md` Verification 20: a second reader of the same value
always drifts.

**And while a preview is showing they will legitimately disagree**, because
the header shows the saved figure and the breakdown shows the draft one, and
nothing on the header says so.

**This is not a pre-existing defect to be waved past.** The header stat landed
2026-09-10, after the breakdown had already been dropped, so the two have
never been on screen together. Putting the breakdown back is what makes them
collide. `CLAUDE.md` build discipline 10's limit: a finding the round's own
change creates is part of the change.

**Decide in Phase 0.** Either the header reads the same `costBreakdown.totalCost`
the card does, or the two are deliberately different figures and the screen
says which is which. Do not ship two unlabelled totals.

### Q2. Which money format

There are already three formatters in the React tree and the old code is a
fourth, with a different output:

```
headerStats.ts:17       $4,200            en-US, 0dp   <- the Test Bed's own
deal/rows.ts:39         4,200             en-US, 0dp
approval-format.ts:20   4,200             en-US, 0dp
old formatCost          USD 4,200.00      en-GB, 2dp   <- what the old cards showed
```

The breakdown and the header stat are the same number. **Two formats for one
figure on one screen is Q1 arriving in the stylesheet.** Pick one, reuse an
existing function rather than writing a fifth, and say which.

### Q3. The warranty row cannot fire, and an assertion about it would be vacuous

The old Hardware card has a conditional warranty line:

```js
const warrantyLine = b.hardware.warrantyCost > 0 ? line(`Warranty (...)`) : ''
```

**`buildTestBedCostBreakdown` passes `warrantyPct: 0` explicitly**, with its
reason recorded at the site: a Test Bed is Terminus-funded R&D with no
customer warranty commitment. So `warrantyUnits` is `Math.ceil(n * 0 / 100)`,
which is 0 for every input, and the row is structurally unreachable.

**Port the conditional, do not assert the row renders.** `CLAUDE.md`
Verification 14: a claim that is true by absence is not the same as true, and
the companion assertion has to be that the thing exists somewhere. It does
not. Record the branch as deliberately unreachable rather than leaving a test
that passes because nothing can make it fail.

### Q4. Where the breakdown sits

The old layout put the breakdown **below** the `.ref-cards` rate grid, as its
own section with its own heading:

```html
<div style="margin-top:28px">
  <p class="pg-card-title">Itemized Cost</p>
  <p class="sub">What this Test Bed will cost to build - cost only, no price
     or margin, supporting a go/no-go decision.</p>
  <div id="tb-cost-breakdown"></div>
</div>
```

The React node is currently **nested inside the `Commercials` card**
(`CommercialsCards.tsx:60`), which was correct while it rendered two words and
is not obviously correct for four cards. L3 changes that card anyway.
**Restore the old structure unless there is a reason not to, and say which.**

### Q5. L2's data source is the PAYLOAD, not `seriesByKey`

The obvious wiring is wrong and would ship an empty card.

```
TestBedHost.tsx:106   const [seriesByKey, setSeriesByKey] = useState<...>({})
TestBedHost.tsx:437   if (r.data?.series) setSeriesByKey(r.data.series)   <- POST /scores ONLY
```

`seriesByKey` is populated **only by the response to recording a score**. On a
fresh page load it is `{}`, so a card reading it shows `Not scored` for every
criterion on a record that has been fully scored.

The old card read the record payload directly: one array per criterion key,
sorted by `at`, last entry wins. The stored entry shape, from
`src/lib/score-entry.js:177`, is:

```js
{ at, by, value, anchorVersion?, stage }
```

**And React's `ScoreEntry` type names only `reason`**
(`scoreReason.ts`), which is enough for `reasonRequired` and not enough for
this card. It needs widening to what is actually stored, the same way
`costBreakdown` does.

**The tell to check in Phase 0:** open a scored record, render the card, and
confirm it is not uniformly `Not scored`. A uniformly-empty card and a
correctly-empty card look identical.

---

## RULINGS, given by the business 2026-09-15, appended at the phase they launch

`CLAUDE.md` build discipline 7: a ruling that launches work is part of that
work's record, and a brief that acquires it at the close has been wrong for
every phase in between.

### Q1, RULED: A. LABEL THE TWO TOTALS. Both show.

The header total stays `accumulated_cost` and is labelled **saved**. The
breakdown card's total stays `costBreakdown.totalCost` and is labelled
**unsaved** while a preview is showing.

**The label is what carries the disagreement.** Two totals that differ during
an edit is the correct behaviour, not a defect: one is what is stored and one
is what is being typed. What was wrong was that neither said which.

**Make the distinction obvious on screen, not merely present.** The business
will judge it in use, so this is a Verification 4 item: every assertion can
pass on a pair of labels nobody can tell apart. Open the screenshot.

**Total-first stays** inside the breakdown card. It was measured against
below-the-fold (185px against 45px) and it is not re-opened.

### Q4, RULED: its own section, below the rate grid.

The breakdown is restored to the old code's home: an **`Itemized Cost`**
section beneath the `.ref-cards` rate grid, with its own heading and
sub-line. **Not nested inside the Commercials card.**

### Q3, RESOLVED BY DELETION: the warranty is DROPPED ENTIRELY.

> "Warranty doesn't matter in a test bed, not a calculation required."

**Do not port the conditional. Do not render a row. Do not test one.**

This is a stronger ruling than the brief asked for and a better one. The brief
proposed porting a branch that can never fire and recording it as unreachable;
the business's answer is that the concept is **irrelevant to a Test Bed**,
rather than merely always-zero. Dead UI carrying a live-looking conditional is
what `CLAUDE.md` Architecture 9's fourth variant is about: a reader finds the
branch, assumes it means something, and reasons from it.

**Scope note, and it bounds the deletion.** This removes the warranty from the
**Test Bed's rendered breakdown**. It does not touch `calculateHardwareAndWarranty`
or the `hwWarranty` row the shared `buildCostGroup` still returns: that engine
is shared unchanged with the priced Opportunity path, and `warrantyPct: 0` is
already how a Test Bed neutralises it **by data rather than by a divergent code
path**. The reason is recorded at `src/routes/test-beds.js:24` and it stands.
**This round changes what is rendered, not what is computed.**

### Confirmed as measured, no change

- **Q2**: one formatter, the estate standard `$4,200`, en-US, 0dp. Not the old
  `USD 4,200.00`. Reuse, do not write a fifth.
- **Q5**: the score card reads the **record payload**. `ScoreEntry` is widened
  to what is actually stored.
- **L3 testids**: `tb-card-*` re-pointed with a disposition each (Verification 41).
- **Typing**: `costBreakdown` goes from `unknown` to the real interface.
  **`*Cost` fields only, never `*Price`.**

### Carried, not this round

`INTERACTION_STANDARDS.md` Sections 6, 8, 9 and 10 describe the retired
`frontend/test-bed-detail.js`. Vacuous green. Its own fix.

## Phase 1: build and verify

Render L1. Restore L2, L3, L4.

### What must be proven, and how

**L1, the live path.** Type a sensor count. Then:

- the breakdown **updates**, once, roughly 400ms after the last keystroke, not
  per character;
- the **four cards** render;
- **Total Cost is the first row** of the Cost summary card;
- every rendered figure **equals what the route returned**;
- the hardware labels **quote the draft**, not the stored value, while the
  preview is showing;
- the **unsaved marker is in the card title**;
- **no price or margin figure** appears anywhere on the tab.

**On the figures.** Read the route's JSON in the same run and compare it with
the rendered text. Do not recompute the expected numbers by hand:
`CLAUDE.md` Verification 20 records a test that asserted `10 units` where the
calculator ceilings to 11, and a hand-computed expectation that happens to
agree today is the bad case rather than the good one. The claim is *the screen
shows what the route sent*, and that is a comparison, not an arithmetic.

**On the wait.** `CLAUDE.md` Verification 6 and 7: never a fixed delay, and
before waiting state the counterfactual. `tb-cost-breakdown` exists either
way, so waiting on the container proves nothing. Wait on **rendered text that
only a filled breakdown can produce**, and note the write-side clause too: a
React-controlled input is driven with real keyboard events, because a
synthetic `.value` write is deduped by React's value tracker and reads back as
filled while the component's state never received it.

**Assert the relationship, not the CSS.** Verification 4's clause: `.ref-cards`
being `grid` is the mechanism. The claim is that the four cards share a row
where there is width for it, and that Total Cost sits above the three category
rows. Assert equal `getBoundingClientRect().top` for the cards, and Total
Cost's `top` less than Hardware's.

**And a layout class is sized for a population.** `.ref-cards` under
`#view-test-bed-detail` carries a `minmax(280px, 420px)` cap. Four cards is a
different population from two. Measure at **1240, 1920 and 3440**
(Verification 10), before and after, and confirm no wrap that was not intended.

**L2, L3, L4.** The score card present with real values on a scored record;
three rate cards with their `$ / unit` and `$ / unit / month` annotations; the
sub-tab strip present with its three panes and the open pane surviving a save.

**A restore is two claims** (Verification 7). What arrived, and what was
already there and must remain. L3 rearranges a card that four call sites
assert against, and L4 moves three existing cards into panes. Assert the
**count**: exactly one instance of each, not at least one. Round 10 shipped a
duplicate Summary that the business found, and it is the reason this sentence
is here.

**Open the screenshot** (Verification 4). Every item in this round is about
prominence and ordering, which is the one thing no assertion measures. Three
of Group A's defects were found this way after every assertion was green.

### Housekeeping, so the close can count

- **The branch exists before Phase 1 and every phase boundary commits**
  (build discipline 9). Currently on `round-testbed-recovery`.
- **Restart the API server before any probe that measures a `src/` change**,
  and say so in the report. The dev server has no `--watch` and a probe cannot
  see a stale one. This round should not touch `src/`; if it does, the clause
  applies.
- **The phase count is TWO**, Phase 0 and Phase 1, stated here so the close
  counts sign-offs against a real number rather than grepping for headings
  (build discipline 7). **Any ruling given in conversation is appended to this
  brief at the phase it launches**, not discovered at the close.
- **`CURRENT_STATE.md`**: this round should change no watched source. If it
  does, regenerate.

---

## Known-stale documentation this round will touch, recorded and NOT fixed

From the documentation audit taken before this round, `CLAUDE.md` rule 10:
recorded, scoped, queued, and the queued work carries on.

**`INTERACTION_STANDARDS.md` describes the Test Bed against a deleted file.**
Sections 6, 8, 9 and 10 cite `frontend/test-bed-detail.js` four times and
`frontend/opportunity-reference.js` once. Neither file exists. Four cited
function names resolve to zero code files. Its gate passes because it examines
97 of the document's 175 backticked spans and can see neither a path nor a
name written with call parentheses.

**So do not read Section 9's Test Bed row as current**, and do not treat the
green `standards-staleness` stage as evidence about it. Reconciling that
document is its own round.

---

## The stop

**Stop for sign-off at the end of each phase. Nothing pushes.**

John walks the Commercials tab. The walk is the control for this round's fault
class: `DESIGN_PRINCIPLES.md` records, measured over three rounds, that the
proxy family - an assertion that validates the change just made rather than
testing the requirement - is not fully rule-preventable, and that work resting
on it must budget the walk rather than the suite.
