# Migration Round 3, Phase 0: investigation

**2026-09-05.** Numbered against `MIGRATION_ROUND_3_BRIEF.md`'s eight Phase 0
items. Gate green at **20 stages**. No product code. Nothing pushed. Phase 1 not
started.

**Two discrepancies stop the round**, D1 and D2 in section 9, and one of them
removes an item from the brief entirely.

**A note on the brief's own status:** it marks itself **DECISION-GATED [DA]** and
*"Final when ruled"*. Phase 0 is investigation, so it proceeded; the gate is on
Phase 1's scope, not on this.

---

## 1. The panel boundary, measured

**`app.js` never names the Commercials tab.** Measured with comments stripped:
`app.js` contains **0** occurrences of `commercial`, while holding 6
`opp-tab-`, 2 `data-opp-tab` and 4 `oppUserPickedTab`. Calibrated against
known-present controls (`function navigate` 1, `recompute` 14 in the deal
module, `readPayload` 9) so the zero is a measurement and not a broken scan.

**Tab mechanics are GENERIC and live in `createTabStrip`** (`app.js:316`), which
takes a `panelFor` resolver (`app.js:518`, `key => document.getElementById(...)`)
and toggles `.hidden` on the pane. The Commercials pane is one key among several;
nothing in the strip knows what is inside it.

**The mount.** `opportunity-deal.js` exposes exactly **three** globals:

| global | direction | called by |
|---|---|---|
| `initOpportunityDealPanel` | in | the mount |
| `oppCurrentVersionRejection` | out | `renderOppRejectedBanner` (`app.js:1191`) |
| `oppRefreshVersionActions` | out | after stage-approvals resolve (`app.js:8069`) |

**Both outward feeds are optional calls (`?.()`) made at RENDER time, not
cached**, and `app.js` says why at each site: the versions load after the banner
first runs, and the deal module renders before `stage-approvals` resolves, so
without the refresh the approval control would be hidden on every load.

**So the seam `app.js` holds is three functions wide and already explicit.** The
React mount replaces `initOpportunityDealPanel` and must keep supplying the two
outward feeds, because `app.js` calls them by name at moments it chooses.

**Freeze and unfreeze:** `applyLatches` appears **0** times in `app.js`. The
latch interplay is entirely inside the deal module; `app.js` contributes the
freeze banner and the write refusal, not the latch state.

## 2. The form/version seam, measured both directions

Small enough to state as an interface.

| direction | what crosses |
|---|---|
| version reads form | `readPayload()`, `readContractorMilestones()`, `catalogRates`, and one DOM id: `deal-version-reason` |
| version writes form | `populateForm(...)` then `recompute()` |

`saveVersion` is 129 lines and touches the form through exactly those four
things. `restoreVersion` is 24 lines and touches it through exactly two.

**The interim interface, smallest that could stand between them:**

```
readPayload()        -> the payload object the version freezes
readContractorMilestones() -> the schedule the version refuses to freeze if it does not reconcile
catalogRates         -> the rates the version records alongside the inputs
populateForm(payload)-> restore writes the form
recompute()          -> and asks it to re-derive
```

Plus the reason box, which is **version machinery living in the form's DOM** and
is the one thing that should move to Round 4's side of the line rather than be
proxied.

## 3. The input census

**Extracted mechanically from `readPayload`, not transcribed.**

| helper | count | empty-state contract |
|---|---|---|
| `numOrNull` | **16** | empty box -> `null`: no value recorded |
| `emptyToNull` | **2** | empty string -> `null` |
| `num` | **2** | empty -> `0`: a value |
| `numOrUndefined` | **11** (margin overrides) | empty -> key **absent**, which is deletion |

**The 16 `numOrNull`:** `ssExisting`, `ssNew`, `aqm`, `hemir`, `lumpSumCost`,
`inSsExisting`, `inSsNew`, `inAqm`, `inHemir`, `targetMargin`, `warrantyPct`,
`whtPct`, `gstPct`, `fxContingency`, `duration`, `recoveryMonths`.
**The 2 `emptyToNull`:** `bidCurrency`, `proposalCurrency`.
**The 2 `num`:** `factoring.ratePct`, `factoring.termMonths`.
**The 11 `numOrUndefined`:** `MARGIN_KEYS` = `hwSs`, `hwAqm`, `hwHemir`,
`hwWarranty`, `inSsEx`, `inSsNew`, `inAqm`, `inHemir`, `hoSs`, `hoAqm`, `hoHemir`.

**Not read from the form at all** - 7 from the catalog (`ssUnitCost`,
`aqUnitCost`, `hemirUnitCost`, `hoSafesight`, `hoAqm`, `hoHemir` and the note
lines' hidden displays) and 5 from `uiState` (`installResp`, `grossUp`,
`structure`, `invoicing`, `factoring.enabled`, `factoring.method`). **A readonly
input here is a display of a rate, not a record of one**, and the file says so.

**Two array readers:** `milestones: readMilestones()`,
`contractorMilestones: readContractorMilestones()`.

**Live on the default tab: 39 controls** - 35 text, 3 select, 1 textarea, every
one carrying an id. 5 `deal-section`, 4 latch rows, 4 latch buttons.

**THE CORPUS MUST CROSS THE FOUR CONTRACTS, NOT AVERAGE THEM.** `numOrUndefined`
is the dangerous one: an absent box drops the key, and the file records that
this is how 33 opportunities nearly lost their margin overrides. A parity corpus
that never leaves a margin box empty cannot see that.

## 4. The one click-to-edit row: IT DOES NOT EXIST

**Measured three ways, all zero.** See D1.

| source | `ref-field` | `fieldDisplayKeydown` | `ds-row` | `data-key` |
|---|---|---|---|---|
| `opportunity-deal.js` | 0 | 0 | 3 | - |
| `index.html`, commercial panel region only | **0** | **0** | **0** | **0** |
| **live, rendered panel** | **0** | - | **0** | - |

The three `ds-row` in the deal module are in the Deal Summary's read-only
rendering, not a click-to-edit row.

**Item 4 has no subject.** There is nothing to locate, nothing to confirm as a
contract row, and no editor to name.

## 5. Sectioned dirty tracking, enumerated as behaviours

**A genuinely different model from the field row's**, and the enumeration is what
Phase 1 reproduces.

**B1. Dirty is a COMPARISON against a baseline, computed, never a flag.**
`dealDirtyKeys()` = `changedKeys(pickSalespersonWritable(readPayload()),
lastSavedPayload)`. Same principle as field-row behaviour 1, different grain:
**the whole payload against a snapshot**, not per-field draft against per-field
original.

**B2. The cached boolean was DELETED, on purpose.** `dealFormDirty` was a cached
flag kept in step with the comparison; Round 38 removed it as Verification 20 (a
second reader). `isDealFormDirty()` now asks the comparison. **Phase 1 must not
reintroduce a cached flag.**

**B3. The baseline is the SALESPERSON-WRITABLE projection**, not the raw payload:
`lastSavedPayload = pickSalespersonWritable(readPayload())`. So a latched field
changing does not make the form dirty.

**B4. A key maps to a section by an ID CONVENTION, with a prefix fallback.**
`document.getElementById('deal-' + key) ?? document.querySelector('[id^="deal-' +
key + '"]')`, then `sectionOfInput(el)`. The fallback is what lets a milestone
list or a nested group resolve to a section at all.

**B5. Section saves are created and destroyed by need.** `renderSectionSaves()`
walks `.deal-section`, finds each `.latch-row`, and adds or removes a
`.section-save` button according to whether that section is in `dirtySections()`.

**B6. A section save saves the WHOLE deal sheet.** It calls the same `saveDeal`
as the global control. The button is a scroll affordance, not a partial write,
and its own `title` says so.

**B7. `captureSavedBaseline()` re-snapshots and re-renders**, and is the only
thing that clears dirty.

## 6. Coupled tests and probes, with the instrument

**Instrument, stated per the Round 2 close-out rule:** `commercials-wiring.test.mjs`
read through `readCode` (comments stripped), split on `\ntest(`, each block
classified by whether it reads frontend source, reads the stylesheet, or
neither.

| class | blocks | what re-pointing costs |
|---|---|---|
| **behaviour** (jsdom, no source read) | **38** | cheapest: they assert behaviour and should survive a faithful port |
| **source-shape** (reads a `frontend/*.js`) | **17** | the three-part template, one at a time |
| **stylesheet liveness** (reads `style.css`) | **8** | re-point at the React consumer, as `ds-row` was |
| **total** | **63** | |

That 38 of 63 are behavioural is the useful number: **the majority of this
file's value does not depend on the vanilla implementation** and should be
portable, which is the opposite of Round 0's characterisation of the 106 as
"coupled by construction".

## 7. Shell-global inventory

**ZERO bare references to `app.js` scope.** Every cross-module read in
`opportunity-deal.js` is an explicit `window.` access.

**So the `let`/`const` trap that shaped Round 2 does not apply here.** All nine
names it reads are reachable from a bundle:

| name | how it reaches `window` |
|---|---|
| `api`, `navigate`, `openDiscardConfirm` | `function` declarations in `app.js` |
| `getOppLoadedRevision` | `window.getOppLoadedRevision =` (`app.js:7790`) |
| `oppPatch` | `window.oppPatch =` (`app.js:7845`) |
| `oppPendingPricingApproval` | `app.js:1176` |
| `oppVersionGateApplies` | `app.js:1244` |
| `requestPricingApproval` | `app.js:1296` |
| `staleWriteHtml` | `app.js:7565` |

**Six of the nine are explicit `window.X =` assignments**, which survive
modularisation, unlike the implicit function-declaration globals. **Only
`api`, `navigate` and `openDiscardConfirm` are the fragile kind.**

**What the React panel must self-fetch: the catalog.** `GET /api/base-costs`
feeds `catalogRates`, which is module state in the vanilla and is read by
`readPayload` for seven keys. Nothing else needs fetching: the record arrives
through the mount.

## 8. Endpoint census

**Five routes, all through `window.api`:**

| route | purpose | round-trips through `saveDeal`? |
|---|---|---|
| `GET /api/base-costs` | the catalog | no: rates are read from the catalog, never saved |
| `GET /api/opportunities/:id/deal-sheet-versions` | the version list | no: version machinery |
| `POST /api/opportunities/:id/deal-sheet-versions` | take a version | no |
| `POST /api/deal-sheet-versions/:id/issue` | issue | no |
| `POST /api/deal-sheet-versions/:id/restore` | restore | writes the form, does not save it |

**AND THE DEAL SAVE IS NOT ONE OF THEM.** `saveDeal()` calls
**`window.oppPatch(opportunityId, { payload })`** - `app.js` owns the route, the
`expected_revision`, the 409 retry and the revision adoption. The deal module
sends `pickSalespersonWritable(readPayload())` and nothing else.

**What round-trips vs what is live only in the form:**

- **Round-trips:** the 20 helper-read keys, the 11 margin overrides, both
  milestone arrays, and the `uiState`-derived keys - everything
  `pickSalespersonWritable` admits.
- **Live only in the form:** the 7 catalog rates (recomputed from
  `/api/base-costs` on every load, displayed in readonly inputs), and every
  computed figure - results, cash-flow grid, year schedule - which are derived on
  each `recompute()` and never stored.

---

## 9. Discrepancies

### D1. The click-to-edit row that item 4 is about does not exist

`MIGRATION_FIELD_ROW_CONTRACT.md` states **`Opportunity / Commercials | 1
click-to-edit row`**, and the brief builds item 4 on it. **Measured in the
source, in the markup region, and in the live rendered panel: zero.**

The contract's own instrument was *"counting rendered rows on one record per
surface, default tab"*, and re-run now on the Commercials default tab it returns
0 click-to-edit and 0 read-only.

**This does not change the migration's shape** - the panel is a form, and one
row more or less was never load-bearing - but the contract's table is wrong and
should be corrected rather than carried, and **item 4 should be struck from the
brief** rather than answered with a null.

### D2. "15 direct inputs" against 39 measured controls

The same contract row records **15 direct inputs** for Commercials. **Live: 39
controls on the default tab alone** (35 text, 3 select, 1 textarea), before the
detail panel's 11 margin inputs and the installation lines are counted.

`readPayload` alone reads **31** ids directly. The 15 is not a small
undercount; it is a different measurement whose method is not recorded.

**This matters because item 3's census is the parity corpus generator.** A
corpus sized from the contract's 15 would miss more than half the input space,
including all 11 `numOrUndefined` keys - the contract with the deletion
semantics.

### D3, minor: the brief is not final

It marks itself `DECISION-GATED: [DA] ... Final when ruled`. Recorded because
Phase 1's scope depends on that ruling and Phase 0 does not.

---

## 10. Gate

```
MERGE GATE  20 stages  01c1ae8
  PASS  reachability                          100ms
  PASS  session precondition                 1175ms
  PASS  pure suite                 440/440 pass, 0 fail
  PASS  database suite              92/92 pass, 0 fail
  PASS  react suite                133/133 pass, 0 fail
  PASS  react bundle freshness
  PASS  14 HTTP probes
All 20 stages passed.
```

---

## Standing at the close

No product code written. **D1 and D2 need a ruling before Phase 1 can be scoped:
item 4 has no subject, and the census the parity proof depends on is more than
twice the size the contract records.**
