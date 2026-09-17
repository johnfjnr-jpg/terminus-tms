# Test Bed workflow core: the Phase 0 instrument and its evidence

Ruling R6 (TEST_BED_WORKFLOW_CORE_BRIEF.md). The report this indexes is
`TEST_BED_WORKFLOW_CORE_PHASE_0_REPORT.md`.

## The instrument

`probe-p0.mjs` reproduces P0.1 to P0.6 in one run against a tagged fixture
(Account, Test Bed at Qualification, Contact linked to the Account), and
tears the fixture down by tag in `finally`.

**UNWIRED, with the reason.** It builds live records, drives a browser and
takes about a minute, so it is not a gate stage. The phases that close a
claim re-run it as their closing proof.

**Run it with a run label.** `TBCORE_RUN` is required and keys the output
directory, so a closing-proof run cannot overwrite the reading it is compared
against (Verification 44).

```
TBCORE_RUN=<label> PUPPETEER_PATH=/tmp/tms-probe/node_modules/puppeteer \
  PUPPETEER_EXECUTABLE_PATH=<Chrome for Testing 152.0.7977.75 binary> \
  node --env-file=.env scripts/testbed-core/probe-p0.mjs > .verify/tb-core/<label>.txt 2>&1
```

Chrome 153.0.8010.36 refuses localhost with `ERR_ADDRESS_INVALID` on this
machine; 152.0.7977.75 does not.

## What each section reads, and the calibration it carries

| Section | Reading | Calibration in the same run |
|---|---|---|
| P0.3 exit criteria | response shape; panel text; `.tb-crit-row` count; requirements readable in the panel (label or message in its text), out of the response's total | settled wait keyed on `data-stage` |
| P0.2 scoring card | criteria served vs criteria selects rendered; computed display and height | same scope finds the Record scores button |
| P0.1 score record | UI request body and response; host body for a real criterion through the route | fingerprint before and after each POST |
| P0.4 blocked transition | 422 blocking list vs what renders under the tab row | id added in the live DOM only: the list renders |
| P0.5 buyer link | open state after mouse and keyboard; non-GET requests; `record_contacts` count | a registered row on the same card opens with the same click |
| P0.6 measurability | control sweep per tab and sub-tab; requests to `/measurability` | `record scores` found once on Qualification; POSTs seen by the same listener |

## The evidence (not committed: `.verify/` is gitignored)

| Where | What |
|---|---|
| `.verify/tb-core-p0/run1.txt` to `run6.txt` | the aborted runs, each a probe fault named in the Phase 0 report |
| `.verify/tb-core-p0/run7.txt`, `run8.txt` | the two full runs; `run8.txt` is the one the report quotes |
| `.verify/tb-core-p0/network.json`, `results.json` | run8's captured `/api/` traffic and structured readings |
| `.verify/tb-core-p0/tbcore-p0-*.png` | five 1920 captures from run8: Qualification, blocked transition before and after the in-DOM id, buyer row refused, walk end |
| `.verify/tb-core-p0/reach*.txt` | the Chrome 153 vs 152 localhost measurements |
| `.verify/tb-core-p0/diag-door*.txt` | the bisection that turned a probe timeout into the P0.5 finding |
| `.verify/tb-core-p0/residue.txt` | 26 records created, 0 live |
| `.verify/tb-core/p0-committed.txt` and `.verify/tb-core/p0-committed/` | this committed copy, run once from its new location on the unfixed screen: `requirements readable in the panel: 0 of 14` |

Later runs land under `.verify/tb-core/<label>/`.
