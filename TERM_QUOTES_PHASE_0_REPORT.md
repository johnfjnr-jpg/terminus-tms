# TERM_QUOTES Phase 0 report

Round TERM_QUOTES, Phase 0 (read-only), 2026-11-19. Branch `term-quotes` off
`origin/main` 40c4c09 (ls-remote matched before branching). First commit
0bae15d is the brief, verbatim. Nothing in code, schema, settings or live data
was changed. The only writes were tagged probe fixtures for 0-1 (see departures),
torn down; residue before and after: 134 live records, `new-live=0
cfg-moved=none`.

**Stopped for John's rulings on the wipe and the NEEDS RULING items below. No
mockup, no build, no push.**

## Not done, or done differently

- **The first baseline gate run was invalid and is not the baseline.** I
  started it without `PUPPETEER_PATH`; seven browser stages did not run (27 of
  35 passed, exit 1). Rerunning showed a second cause: the scratch puppeteer at
  `/tmp/tms-probe` had been emptied (directories recreated 2026-11-19 00:00 with
  no files, the macOS `/tmp` cleaner's signature), which also skipped one pure
  test (`probe-loader.test.mjs`, "puppeteer is not scratch-installed"). I
  reinstalled it with the gate's own printed recipe
  (`npm i puppeteer --prefix /tmp/tms-probe`), confirmed a browser launches
  (Chrome/157.0.8103.78), and reran. The second run is the baseline.
- **0-1 wrote fixtures**, against "no DB writes". The investigation orders a
  reproduction of a probe that builds its own tagged fixtures (two
  opportunities, two transition requests, two record-scoped approver seats) and
  tears them down. I read 0-1 as authorising that and ran it inside a residue
  bracket: before and after identical, no configuration moved.
- **0-1 did not use "the refreshed approver account".** It was not refreshed:
  `session-ref-approver.json` expired 2026-11-16 and is unchanged since 15 Nov.
  It was not needed either: `probe-decision-feedback` signs in as
  `session-ref.json` and seats that user as the approver through the service
  key. Nothing in this phase needed a second live session.
- **0-2, 0-3 and 0-10's code censuses were done by three read-only agents**
  while the gate ran. I verified the load-bearing claims of each against the
  files before using them (listed in each section); line numbers not
  individually re-checked are marked as the agents' grep hits.

## Baseline gate

On 0bae15d (the brief commit over 40c4c09), NordVPN open but **not connected**
(default route and DNS on `en1`, no tunnel split routes):
**35 of 35 stages passed**, exit 0. Sum of stage times 1126.6s. Pure 1064/1064,
database 106/106, react 1480/1480.

| stage | ms | stage | ms |
|---|---|---|---|
| reachability | 102 | HTTP readonly-view | 60196 |
| session precondition | 915 | probe-gaps layout guard | 187745 |
| pure suite | 5237 | CURRENT_STATE staleness | 199 |
| payload sub-key census | 71 | browser dependency | 758 |
| golden deals | 79 | HTTP write success | 26326 |
| database suite | 140805 | HTTP issue-target | 33554 |
| react typecheck | 803 | HTTP proposal-issued | 40872 |
| react suite | 26751 | HTTP zero-track transition | 20262 |
| react bundle freshness | 627 | calibrations | 47161 |
| HTTP precondition | 30650 | HTTP term pricing settings RLS | 7401 |
| HTTP version-approval | 35243 | HTTP frozen figures | 33992 |
| HTTP pricing-approval | 34996 | HTTP factoring term refusal | 18088 |
| HTTP review-closes | 39009 | browser unpriced contract value | 13651 |
| HTTP term initial-value | 73382 | browser closed-won pricing | 19989 |
| HTTP stage-probability | 56829 | browser term pricing ladder | 15810 |
| HTTP version-gate | 32238 | term pricing layout guard | 35083 |
| HTTP no-freeze | 24984 | | |
| HTTP version-order | 24006 | | |
| HTTP commercial-gate | 38814 | | |

Full output: `.verify/verify-5589521268224166.txt`.

## 0-1 Approval regression: TEST DEFECT

**Reproduced**: `probe-decision-feedback` 7/9, failing "the double-click window
is guarded" on both banners (`5 control(s), all disabled=false` and `7 ...`).

**The probe asserts a rule the product deliberately replaced.** It was last
edited in 84dd83f (2026-09-03), and requires every button on the banner to be
disabled the moment Approve is clicked. Later that day 965e6e4 ("Walk: a clock,
per-track approvals...") changed the guard to one TRACK at a time
(`frontend/app.js:1793-1825`): the banner-wide disable had swallowed two of three
quick approvals on different tracks. Under the new rule the clicked control stays
enabled so a second click reaches the in-flight guard and is told; its opposite
decision on the same track is disabled; other tracks stay live.

**Measured, the ordered sequence** (a scratch copy of the probe; one tick:
click Approve on Commercial, read, click it again, read):

| | pricing banner | stage banner |
|---|---|---|
| before | all decision controls enabled | same |
| after 1st click | Commercial/approved enabled reading "Approving...", **Commercial/rejected DISABLED**, Legal both enabled | same |
| 2nd click | reached `decideRequest` (1 call counted) and hit the guard | same |
| message after 2nd | in `#opp-review-feedback`: "The Commercial decision is still being recorded. Wait for it to finish..." | in `#opp-request-feedback`, same text |
| network | 1 POST `{"track":"Commercial","decision":"approved"}` then 200 | 1 POST then 200 |
| approvals rows | exactly 1, Commercial approved | exactly 1 |
| page errors | none | none |

My first diagnostic read the feedback slot as empty; the slot sits beside the
banner host, not inside it, and my selector looked only inside. Corrected by
reading every `[data-decision-feedback]`. **Not a regression, not environment:
the probe is stale.** No fix in Phase 0; the repoint (assert the per-track
rule, the told second click, one POST, one row) is a queued item.

## 0-2 deal_sheet_versions census of use

Verified against the files: the cost-basis CHECK requires Commercials rate keys
(`20260829000007:35-45`); numbering takes the max over **all** of a record's
rows (`20260829000002:89-94`); the Closed Won derivation picks the newest issued,
approved version regardless of kind (`20261117000002:192-203`).

Schema today: `inputs` jsonb (the Commercials form payload), `rates` jsonb (the
frozen catalog), `frozen_figures` jsonb (calculateDeal output and the page
blocks), `batch_id` (ONE batch), status `draft|issued`, `unique(record_id,
major, minor)`. No `kind`, no `deleted_at`. No code mentions `term_quote`.

| site | file:line | R/W | shape-dep | disposition |
|---|---|---|---|---|
| CHECK `rates_have_cost_basis` | 20260829000007:35-45 | W guard | Y | **kind branch**: requires Commercials rate keys, refuses a term row |
| CHECK `figures_only_when_issued` | 20261117000002:43-45 | W guard | N | stays, both kinds |
| `unique(record_id,major,minor)` | 20260827000006:110 | | N | stays: it IS P1's single sequence |
| fn `deal_sheet_versions_immutable()` | 20261117000002:47-116 | W guard | N | **kind added to its guarded list** (else `version-guard.test.mjs` fails) |
| fn/trg `born_draft` | 20261117000002:118-134 | W guard | N | stays |
| fn `insert_deal_sheet_version` | 20260829000002:38-108 | R/W | N | **kind parameter** (no kind arg today); numbering stays kind-blind, correct for P1 |
| trg `refuse_write_while_frozen` | 20260831000001:185-265 | W guard | N | stays |
| trg `touch_record_freshness` | 20260902000002:138-150 | side effect | N | stays |
| trg `close_superseded_reviews` | 20260903000002:264-312 | R | N | stays kind-blind: a new major of either kind supersedes (P1, R-TQ4) |
| fn `raise_transition_request` Closed Won derivation | 20261117000002:192-203 | R | N | stays kind-blind (P7) |
| fn `base_cost_batches_cited_immutable` | 20260827000007:125-150 | R | N | stays; **does not protect a term quote's batches** (one `batch_id`, see 0-4) |
| RLS select/insert/update_draft | 20260827000006:144; 20260908000002:77-106 | | N | stays |
| `approvalContext`, `versions[0]` | src/routes/deal-sheet-versions.js:86-104 | R | Y | **kind branch** (feeds the approval page) |
| GET versions list | deal-sheet-versions.js:157-224 | R | Y | **kind branch** (approval state via pricingChanged) |
| GET approval-page | deal-sheet-versions.js:237-264 | R | Y | **kind branch** (0-7) |
| GET one version | deal-sheet-versions.js:269-283 | R | N | stays |
| POST version | deal-sheet-versions.js:285-559 | R/W | Y | **kind branch**: contractor reconciliation, resolveRates, no-delta check, frozenTerms are Commercials |
| POST issue | deal-sheet-versions.js:564-806 | R/W | Y | **kind branch**: `rates.rates` non-empty, `buildFrozenFigures` (calculateDeal) |
| POST restore | deal-sheet-versions.js:816-833 | R | Y | **kind branch** at the client: populates the form of the version's kind |
| `loadVersionApproval` | src/routes/transitions.js:135-176 | R | Y | **kind branch** (pricingChanged) |
| raise review/transition checks | src/routes/transition-requests.js:202-215, 276-302, 330-340 | R | N/Y | 202-215 stays; 276-340 **kind branch** (versionApprovalState, issuedProposal) |
| `issuedProposal` | src/lib/transition-requests.js:116-240 | R | Y | **kind branch** (pricingChanged) |
| `versionApprovalState`, `liveVersionApproval`, `lastApprovedVersion` | src/lib/version-approval.js:146, 257, 309 | R | Y | **kind branch** through pricingChanged; approval pairing itself stays |
| `pricingChanged` / `decisionState` | src/lib/version-pricing.js:104-143 | | Y | **kind branch**: compares version inputs with the RECORD payload's Commercials keys |
| `wonHeadline`, `wonVersionsOf` | src/lib/opportunity-headline.js:114-160 | R | Y | **kind branch** (reads `result.totals.contractNet`) |
| `workingVersionOf`, `issuedMajor`, `approvedVersionOf` | opportunity-headline.js:162-237 | | Y/N/Y | **kind branch** where pricingChanged is called; `issuedMajor` stays |
| opportunities list and detail headline | src/routes/opportunities.js:112-131, 370-440 | R | Y | **kind branch** (0-3) |
| `buildApprovalPage`, `buildFrozenFigures`, `withFrozenFigures` | src/lib/approval-page.js:869-1145 | | Y | **kind branch** (0-7) |
| `versionLabel`, `workingVersionLabel` | src/lib/version-label.js:42, 70 | | N | stays (major.minor only) |
| unique-violation message | src/lib/write-errors.js:63 | | N | stays |
| VersionCardHost save/issue/restore | frontend-react/src/versions/VersionCardHost.tsx:21-31, 104-167 | R/W | Y | **kind branch**: the seam is Commercials (0-5) |
| `DealVersion` model | frontend-react/src/versions/model.ts:25-45 | R | N | add `kind`; view helpers stay |
| Closed Won client refusal | frontend-react/src/main.tsx:366-370 | | Y | **kind branch** (P7) |
| vanilla headline labels | frontend/app.js:7331-7353, 8193 | R | N | stays (labels from the route) |
| Commercials-only gate suites | approval-page, frozen-figures, contract-value, version-approval, version-pricing, approved-version, opportunity-headline, approval-renders-snapshot, transition-requests tests | | Y | stay Commercials; **each gains term_quote cases** where its function branches |
| `version-guard.test.mjs` | scripts/tests/version-guard.test.mjs:41-101 | static | N | forces the kind guard decision above |
| `version-atomicity.test.mjs` | scripts/tests/version-atomicity.test.mjs | R/W | partly | stays; term insert case added |
| static route-text scans | milestone-schedule, commercials-wiring, strip-comments, system-defaults, version-label tests | static | N | re-anchored when the route text changes |
| unbounded-select allowlist | scripts/lib/unbounded-select-allowlist.mjs:34, 66-67 | | N | indices may shift with new selects |
| React version tests | frontend-react/src/__tests__/version-card.test.tsx, frozen-figures.test.tsx, version-fixtures.ts | | Y | gain term cases |
| gate HTTP probes posting Commercials versions | probe-version-approval, -pricing-approval, -review-closes, -version-gate, -proposal-issued, -version-order, -issue-target, -no-freeze, -frozen-figures-db | via route | Y | stay Commercials-only (they prove the Commercials path, which R-TQ6 keeps) |
| verify-harness `createVersion` | scripts/verify-harness.mjs:229-241 | W | N | agent read it as passing `p_rates: {}`, which the cost-basis CHECK would refuse; **not verified by me** |
| golden-deal harness | scripts/golden-deals/ | none | | no read or write of the table; stays |

**The latest-row readers are the hazard**: `approvalContext`, `issuedProposal`,
`workingVersionOf`, the POST no-delta check, the issue route's highest-issued
and newest-draft queries all take "the newest row" with no kind filter. Under P1
that is correct for numbering and wrong for every reader that then hands the row
to `pricingChanged`, `buildDealInputs` or `calculateDeal`.

## 0-3 TCV readers

The one definition of unpriced: `src/lib/contract-value.js:18-24`,
`contractValueOf(net)` returns `net` if finite and non-zero, else null; `UNPRICED
= '--'`. It is unit-agnostic, but every caller passes the Commercials
`result.totals.contractNet` in **dollars**; the term engine reports **cents**
(`tcvNetCents` is Base TCV).

| site | field read | today's source | reads a term_quote correctly |
|---|---|---|---|
| live TCV, list and header (`opportunity-headline.js:38-52`) | `calculateDeal(buildDealInputs(payload)).totals.contractNet` | **latest record revision payload** plus today's catalog | N |
| won headline (`opportunity-headline.js:114-136`) | `frozen_figures.result.totals.contractNet`, legacy recompute | the won version | N |
| opportunities list route (`opportunities.js:116-131`) | the two above | record payload / won version | N |
| opportunity detail route (`opportunities.js:401-422`) | the two above | same | N |
| header strip, list columns (`frontend/app.js:7169-7178, 7296-7353`) | route fields | server | N (inherits) |
| pipeline cards (`frontend/app.js:7357-7381`) | **no TCV shown** | | n/a |
| weighted value (`opportunity-headline.js:61-65`) | TCV x probability | derived | N (inherits) |
| Commercials stat strip, statement, rows (`deal/panelParts.tsx:343-365`, `statement.ts`, `rows.ts`) | `result.totals.contractNet` | live client calc | N, and stays Commercials-only |
| approval page ask (`approval-page.js:938-1019`) | `calculateDeal(buildDealInputs(version.inputs))` | latest version | N |
| approval page frozen overlay (`approval-page.js:853-903`) | `frozen_figures.page.ask.contractNet` | issued version | N |
| approval bridge (`approval-page.js:273-380`) | calculateDeal on baseline and now payloads | baseline version vs record | N |
| `/deals/submit` recompute (`src/routes/deals.js:255-330`) | `serverResult.totals.contractNet` | record payload | N, stays Commercials-only |

No DB view, generated column or function computes a TCV. The term screen shows
its own Base/Final TCV locally and none of it reaches any site above.

## 0-4 Term engine settings

The engine reads exactly seven settings plus catalog costs
(`normaliseParams`, `src/lib/term-pricing.js:281-341`; `buildParams`,
`src/lib/term-pricing-settings.js:89-100`):

| setting | storage | admin editable | versioned / immutable |
|---|---|---|---|
| TERMS | `term_pricing_settings` row (key/value jsonb) | Y (settings PUT, admin RLS) | N: overwritten in place; per-row `updated_at`, `updated_by` |
| COMPARE_TERM | same | Y | N |
| PRICE_LADDER_BY_PRODUCT | same, own route `PUT /price-ladder/:product` | Y | N |
| VOLUME_BANDS_BY_PRODUCT | same, `PUT /bands/:product` | Y | N |
| HW_UPFRONT_MARGIN | same | Y | N |
| MARGIN_FLOOR | same | Y | N |
| CURRENCY | same | Y | N |
| catalog costs (`hwCost`, `hostingMonthly` per product) | `base_cost_batches`, current batch by `effective_from` | Supabase editor only (select-only RLS) | **only once cited by a deal_sheet_version's `batch_id`** (trigger `20260827000007:125-150`); uncited batches are editable |

**Not settings, and the brief lists them as settings:** CPI (`cpiMode`,
`escalatorPct`, `escalatorStartYear`), WHT and GST rates (`whtPct`, `whtHwPct`,
`whtSaasPct`, `gstPct`) and the factoring rate (`factoring.ratePct`) are
**per-deal inputs** (spec v2.0 section 2; the engine reads them from `input`,
never from `params`). **Target margin is not read by the term engine at all**;
it is a Commercials concept (`approval-page.js` reads `payload.targetMargin`).
So a quote's inputs carry them, and the settings snapshot does not need to.

**Snapshot sufficiency, proven in memory** (read-only; scratch
`snapshot-proof.mjs`): live settings and current catalog read; two examples
priced (OPEX 120 SafeSight at 60 months with GST 9 and WHT 10 gross-up; CAPEX
two-phase, CPI locked 3%); the engine's parameter object captured **by value**;
a deep copy of live mutated on every key (every ladder price +7%, every band
after the first moved a unit, floor +5, HW upfront +5, compare term moved,
currency SGD, every cost +7%).

- mutated live prices differently from the snapshot: **true** (the proof is not
  vacuous)
- repriced from the snapshot after live moved: **byte-identical** (34974 bytes
  of figures)
- **calibration, each key taken from mutated live instead of the snapshot:
  8 of 8 go red.** TERMS first read SILENT because the first mutation never
  changed it; mutated to drop the quoted term (60), omitting TERMS threw
  `TERM_NOT_OFFERED` and the full snapshot still repriced byte-identical.

**What P3's snapshot must hold**: the seven settings and each product's costs
by value. **Cost batches by id is not enough for a term quote**: the
immutability trigger protects only the single batch in `batch_id`, and a
multi-product quote prices from up to three batches (today: safesight
"Initial catalog" 2026-08-27, air_quality and hemir "John 2026-11-17,
TP_LADDER").

**"Settings changed since saved" for drafts needs a snapshot compare, not a
timestamp.** Two measured reasons:
1. A catalog batch becomes current by `effective_from` date with **no write at
   the moment it takes effect** (5 batches today, 0 future-dated), so no
   timestamp moves when the price does.
2. `updated_at` moves on every admin save of a key, including one that writes
   the same value (one statement per changed key set), so a timestamp would
   fire on a no-op.

Comparing the draft's stored parameter object with today's `buildParams`
catches both and nothing else. The GET already returns `updatedAt` (the max
over rows), which is usable as a cheap pre-check but not as the signal.

## 0-5 Term Pricing component

`TermPricingView({ navToken })` (`frontend-react/src/term-pricing/TermPricingView.tsx:316`)
takes **one prop**, `navToken`. Mounted by `register('term-pricing', (_id,
navToken) => ...)` at `frontend-react/src/main.tsx:246-248`; the id is ignored.

- **Server state**: one `useQuery` on `GET /api/term-pricing` (settings, costs,
  isAdmin); `params` derived with `useMemo(normaliseParams(buildParams(...)))`.
- **Quote inputs, all local `useState` in the view (lines 335-403), 28 of
  them**: units, term, structure, cpiMode, escalator, startYear, gst, whtMode,
  whtPct, grossUp, whtHw, whtSaas, capexAmount, capexCustom, capexStructure,
  milestones, recovery, factoringOn, fxAdvance, fxRate, fxTerm, fxMethod,
  fxTreatment, dealMode, dealPct, dealFee, dealFeeTerm (plus `paymentSeen`).
- **Screen state, local and staying local**: tab, showTax, settingsOpen, the
  settings draft, band and ladder product selectors and drafts, and the three
  editor cards' own saving/message state (1355, 1465, 1772).
- **Derived**: `unitCounts`, `dealAdjustment`, `factoringInput`, `ladderResult`,
  `price`, the quote; all `useMemo` over the inputs and `params`.
- `PRODUCTS` is a hardcoded list of three (line 47).

**Bound mode without forking** needs the 28 input states lifted into one value
object with an optional `{ value, onChange }` pair: absent, the view owns them as
today (standalone unchanged, saves nothing); present, it reads and reports them.
Everything derived stays as it is because it is already computed from those
inputs. The settings editors stay inside the view and are irrelevant in bound
mode (admin settings are not a quote's business).

**The seam decision of record**: `VersionCardHost.tsx:10-19`, Round 4 Phase 2:
"THE SEAM IS THE INTERFACE, EVEN REACT TO REACT... never reaches around it into
the form." The `VersionSeam` (lines 21-31) is **Commercials-shaped**:
`freezeCurrentState()` returns `{ payload, contractorMilestones, catalogRates }`
and **SAVES the record first**; `onSave` reconciles a contractor schedule
against `lumpSumCost` before freezing, and posts `inputs: frozen.payload` with
`expected_revision`. A term quote has no record payload to save today: its
inputs exist only in the view's state. That is a design question, raised under
P2.

## 0-6 Tab shell and widths

Tabs are static buttons in `frontend/index.html:1610-1617` (Reference,
Commercials, Assessment), with the stage tabs generated after them
(`renderOppStageTabs` removes only `[data-opp-stage-tab]`). Each static tab has
a pane `#opp-tab-<key>`; `createTabStrip` (`frontend/app.js:720-743`) reveals
`opp-tab-${key}`. A Term quote tab is one static button and one pane, with React
mounted into the pane. The landing tab is Reference (`app.js:1040`).

Measured (live Proposal opportunity, content box, read-only navigation):

| viewport | opportunity pane (Commercials) | standalone term view | difference |
|---|---|---|---|
| 1240 | 876px | 1024px | -148 |
| 1440 | 1076px | 1224px | -148 |
| 1920 | 1556px | 1704px | -148 |

The price card's three figures at a seven-digit deal (120/40/2 units, 60
months, 7.5% deal discount: List TCV 6,222,600.00, Deal discount 7.5%, Discount
value 466,695.00), standalone:

| viewport | card width | the three figures | fit | the row below |
|---|---|---|---|---|
| 1240 | 876px (stacked) | 16px | all fit, labels on one row | 16px |
| 1440 | 1076px (stacked) | 16px | all fit, labels on one row | 16px |
| 1920 | 360px (side column) | **13px** | all fit, labels on one row | 16px |

**The 13px is a 1920 fact only**, where the card is in the side column; at 1240
and 1440 the card stacks full width and the figures sit at 16px. Opened the
1920 capture: the three figures are visibly smaller than Deal fee and Term
beneath them, as R3 recorded. Mounted in the opportunity pane the term view
loses 148px at every width, so where the side column breaks is a mockup
question. Captures:
`scratchpad/tq/shots/term-disc-{1240,1440,1920}.png` and
`opp-commercials-{1240,1440,1920}.png`.

## 0-7 Approval page

Built per request by `src/lib/approval-page.js` through
`GET /api/opportunities/:id/approval-page` (`deal-sheet-versions.js:237-264`).
Today: `assemblePage` prices the latest version's own inputs and frozen rates
through `calculateDeal(buildDealInputs(version.inputs, version.rates.rates))`
(`:938-941`). That is "today's engine as a check". `withFrozenFigures` (`:890-903`)
then lays the issued version's stored `frozen_figures.page` blocks over it
(`FROZEN_BLOCKS = ask, target, exposures, costBasis, frozenTerms`, `:842`). Where
today differs it adds "Today's engine prices this at X; the approved figure
stands." The bridge (`buildBridge`, `:273`) steps from the last approved
version's inputs (`liveVersionApproval`'s baseline) to the current record
payload through `BRIDGE_STEPS`, all Commercials keys, with a reconciliation
tolerance.

**What a term_quote needs to render the same way:**
- the check: `priceQuote(version.inputs, version's stored params)` in place of
  calculateDeal, comparing to stored figures by path exactly as
  `withFrozenFigures` does now (the overlay function is shape-agnostic: it
  compares `figuresOf` paths);
- the frozen blocks built from the quote's own result (Base TCV, margin, the
  floor, per-product totals, payment basis, CPI mode, factoring);
- a term branch in `buildFrozenFigures`, called by the issue route.

**Where the R-TQ3 signals sit**: in the ask block, beside Base TCV and margin.
The engine already produces both: the deal adjustment's approval signal
("Approval signal: 7.5% below list", spec 4.7) and the floor flag (4.4). No
track, no approver, no gate change.

**When the method differs between the last approved version and the version
under review**: the bridge cannot be computed. Its steps are Commercials input
keys priced by one engine, and the two versions were priced by different engines
on different inputs. Today it would run calculateDeal over a term payload. The
page needs, in place of the bridge, a statement that the method changed: "Last
approved: V2.0, Commercials, Contract net X. Under review: V3.0, Term quote,
Base TCV Y." It shows both headline figures side by side, without a step-by-step
reconciliation, and names that the previous approval does not carry over
(R-TQ4 re-arms the gate). `pricingChanged` must also answer "changed" whenever
the kind differs, before comparing any keys.

## 0-8 Lock sites

Verified: the version POST (`deal-sheet-versions.js:285-560`) reads no record
status, and `closedWonPricingRefusal` is keyed on `COMMERCIALS_OWNED_KEYS`
(`src/lib/pricing-keys.js:50-58`).

| site | file:line | condition | refuses | layer |
|---|---|---|---|---|
| `closedWonPricingRefusal` | src/lib/pricing-keys.js:40-58 | status Closed Won and a Commercials key changes | a Commercials pricing change | lib (client + route) |
| PATCH opportunity | src/routes/opportunities.js:902-911 | the above | 409, record payload only | route |
| Commercials onPersist | frontend-react/src/main.tsx:366-370 | the above | the save, before it is sent | client |
| `refuse_write_while_frozen` | 20260831000001:185-270 | an open request of kind `transition` | every write to the record's revisions, details, versions, contacts | DB |
| issued version immutable | 20261117000002:47-116 | `OLD.status = 'issued'` | any change to a submitted version | DB |
| born draft, figures only when issued | 20261117000002:43-45, 118-134 | | submitted-at-birth, figures on a draft | DB |
| issue route checks | deal-sheet-versions.js:591-593, 678-698, 726-753 | not draft, not newest draft, zero-row update | 409 | route |
| no-delta | deal-sheet-versions.js:447-460 | inputs equal the latest version's | 409 (not a lock) | route |
| client issue/ask controls | frontend-react/src/versions/model.ts:169-240 | pending review, nothing issued | disables Submit and Request approval, **not** pricing edits | client |

**Gaps that bear directly on P7 and R-TQ4:**
- **No server Closed Won refusal on a version save.** It is refused only because
  the client's freeze saves the record first and that save is refused; a direct
  POST would land.
- **No database-level Closed Won lock** at all.
- **Nothing refuses a pricing edit or a new version while a version awaits
  approval.** A pricing approval is `kind='review'` and by design does not freeze
  (`frontend/app.js:1498-1504`); issuing a new major auto-closes the superseded
  review (`close_superseded_reviews`). R-TQ4's "refused while a version awaits
  approval" does not exist today for any kind.

**Can the standalone Term Pricing screen write to an opportunity today? No.**
Its four calls are `GET /api/term-pricing` and three admin PUTs (settings, bands,
price ladder). The route's only write is the upsert into `term_pricing_settings`
(`src/routes/term-pricing.js:71-85`). Nothing writes `records`,
`record_revisions`, `opportunity_details` or `deal_sheet_versions`.

## 0-9 Queued probes

`scripts/term-pricing/probe-screen.mjs` drives the **standalone** screen through
`navigate('term-pricing')` (line 100).

- `--tabs`: TP_TABS's five mockup states, T4-G1, B-1 to B-6, T30, tab state
  surviving a switch, the blocked Quote tab, a 3440 capture.
- `--capex`: G-C1 to G-C6 and C-9 (b).
- Both carry figures from before spec v2.0 removed the formula. Register row:
  FAIL in all five modes on 2026-11-18, 89 checks. Its ladder half is
  superseded by the wired `probe-ladder`.

P2 keeps the standalone screen unchanged, so probe-screen keeps its subject;
**this round's screens replace nothing it points at.** The bound Term quote tab
on the opportunity is a new surface and needs its own probe: mount, inputs in,
onChange out, save through the version seam, the read-only line on the other
tab, and a draft repricing on reopen (R-TQ2).

## 0-10 Wipe impact (measured; nothing executed)

**Counts** (exact, service key, read-only):

| what | count |
|---|---|
| opportunities | 16,544 total: **19 live**, 16,525 soft-deleted |
| live by stage | Qualification 6, Solution Alignment 7, Proposal 3, Negotiating 1, Closed Won 2 |
| live owners | 2 accounts: a staff-domain account created 2026-08-11 (12 opportunities, 1 Closed Won); a walk account created 2026-08-31 (7, 1 Closed Won) |
| deal_sheet_versions | 6,537: draft 2,637, issued 3,900; `frozen_figures` set on 97 |
| of which on live opportunities | **31** (draft 15, issued 16, frozen 0), on 9 opportunities; 6,506 on soft-deleted fixtures |
| shape of the 31 | all Commercials: 38 distinct input keys, none term-shaped |
| approvals | 5,572 total; 66 on live opportunities |
| transition_requests | 5,536 total; 2,995 cite a version; 35 on live opportunities, 13 of them cite a live version |
| open transition_requests | 24; 2 of kind `transition`, **both on live opportunities** (those 2 records are frozen) |
| Closed Won | 2 live, 37 including soft-deleted |
| record_revisions | 167,988 |

**What blocks a delete:**
- `deal_sheet_versions` has no `deleted_at`, so removing a version is a hard
  delete;
- there is no RLS delete policy on any pricing table, so only the service role
  can delete;
- the immutability trigger has no delete clause, by recorded decision
  (`20260827000007:96-105`);
- `transition_requests.frozen_version_id` is ON DELETE RESTRICT, so the 13
  citing requests must go first;
- `approvals.request_id` is RESTRICT, so their 31 approvals must go before
  them;
- `refuse_write_while_frozen` refuses deletes on the 2 frozen live records
  until their open transition requests close;
- records are soft-deleted by convention; `record_revisions`, `approvals` and
  `audit_log` are RESTRICT children of `records`.

**What reads live records instead of its own fixtures:**
- `teardown-scoping.test.mjs` in the database stage asserts more than 1,000
  `transition_requests` (`:509`, 5,536 today) and a `record_revisions`
  population above 1,000 (`:234`). Both rest on the history that soft-deleted
  fixtures leave behind. **A wipe that hard-deletes fixture history turns the
  database suite red.**
- `freshOpportunity()` (`fixtures.mjs:235-247`) links to a live Account and
  `industries[0]`, so every fixture-building gate probe needs Accounts to
  survive.
- The other gate stages build their own fixtures or read configuration only.
- Golden deals carry their inputs in the repo (`GOLDEN_DEALS.md:23`).
- Manual probes that need live opportunities: `probe-stage-tab-identity`
  (a live Proposal opportunity), `probe-frozen-figures-render` (an issued
  version with null figures), `after-save/probe-after-save` (two opportunities
  owned by someone else that have key contacts).

**TT-SGP-LOGIST-001** is a **Test Bed**, at Qualification, created 2026-09-28,
live, with no versions, no children and no opportunity converted from it. An
opportunity wipe does not touch it; a wipe by owner (the walk account) or by "all
test records" would. **The KEEP ruling is not recorded anywhere in the
repository.** The only mention is `CONFIRM_GOLDENS_CLOSE_OUT.md:99-117`, which
reports it "for a ruling", and DESIGN_PRINCIPLES has no entry. If it was ruled
2026-09-29, it was ruled in conversation and never written down.

**Proposed wipe, for John's approval. Not applied.**

1. **Recommended: no wipe.** P4 adds `kind` with `commercials` as the default.
   All 31 live versions are Commercials-shaped, so the default describes every
   existing row truthfully, and nothing needs compatibility code (R-TQ5 holds
   without deleting anything). New opportunities start on term_quote by R-TQ1.
   This is the smallest shape there is, and it puts nothing the gate reads at
   risk.
2. **If a clean slate is wanted on the screens John uses: soft-delete the 19
   live opportunities.** Their history stays, invisible, under the estate's own
   convention, and nothing is hard-deleted. Before it, the 2 open transition
   requests are withdrawn, because the freeze trigger refuses the
   `records.deleted_at` update otherwise. Accounts, contacts, Test Beds (LOGIST
   included) and all configuration stay. The cost is that manual probes needing
   live opportunities will need new ones.
3. **Versions only on the live opportunities, as a hard delete: not
   recommended.** It is a chain of 31 approvals, then 13 requests, then 31
   versions, by the service role, after the 2 freezes are lifted. The records
   stay but lose the approval history their stage positions rest on: two
   Closed Won deals would have no won version, and records at Negotiating would
   have no approved pricing behind them.
4. **Not proposed: anything touching soft-deleted fixture history.** The 6,506
   versions and their requests are invisible to every screen, and removing them
   turns `teardown-scoping` red.

## P1 to P7

- **P1, one sequence and kind per version, CONFIRMED** (ruled; measured
  feasible). The single sequence exists (`unique(record_id, major, minor)`;
  numbering over all rows). The remaining part is "headline from the current
  version", which is under P6.
- **P2, two tabs, bound mode, NEEDS RULING.** Bound mode is feasible without
  a fork (0-5). The tab shell takes one static button and pane (0-6). The pane
  is 148px narrower than the standalone view at every width. Open question:
  the version seam saves the record payload first and then copies it into the
  version. **Where does a term quote draft's inputs live: in the record
  payload under a key of its own (which joins the record PATCH allowlist and
  the Closed Won key set), or only in draft versions?** R-TQ2's "a saved draft
  quote" reads either way.
- **P3, settings snapshot by value, FALSIFIED as worded; CONFIRMED as a
  mechanism.**
  - The snapshot the engine needs is the seven settings plus each product's
    costs by value: proven byte-identical, with 8 of 8 keys calibrated.
  - CPI, the WHT and GST rates and the factoring rate are inputs, not
    settings. Target margin is not a term-engine value.
  - Cost batches by id are not immutable for a term quote.
  - Submission freezing needs a term branch in `buildFrozenFigures`.
  - The draft signal must be a snapshot compare (0-4).
- **P4, deal_sheet_versions plus kind, CONFIRMED** (ruled). The measured
  obstacles, all named in 0-2:
  - the `rates_have_cost_basis` CHECK;
  - the immutable() guard list and `version-guard.test.mjs`;
  - `insert_deal_sheet_version` has no kind parameter;
  - the writable keys today are `COMMERCIALS_OWNED_KEYS` only.
- **P5, no new tracks, CONFIRMED.** Both signals already exist in the engine.
  They belong in the ask block, and nothing in the approval model needs to
  change (0-7).
- **P6, headline is Base TCV, NEEDS RULING.**
  - **Today the headline is not read from any version.** It is the record's
    latest payload, repriced live through calculateDeal, except at Closed Won,
    where it is the won version's frozen figure.
  - P1 says the headline comes from the current version. For a term_quote
    draft that reprices live (R-TQ2), "the current version's figure" is a
    live reprice of that version's inputs.
  - **The ruling needed: which source the headline takes for each kind.**
    Either the current version for both, which changes Commercials' headline
    source, or the record for Commercials and the current version for
    term_quote.
  - Passed-through factoring already counts in Base TCV (spec 9.4, R-TF6).
  - One unpriced definition can hold: `contractValueOf` is unit-agnostic,
    provided term figures reach it in dollars, not cents.
- **P7, Closed Won lock for both kinds, NEEDS RULING.**
  - The won-version derivation is kind-blind, so it already serves both kinds.
  - The lock does not cover term inputs: it is keyed on Commercials keys and
    lives only on the record PATCH.
  - There is no server refusal on a version save at Closed Won (0-8).
  - The ruling needed: does the round add that server refusal for both kinds
    (it is P7 made real), and the R-TQ4 refusal while a version awaits
    approval, which does not exist for any kind today?

## Premises this brief states that measurement contradicts

1. 0-1: "using the refreshed approver account". It was not refreshed (expired
   2026-11-16), and the probe never used it.
2. 0-1's framing as a possible regression: it is a stale probe of a rule the
   product deliberately replaced on 2026-09-03.
3. 0-4 and P3: CPI, the WHT and GST rates and the factoring rate are listed as
   settings; they are per-deal inputs. Target margin is not a term-engine
   value.
4. P3: "cost batches by id only if immutable". A term quote's batches are not
   immutable: only the one batch in `batch_id` is protected.
5. 0-6: "currently 13px vs 16px elsewhere". True only at 1920; at 1240 and
   1440 the figures are 16px.
6. 0-10: "TT-SGP-LOGIST-001 (John ruled KEEP 2026-09-29)". No record of the
   ruling exists, and it is a Test Bed, outside an opportunity wipe.
7. P1 and P6: "headline from the current version". Today the headline comes
   from the record payload, not from any version.
8. R-TQ4: "refused while a version awaits approval". No such refusal exists
   today, for either kind.

## Queued (found here, not this round's to fix)

- Repoint `probe-decision-feedback` to the per-track rule (0-1).
- Check `verify-harness.mjs`'s `createVersion` with `p_rates: {}` against the
  cost-basis CHECK. It was flagged by the census and not verified by me.
- The `/tmp/tms-probe` scratch install is wiped by the macOS `/tmp` cleaner. A
  gate started after a cleanup reports its browser stages NOT RUN, not FAIL,
  which is correct, but the recurrence is avoidable with a location the
  cleaner does not reach.
- The approver session is still expired.

## Calibration and residue

- 0-4: 8 of 8 settings keys fire when taken from mutated live. The proof's
  non-vacuity was checked: mutated live does price differently.
- 0-1: the diagnostic's own miss (an empty feedback read) was found and
  corrected by counting calls into the handler and reading every feedback
  slot.
- 0-6: a first run dropped its tab click while the view was still loading
  (`is-loading`). This was an instrument fault: the script now waits for the
  load to finish, and the figures were re-read with a discount entered so
  that all three are populated.
- Residue: 134 live records before, after the probes and at the end; no
  configuration table moved (`term_pricing_settings` 7, `system_roles` 1,
  `stage_gate_rules` 135, `stage_definitions` 20, `track_approvers` 5,
  `system_defaults` 7, `base_cost_batches` 5).

Stopped for John: the wipe (recommendation: none), and the rulings on P2, P6
and P7.
