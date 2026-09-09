# Test Bed header and cost carry-forward, Phase 0: report

Read-only against product code after A1. Nothing pushed.

## A1: the phantom suite entries

**The carried item named one. There were two.**

    scripts/tests/vanilla-coupling.test.mjs     deleted a763653, Round 6
    scripts/tests/reference-coupling.test.mjs   retired 912ad8a, same round

`node --test` exits 1 on a missing file ALONE and ignores it silently beside a
real one, so the suite reported green over two dead names for several rounds.
A guard for the one known name would have passed while the second rode green,
so the check reconciles the WHOLE list across every `test*` script.

Calibrated: a phantom in `test` fires, a phantom in `test:db` fires (it watches
every suite, not the one that had a problem), healthy passes, `package.json`
byte-identical. Its own zero is a measurement: a second test runs the scan
against a synthetic phantom and asserts it is seen. **Pure suite 504/504.**

## 1. Test Bed record fields

Instrument: the live database - 968 Test Bed records, latest revision payload
per record, chunked queries.

| field | finding |
|---|---|
| **Total Cost** | `accumulated_cost` in the payload, **stored**, maintained by `PATCH /test-beds/:id`. `indicativeCost` sits beside it and tracks it closely: 30 beds have `accumulated_cost > 0`, 29 have `indicativeCost > 0`, both max 164,000. **Two fields, one concept - which one the strip reads is a decision, not a lookup** |
| **Duration** | `testBedDuration`, **stored**, in the write allowlist at `test-beds.js:480`. NOT derived from the two dates |
| **Est Start** | `estimatedInstallationDate`, stored (100 of 114 revisions) |
| **Proj End** | `estGoLiveDate`, stored (100 of 114) |
| **Hardware counts** | `UNIT_TYPE_COUNT_KEYS` in `src/lib/units.js` is the declared list: SafeSight -> `safesightCameras`, Air Quality -> `airQualitySensors`, HEMIR -> `hemirSensors` |

**The hardware counts have TWO SOURCES and they differ in coverage.** Measured
across 9 live beds:

    payload keys        safesightCameras 8/9, airQualitySensors 4/9, hemirSensors 0/9
    unit-slot records   present on 2 of 9 beds
    where both exist    they AGREE (1/2 vs SafeSight:1 AirQuality:2; 3/2 vs 3/2)

A strip reading unit-slot records would show 0/0/0 on seven of nine beds. **The
payload is the populated source.** `hemirSensors` is declared in code and
carried by no live bed, so the HM cell will read `--` or 0 on every current
record - a display decision for Phase 1, not a missing field.

**Test Bed stages, from `stage_definitions`:** Qualification, Pre-Site
Assessment, Site Assessment, Installation and Commissioning, Monitoring and
Analysis, Review and Completion, Decommissioning, Closed. **Eight**, against the
Opportunity's seven, and none marked terminal.

## 2. The live Test Bed detail surface

**Fully React, and cleaner than the Opportunity.** `main.tsx` mounts the whole
view on `#view-test-bed-detail` and clears the static markup on first render.

**No retired duplicate shadows it.** Measured inside the view's own section of
`index.html`: **zero** `-vanilla` blocks and **zero** `-root` sub-mounts. The
estate's three known duplicates are all on Opportunity surfaces. This screen is
clean, and that was checked rather than assumed.

`frontend-react/src/testbed/ViewHeader.tsx` already renders the title, a client
sub-line and the read-only banner. **W1 extends an existing component**, it does
not build a new one.

## 3. The Opportunity chevron

**It takes stages AS DATA.** `app.js`:

    const stages = await fetchStages('opportunity')
    renderChevronStrip('opp-chevron-strip', opp.status, stages)

`fetchStages(recordType)` is already parameterised, and `renderChevronStrip`
takes the element id, the current status and the stage list. **Reuse, not
parameterise: the work is already done.**

**AND A TEST BED CHEVRON CONTAINER ALREADY EXISTS AND IS DEAD.**
`index.html:822` carries `<div id="tb-chevron-strip" class="chevron-strip">`
and **nothing renders into it** - no reference in `app.js` or the React tree.
It is an empty container awaiting exactly this work.

## 4 and 5. Cost carry-forward: THE MECHANISM ALREADY EXISTS

**W2 is not blocked on design. It is built, and it works.**

    src/routes/test-beds.js:1536   p_test_bed_cost: bedPayload.accumulated_cost ?? null
    convert_test_bed (migration)   writes opportunity_details.test_bed_cost
                                   and records it in the audit detail

Read by four consumers: `deals.js:89`, `deal-sheet-versions.js:229`, and
`opportunities.js:103` and `:349`, where it feeds
`totalContractValue(payload, catalog, det.test_bed_cost ?? 0)`.

**Proven on live data, with both sides present.** 120 opportunities were
converted from a Test Bed. A first pass compared ten and found ten agreeing -
**at zero on both sides, which proves the plumbing runs and nothing about a
value transferring.** Restricted to pairs where BOTH sides are non-zero:

    6 pairs, all agreeing, bed.accumulated_cost == opp.test_bed_cost

The value is `12345.67` on all six, so this is fixture data rather than
business data. It establishes that a non-zero cost transfers correctly.

**So item 5's question changes shape.** The options are not "where should a
carried cost live" but:

| option | trade-off |
|---|---|
| **Leave as is** | One number, `accumulated_cost` -> `test_bed_cost`, already feeding TCV. Nothing to build. Carries no detail: the opportunity cannot see WHAT the cost was made of |
| **Carry the line items** | `ssUnitCost`, `ssInstallCost`, `ssHostingCost`, `aq*`, `hemirHostingCost` exist on the bed. Richer, and the opportunity's own cost model is a different shape, so a mapping must be designed |
| **Linked reference** | Opportunity reads the bed's costs live through `converted_from_test_bed_id`, which is already stored. No duplication, but the number then MOVES when somebody edits the bed after conversion |

**No position taken.** The shape is John's call, and the first question is
whether the existing single-number carry-forward is what "carry forward for
consideration" already means.

## 6. Door check

**The Test Bed view does NOT get the JS half of the door.**

`applyReadOnlyControls` has exactly two call sites, both
`'view-opportunity-detail'`. It is **never called for the Test Bed view.**

What the Test Bed view does have: it sets `is-not-mine` itself
(`TestBedView.tsx:105`), so the CSS half applies - `pointer-events: none` and
opacity on inputs, textareas and selects - and `TestBedHost` consults
`canEditFields()` while rendering, so the React tree guards its own rows.

What it does not have: the sweep's `disabled` on form controls, `is-inert-action`
on action buttons, the widget neutralisation built last round, and the
MutationObserver that re-applies all of it to late-rendered content.

**The shared enumerator will see the header's controls either way** - it
enumerates by DOM properties, not by what the door did - so W1 is measurable
whichever way this is decided.

## W1 and W2 feasibility

**W1: feasible, and smaller than it looks.** The header component exists, the
chevron renderer takes stages as data, the Test Bed chevron container already
exists, every strip field is a stored payload key, and the stage list comes from
`stage_definitions`. No new mechanism is needed.

**W2: already built.** The measurement's job now is to tell John what exists so
he can say whether it is what he meant.

## Decisions Phase 1 needs from John

1. **Total Cost: `accumulated_cost` or `indicativeCost`?** Two stored fields
   track the same concept. The strip must read one.
2. **The HM cell reads nothing today.** `hemirSensors` is declared and unused on
   every live bed. Show `--`, show `0`, or hide the third count until a bed has
   one?
3. **SS / AQ / HM labels, or names above numbers?** The brief allows either and
   asks for the choice to be recorded. This needs the strip's visual style
   settled, which is a look decision.
4. **W2: is the existing single-number carry-forward what you meant?** If yes,
   W2 is closed by measurement. If not, options are in section 5 and the shape
   is yours.
5. **Does the Test Bed view get the JS door sweep?** The header is display-only,
   so W1 may not need it - but the view lacks it today and that is a standing
   gap, not something this round introduced.

## What this phase does NOT establish

- Nothing about how the strip should LOOK; no layout was measured.
- Whether `accumulated_cost` is maintained correctly - only where it lives.
- The unit-slot vs payload disagreement is measured on 9 live beds, not on the
  968 including deleted.
- No door measurement of the Test Bed view was run: item 6 is a source finding,
  and the probe measures the Opportunity view only.
