# Probe inventory: Phase 0 report

Measured 2026-09-13 on `af31d96`. Read-only. **Nothing was fixed.**

---

## 0. THE FINDING THAT ARRIVED UNINVITED, AND IT IS THE MOST SERIOUS ONE

**The gate is intermittently red, and its own suite is the cause.**

The first commit of this round was **REFUSED by the pre-commit hook**:

```
✖ INVARIANT 2: no gate rule names a stage absent from stage_definitions
  AssertionError: gate rules naming a stage that does not exist
```

The same suite had been green twenty minutes earlier at the previous
round's close, and was green again on the next run. Queried directly:
**zero orphaned rows on disk.** The rows existed only while something was
mid-flight.

**The mechanism, measured.** Two files assert the same claim:

| file | the orphan filter |
|---|---|
| `scripts/tests/gates.test.mjs` | `.filter(r => r.record_type !== TYPE)` then the orphan check |
| `scripts/tests/config-invariants.test.mjs` | **no such filter** |

`gates.test.mjs` says why, in its own comment: *"Fixture rules use a
synthetic record_type with no stage_definitions rows at all, so they are
excluded by record_type."* **`config-invariants.test.mjs` does not know
that.** And `test:db` runs its ten files through `node --test` with **no
`--test-concurrency` flag on an 8-CPU machine**, so they run in parallel and
one file's live fixtures are visible to the other's whole-table scan.

> **Verification 20 - two readers of one value - arriving inside the test
> suite, where the consequence is that a green gate is a coin toss.**

This matters more than anything else in this report: **every "the gate is
green" claim this estate makes rests on a suite that races against itself**,
and a red is presently indistinguishable from a real finding without
querying the table by hand. Recorded, not fixed (R1).

---

## 1. The population

| | count |
|---|---|
| files under `scripts/` | 290 |
| of those, containing an assertion | 255 |
| minus LIBRARIES (imported by another file) | -11 |
| **= the detector population** | **244** |
| React test files | 53 |
| routes the server serves | 76 |

**A library is not a detector**, and the distinction is structural rather
than a name: a library is imported, a detector is only executed. The first
draft of the Q1 sweep counted `api-client.mjs`, `fixtures.mjs` and
`create-test-user.js` as detectors because they contain `throw new Error`.

---

## 2. Q1 - WIRING. **162 of 244 detectors are run by nothing.**

**CALIBRATION, both directions, on known cases:**

```
known WIRED   scripts/tests/config-invariants.test.mjs
   in population: true    flagged unwired: false   (must be FALSE)  PASS
known UNWIRED scripts/leads/probe-gated-fields-reachable.mjs
   in population: true    flagged unwired: true    (must be TRUE)   PASS
```

**Spot-checked beyond the calibration**, because two points is thin for a
244-file population: `check-state-fresh.mjs`, `create-test-user.js`,
`calibrate-freeze.mjs`, `probe-scrollable.mjs` and `census-form-identity.mjs`
are named in `verify-all.mjs` **zero** times, in `package.json` **zero**
times and in the hooks **zero** times. They are genuinely unrun.

| | count |
|---|---|
| detectors wired to a runner | 82 |
| **UNWIRED - nothing runs these** | **162** |
| of the unwired, needing a browser | 82 |
| of the unwired, fast (no browser) | 80 |

**`scripts/check-state-fresh.mjs` is among the unwired**, which is worth
naming on its own: the `CURRENT_STATE.md` staleness check the method
requires at every close is a manual step that no runner enforces.

---

## 3. Q2 - RUNNING BUT ROTTED

### 3a. Dead identifiers: raw 140, real **4**

**CALIBRATION:** a known-live id (`cd-card-account`, screenshotted this
week) is recognised as live; a synthetic absent id is not. PASS both ways.

**The refinement path is itself the finding.** Three false-positive classes,
each found by reading the output rather than trusting the count:

| stage | count |
|---|---|
| RAW: ids matching no producer literal | **140** across 44 files |
| minus TEMPLATE-GENERATED (`display-${key}`) and SELF-RENDERED fixtures | -128 |
| = unexplained | **12** across 6 files |
| minus SUFFIX-TEMPLATED (`` `${testid}-name` ``), found by hand | -5 |
| minus harness-injected fixtures, found by hand | -3 |
| **= genuinely rotted assertions** | **4** |

**The four, each verified by hand:**

| identifier | file | why it is dead |
|---|---|---|
| `ref-display-country` | `round5/vanilla-reference-walk.mjs` | `page.click` on a vanilla surface since migrated to React |
| `ref-edit-country` | same | same |
| **`cd-notes-empty`** | `round6/walk-contact.mjs` | asserts `/no notes yet/` - **which the LEAD CARD UI FIXES round deliberately DELETED** |
| `tb-input-city` | `round7/walk-tb-save.mjs` | a `waitForFunction` whose failure is swallowed by `.catch(() => {})` |

**`cd-notes-empty` is Round B's finding arriving by a different route.** A
round deliberately removed a thing; a walk still asserts its presence; **the
walk is unwired, so nothing has run it to notice.**

**ALL FOUR ARE IN UNWIRED FILES. ZERO ARE IN GATE STAGES.**

### 3b. Calls to routes that do not exist: **0**

**CALIBRATION:** `GET /contacts` recognised as served; `GET /api/stages` -
the route Round 7 actually shipped in error - recognised as absent. PASS.

15 raw hits, **all false positives** and each named: a caller CENSUS that
lists routes as data, an `api-client` test using synthetic paths against a
stubbed fetch, and two real calls whose query strings broke the shape
matcher (`/records/:id/exit-criteria?stage=` and `/scoring-criteria?...`,
both confirmed served in `src/routes/`).

### 3c. THE RUN-BASED ROT RATE IS **UNMEASURED**, AND HERE IS WHY

The most valuable number in this round would be: *of the 162 unwired
detectors, what fraction are dead?* Round B has the only data point - one
tried, one dead.

**It cannot be measured under R1.** Screened for write verbs, **nearly every
fast unwired probe builds fixtures** - 8 to 11 write verbs each. Running the
sample would be a data change in a round ruled read-only. And the
`inject-*.mjs` harnesses **mutate source files**, so they were excluded
outright rather than merely skipped.

> **Stated rather than estimated: the rot rate of the unwired 162 is
> unknown. The static scans above cover identifiers and routes only.**

---

## 4. Q3 - BLIND. Bounded by ruling (R3), and NOT exhaustive

**This is the four families this estate has PROVEN, measured across the
population, plus hand verification. It is not a general search for blindness
and does not claim to be.**

**CALIBRATION:** a proven-blind file (`grid-width/probe-p0.mjs`, headless
scrollbar read) is flagged; a proven-discriminating one
(`grid-width/probe-p1.mjs`, headed) is not. PASS both ways. The sweep also
**reports that it matches its own source** and excludes itself by name
rather than skipping silently (Verification 39's Round 8 clause).

| family | detectors touching it | without the mitigation |
|---|---|---|
| headless-blind: scrollbar geometry | 5 | **4** |
| attribute vs visibility | 23 | **13** |
| property vs outcome: "scrollable" | 9 | **0** |
| wrong axis: `scrollTop` without `scrollLeft` | 4 | **4** |

**Scoped to DETECTORS**, after a first run flagged `StagePanel.tsx`,
`Modal.tsx` and `VersionCard.tsx` - production components SETTING `hidden`,
which is behaviour, not a measurement. Only a file that asserts can assert
blindly.

**attribute vs visibility, the 13** - the family UI STANDARDS - LEADS proved
and the largest live exposure:

```
scripts/leads/probe-gated-fields-reachable.mjs   scripts/leads/probe-lead-door.mjs
scripts/round7/inject-phase-2b.mjs               scripts/round7/walk-tb-2e.mjs
scripts/tests/transition-requests.test.mjs   <-- A GATE STAGE
frontend-react/src/__tests__/  a12-four-surfaces, account-surface, field-row-select,
   field-row, reference-surface, testbed-door, ui-shell, version-card   <-- ALL GATE STAGES
```

**wrong axis, the 4** - including `leads-cleanup/probe-p1-lcc.mjs`, the
proven instance that shipped a broken modal.

---

## 5. CROSS-CUT: the scrollbar-blind family is **4 files, all in one directory**

| file | status |
|---|---|
| `grid-width/probe-p0.mjs` | a Phase 0 diagnostic, documented blind, superseded |
| `grid-width/probe-p0b.mjs` | same |
| `grid-width/calibrate-barmeasure.mjs` | the harness that PROVED the blindness |
| `grid-width/calibrate-p1.mjs` | false positive - it drives the HEADED `probe-p1` |

> **The estate does not read scrollbars anywhere else.** The claim "every
> headless scrollbar reading this estate has taken has been blind" is true
> and covers a population of four files in one round's own directory. **It
> is a smaller exposure than it sounded.**

---

## 6. PRIORITISED FINDINGS

**P1 - THE RACING GATE.** `config-invariants.test.mjs` INVARIANT 2 lacks the
synthetic-record_type exclusion `gates.test.mjs` carries, and the ten
`test:db` files run in parallel. **Refuses commits at random and makes every
green a coin toss.** Highest priority: it degrades every other claim.

**P2 - THE 13 ATTRIBUTE-VS-VISIBILITY DETECTORS, NINE OF THEM GATE STAGES.**
This family has already shipped a defect (three Section 5 checks reporting
CONFORMS on an element never displayed). Nine are in the React suite the
gate runs, so they are actively trusted.

**P3 - `check-state-fresh.mjs` IS UNWIRED.** The staleness check the method
requires at every close is enforced by nobody.

**P4 - THE FOUR ROTTED ASSERTIONS**, all in unwired walks. `cd-notes-empty`
would fail today. Low blast radius precisely because nothing runs them -
which is also why they rotted.

**P5 - THE UNWIRED 162 AS A CLASS.** Not a defect list; a standing condition.
82 need a browser and can only rot silently.

**P6 - THE FOUR WRONG-AXIS DETECTORS.** One already shipped a broken screen.

### What this bears on, since that was the point of the round

- **R1's surface swap** leans on the React suite. **Nine of its files carry
  the attribute-vs-visibility family (P2).** They are the protection R1's
  re-pointing is meant to preserve, and they are the weakest kind.
- **The Sections 6-11 walk** is a WALK, and every rotted assertion found
  here lives in a walk. `walk-contact.mjs` carries one that fails today.
- **Any feature round** inherits P1: a gate that is red for reasons unrelated
  to the change.

---

## 7. What this report does NOT establish

- **Q3 is not exhaustive and cannot be.** Four proven families and a hand
  check. A fifth family nobody has been bitten by yet would not appear.
- **The rot rate of the 162 unwired detectors is unknown** (3c).
- **No claim that the 82 wired detectors are sound** - only that they pass
  and name live identifiers and real routes. Passing is not the same as
  measuring the right thing, which is this round's entire subject.
- **The racing gate was found by accident**, not by any sweep here. It broke
  a commit while the round about broken detectors was being committed.
