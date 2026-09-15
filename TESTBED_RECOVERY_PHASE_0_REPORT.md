# Phase 0: what the old Test Bed actually did

A read of the pre-migration code, not a design. Sources, both at
`54001c5^` - the commit before *"Round 8 Phase 2: the two vanilla surface
files retired"*:

- `frontend/test-bed-detail.js`, 3,281 lines
- `frontend/index.html`, the `#view-test-bed-detail` block, lines 702-1406

The "new" side is `round-testbed-state`, i.e. the Test Bed as it stands
after last round's R1/R2/R3.

---

## The headline, before the detail

**The migration dropped far less than "lots of things". It dropped one big
thing, one small card, and it flattened two structures.** Every other
capability I could name in the old code is present in React under a
different name.

**But the one big thing is worse than "missing".** The Test Bed still
computes the full cost breakdown on every keystroke, sends it to the
server, gets it back - **and throws it away**. The container that should
display it renders two words and nothing else.

---

## 1. THE COMMERCIALS CALCULATION

### What still works today

| piece | state |
|---|---|
| the engine, `calculateTestBedCost` (`src/lib/deal-calculator.js:376`) | **alive** |
| the route, `POST /api/test-beds/calculate` (`src/routes/test-beds.js:108`) | **alive** |
| the debounced preview runner, `createPreviewRunner` | **alive, and firing** - `TestBedHost.tsx:351` schedules it on every draft change |
| **the render** | **never built in React** |

`tb-cost-breakdown` in the React tree is this, and only this:

```jsx
<div data-testid="tb-cost-breakdown" className={preview ? 'tb-cost-unsaved' : undefined}>
  {preview ? <span data-testid="tb-cost-preview-marker">Unsaved figures</span> : null}
</div>
```

The breakdown data is received into `setPreview(data)` and **never read
again**. `git log -S "tb-cost-breakdown" -- frontend-react/src` returns two
commits: `7d4a90b`, which created the empty container at the swap, and last
round's card move. **It was never filled.** `costBreakdown` is even typed
`unknown` on the host's props (`TestBedHost.tsx:70`).

This is the signature `CLAUDE.md` Architecture 9 already records: a
container that is written and never read, which the estate has been caught
by before with *"No assessments configured for this stage."*

### The old logic, to rebuild faithfully

**THE BROWSER ADDS UP NOTHING.** That is the old code's own capital-letter
comment, and it is the design: the client sends draft inputs to the server
and renders whatever comes back. A preview and a save cannot disagree,
because they are the same function over the same values.

**Inputs** - `TB_COST_INPUT_KEYS`, thirteen keys:

```
safesightCameras   airQualitySensors   hemirSensors      <- the counts
ssUnitCost         aqUnitCost          hemirUnitCost     <- hardware rates
ssInstallCost      aqInstallCost       hemirInstallCost  <- install rates
ssHostingCost      aqHostingCost       hemirHostingCost  <- hosting rates
testBedDuration                                          <- months
```

That list is duplicated in the route's body schema **on purpose** - one is
the contract, one is the caller - and `scripts/tests/cost-preview.test.mjs`
parses both files and asserts they are identical. The reason is recorded:
Fastify silently strips body keys the schema does not name, so a key
misspelled in the caller would compute as zero and show a confident wrong
total.

**The trigger** - debounced 400ms after the last keystroke. Not per
keystroke (a round trip per character), and deliberately not on blur: the
complaint being fixed was that the total reads zero *while* values sit on
screen, and a blur trigger leaves it stale for exactly as long as the
person is looking at the number they just typed.

**When nothing cost-related is dirty**, the preview is dropped and the
stored breakdown becomes the truth again.

**On a failed preview**, it falls back to the stored breakdown rather than
leaving a wrong number on screen wearing the unsaved marker.

**The display: four cards in a `.ref-cards` grid.**

```
Cost summary                 Hardware
  Total Cost      <- first     SafeSight (12 x $4,200.00)
  Hardware                     Air Quality (6 x $2,000.00)
  Installation                 HEMIR (1 x $100,000.00)
  Hosting x 36 months          Warranty (2 units)      <- only when > 0
                               Hardware subtotal

Installation                 Hosting (per month)
  SafeSight                    SafeSight
  Air Quality                  Air Quality
  HEMIR                        HEMIR
  Installation subtotal        Hosting subtotal / month
```

Three details that were deliberate and are worth keeping:

- **Total Cost is FIRST, not last.** A departure from the conventional
  read, measured: total-last put it 185px lower and below the fold at 1240
  and 1920; total-first costs 45px, which is exactly the card's own chrome.
- **The hardware labels quote the DRAFT inputs while previewing.**
  Otherwise a row reads `SafeSight (12 x $4,200.00)` beside a figure
  computed from 14 - a row that contradicts itself.
- **The unsaved marker sits in the card's own title**, not in the save bar.
  A total a person cannot tell apart from a saved one makes the save bar
  advisory.

### Where the unit costs came from - John's premise is half right

**In the old Test Bed, unit costs were hand-typed payload fields on each
record.** Three editable cards: `Hardware Cost Rates ($ / unit)`,
`Installation Cost Rates ($ / unit)`, `Hosting Cost Rates ($ / unit / month)`.

**The Admin catalog exists and matches John's description exactly** -
`base_cost_batches`, per batch, three products:

| product | unit_cost |
|---|---|
| safesight | 8,000 |
| air_quality | 2,000 |
| hemir | 100,000 |

It is read by `deals.js`, `opportunities.js` and `deal-sheet-versions.js`
through `resolveCurrentBatches` / `catalogToRates`.

**It has never been read by the Test Bed.** `resolveCurrentBatches` appears
zero times in the old `test-bed-detail.js`, and
`git log --all -S "resolveCurrentBatches" -- src/routes/test-beds.js`
returns **no commits at all**. Nor is it seeded from `system_defaults`,
which holds no unit costs.

> **So "unit costs live in Admin" is true of the Opportunity side and has
> never been true of the Test Bed. Wiring the Test Bed to the catalog is a
> NEW FEATURE, not a recovery** - and it is a good one, but it should be
> scoped as new work rather than as restoring something that was lost.

---

## 2. USE CASES

**The old version had it as a free-text input, not a selectable list.**

```html
<div id="tb-usecases-list"></div>
<input type="text" id="tb-usecase-input" placeholder="Add a use case">
<button class="btn-sm" id="tb-usecase-add">Add</button>
```

`addTbUseCase` appended the typed string to `payload.useCases` and saved;
`removeTbUseCase` filtered by index. No taxonomy, no vertical, no options.

**The current React version is the same free-text input** - `tb-usecase-input`
is present in `UseCasesList.tsx`.

> **Use Cases was NOT lost in the migration.** The
> industry-vertical-driven dropdown from an Admin taxonomy is a **NEW
> FEATURE**, and the old code offers nothing to rebuild from.

---

## 3. THE FULL OLD-vs-NEW INVENTORY

### Method, and what it cannot see

I compared 89 old `tb-` ids against every testid and id the React tree
emits. **That raw diff said 39 were absent and it overstates the loss
badly** - most are renamed containers whose capability survives
(`tb-save-all` is now `tb-react-save-all`, the notes ids are now `cd-`).
So each was then classified by **capability**, not by name.

What this method cannot see: anything the old version did that had no id,
and anything in a save path rather than a render. Both are recorded gaps.

### Genuinely lost

| # | what | evidence |
|---|---|---|
| **L1** | **The itemized cost breakdown** - all four cards | no renderer anywhere in `frontend-react/src/testbed/`; container never filled |
| **L2** | **The Reference tab's `Qualification score` card** | `tb-score-summary` appears 0 times in React |
| **L3** | **The three rate cards, and their units** | old: three titled cards stating `$ / unit` and `$ / unit / month`. New: one `Commercials` card of nine rows whose labels state neither |
| **L4** | **The Reference sub-tab strip** | `tb-ref-subtabs` absent. Old: `Use cases | Customer documents | History` as panes. New: three cards stacked on Reference |

**L2 in detail**, so it can be rebuilt: one row per scoring criterion, each
showing the criterion name, the **current** (latest) score or `Not scored`,
and **the stage that score was recorded at**. Sub-line: *"Recorded on the
stage tabs."* Display only - deliberately no control, because the card's
whole job is to say where scoring happens.

### NOT lost - verified present in React

Units pane, scoring, measurability, buyer contacts, the stage chevron, the
unit count lock, the closed-record panel, customer documents, use cases,
install notes (`InstallSection.tsx`), notes, summary, key dates, Terminus
/ Customer / Site details, exit criteria, approvals, lifecycle documents,
stage panels. The tab structure is unchanged: the same ten tabs, same keys.

### Where the perception of "lots missing" probably comes from

The **Commercials tab** is the tab that lost things, and it lost the
visible ones. Its breakdown is blank, its three rate cards became one flat
list, and the total - the one figure the tab exists to produce - is not on
screen at all. A person opening that tab sees nine empty cost rows and no
number.

---

## What this report does NOT establish

- **Whether anything was lost from a SAVE PATH** rather than a render. The
  id comparison cannot see a derived note, an audit row or a counter that
  the old save wrote and the new one does not. `CLAUDE.md` Verification 49
  records exactly this gap, and closing it is a separate enumeration.
- **Whether the old behaviours still work in the old code.** I read it; I
  did not run it. The old file is deleted and its route callers have moved.
- **Anything about the Opportunity or Contact surfaces.** Out of scope.
- **The four fix buckets are recorded in the brief and NOT measured here.**
  Layout, account dialogue and white buttons were not inventoried; this
  phase answered the three questions asked.

## Recommended scope split, for the ruling

- **L1 is the recovery round.** It is the largest, it is genuinely lost,
  and the old code specifies it completely - including the four-card
  layout, the draft-quoting labels, the total-first ordering and the
  unsaved marker. The server half is alive, so this is a render plus a
  wiring, not a rebuild.
- **L2 is small and self-contained**, and belongs with L1.
- **L3 and L4 are restructures, not losses**, and belong in the LAYOUT
  bucket with the other placement items.
- **Use Cases as a taxonomy dropdown, and Test Bed unit costs from the
  Admin catalog, are both NEW FEATURES.** Neither existed. They should be
  scoped and ruled as new work, and the catalog one needs a decision the
  old code cannot supply: whether a Test Bed's rates are seeded from the
  catalog at creation and then editable, or read live - which is
  `CLAUDE.md` Architecture 11, a default is an initial value, not a
  fallback.
