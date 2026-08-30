# Round 41 Phase 1: items 1 and 2

**REPORT ONLY. No behaviour changed.** One query script added,
`scripts/query-hybrid-recovery.mjs`, which reads and computes and writes
nothing.

---

# Item 1: the hybrid discrepancy

## The code path, quoted

`src/lib/deal-calculator.js`, the line the brief names:

```js
const recov = structure === 'single' ? months : (recoveryMonths || 0);
```

**That line does compute `recov` for hybrid.** Every consumer of it is then
guarded:

```js
// 206  the factoring default term
const defaultTerm = structure === 'hybrid' ? 12 : Math.max(1, recov);

// 218  the per-month recovery figure
const recoveryPerMonth = recov > 0 ? hardwarePriceAll / recov : 0;

// 223  the hardware accrual
accrHw.push(structure !== 'hybrid' ? (m <= recov ? recoveryPerMonth : 0) : 0);

// 251  the hardware cash-in
const hardwareIn = structure !== 'hybrid'
  ? hwBilled[m - 1]
  : due.filter((x) => x.month === m).reduce((s, x) => s + x.usd, 0);

// 284  returned to callers
return { structure, recov, rows, ... }
```

Line 206 substitutes a hardcoded 12 for hybrid. Lines 223 and 251 exclude hybrid
explicitly. Line 284 exports `recov` and **nothing reads it for hybrid.**

The UI agrees:

```js
// frontend/opportunity-deal.js:1667
document.getElementById('deal-recovery-group').classList.toggle('hidden', s !== 'twoPhase')
```

**The recovery input is visible only on two-phase.** On hybrid it is hidden; on
single it is replaced by a read-only display of the contract duration.

## The arithmetic, both readings, on a concrete example

15 SafeSight, 5 AQ, 2 HEMIR, 36 months, 30% target, 2% warranty, annual
invoicing, client-own installation. Hardware and warranty price `$492,858`,
cost `$345,000`. Milestones: `$200,000` in month 1, `$292,858` in month 6.

| recoveryMonths | hardware cash in over the contract | closing position |
|---|---|---|
| absent | `$492,858` | `+$217,302` |
| 0 | `$492,858` | `+$217,302` |
| 6 | `$492,858` | `+$217,302` |
| 12 | `$492,858` | `+$217,302` |
| 36 | `$492,858` | `+$217,302` |

**Identical at every value.** The same deal as `twoPhase`, for contrast:

| recoveryMonths | hardware cash in | closing position |
|---|---|---|
| absent | `$0` | `-$275,556` |
| 0 | `$0` | `-$275,556` |
| 6 | `$492,858` | `+$217,302` |
| 36 | `$492,858` | `+$217,302` |

**The discriminating case is hybrid with no milestones**, which separates "the
value is ignored" from "the value happens not to matter here":

| structure | recoveryMonths | milestones | hardware cash in |
|---|---|---|---|
| hybrid | absent | none | `$0` |
| hybrid | 12 | none | `$0` |

Setting recovery to 12 recovers nothing. Under the applied reading it would
recover `$492,858`.

**So the difference between the two readings, on this example, is `$492,858` of
hardware revenue and `$492,858` of closing cash position** where the deal has no
milestones, and **`$0`** where the milestones already total the hardware price.
The difference is not a fixed number: it is the gap between the milestone
schedule and the recovery schedule, and it is zero exactly when they agree.

## Query results: every existing hybrid deal sheet

```
calibration: a synthetic hybrid is detected, and the two readings
             differ by $25,715 on it
catalog rate keys resolved: 10
opportunities scanned: 562   deal sheet versions scanned: 187
HYBRID found: 0
```

**There is no hybrid deal sheet on any record or any version.** Measured across
562 opportunities' latest revisions and all 187 deal sheet versions.

Structures actually present:

| | latest revisions | versions |
|---|---|---|
| absent | 502 | 100 |
| `twoPhase` | 59 | 87 |
| `single` | 1 | 0 |
| **`hybrid`** | **0** | **0** |

So the dollar difference column is empty because the population is empty. **The
discrepancy has never been exercised by real data.**

**The zero is calibrated**, because "no hybrid exists" and "the scan cannot see
a hybrid" produce identical output. The script prices a synthetic hybrid before
reporting, confirms the scan detects it, and confirms the two readings differ on
it by `$25,715`. It also refuses to report at all if the catalog resolves no
rate keys, since an empty catalog makes both readings agree at zero for the
wrong reason.

## No ruling

Stated for completeness: this report does not say which model is correct. The
code and the UI are internally consistent with each other and with the
business's stated model. What the calculator's own expression *reads* as is a
third thing, and whether that matters is the business's call.

**One thing found while checking, not part of item 1 and not touched.**
`defaultTerm = structure === 'hybrid' ? 12 : ...` is a hardcoded 12-month
factoring term for hybrid, with no comment and no configuration. A business
number written into a calculator.

---

# Item 2: the numeric input enumeration

## How the population was established

**Four enumerations, from different directions, so the list is not one reading
of one file.**

1. **`frontend/index.html`** — every `<input>` inside `id="opp-tab-commercial"`
   carrying `inputmode="numeric"` or `inputmode="decimal"`. **35 found.**
2. **`frontend/opportunity-deal.js`** — the row templates, since milestone rows
   are generated rather than written in the markup. **5 template inputs found**,
   each rendered 5 times.
3. **`src/lib/numeric-payload.js`** — `WRITABLE_NUMERIC_KEYS` (12) and
   `NUMERIC_DEFAULTS` (13), to catch a payload key with no input on screen.
   **Cross-check result: none. Every writable numeric key has an input.**
4. **`src/lib/rate-resolution.js`** — `ALL_RATE_KEYS` (10), to catch a rate with
   an input that is not a payload key.

**The cross-check is what makes this a population rather than a list.** Reading
the markup alone would miss a key with no control; reading the payload alone
would miss the six read-only rate displays and the twenty generated milestone
cells.

**Total: 40 distinct inputs**, of which 6 are read-only displays.

## The ruling, per input

The test is the business's: **is zero a value a person would deliberately enter
for this field?**

### IN — zero is not a value, absence must be sayable

| input | payload key | reason |
|---|---|---|
| `deal-targetMargin` | `targetMargin` | already in. A zero-margin deal is a decision nobody makes by leaving a box empty. |
| `deal-warrantyPct` | `warrantyPct` | already in. Zero warranty provision is a choice; blank is not that choice. |
| `deal-whtPct` | `whtPct` | already in. Zero WHT is a jurisdiction fact; blank means nobody asked. |
| `deal-gstPct` | `gstPct` | already in. Measured: 406 of 467 carry none, and 0 rendered a confident GST-free price. |
| `deal-fxContingency` | `fxContingency` | already in. Zero contingency is a deliberate position on FX risk. |
| `deal-factoring-ratePct` | `factoring.ratePct` | already in. A zero-rate facility does not exist. |
| `deal-duration` | `duration` | already in. Zero contract months is not a deal. |
| **`deal-recoveryMonths`** | **`recoveryMonths`** | **NEW. Zero recovery months on a structure whose purpose is recovering hardware is a contradiction. Finding 1. Missed in Phase 1b.** |
| **`deal-factoring-termMonths`** | **`factoring.termMonths`** | **NEW. A facility with a zero-month term is not a facility. Blank currently falls back to `defaultTerm`, which is the same fallback shape as `recoveryMonths`.** |

### OUT — zero is a value a person would deliberately enter

Each reasoned individually, because an exclusion is a claim.

| input | reason zero is meaningful |
|---|---|
| `deal-ssExisting` | A deal with no SafeSight on existing infrastructure is an ordinary deal. Zero is the answer to "how many". |
| `deal-ssNew` | Same. Most deals are one or the other, so zero here is the common case rather than an edge. |
| `deal-aqm` | A deal with no AQ sensors is ordinary. Zero is a real quantity. |
| `deal-hemir` | Same. HEMIR is the least common product; zero is the usual answer. |
| `deal-lumpCost` | Only shown for Contractor Lump Sum. A zero lump sum is nonsense, **but the field is hidden on every other installation type and blank there is correct**, so putting it IN would make the sheet say "not recorded" on four of five deals. Ruled out on the SHAPE of the field's visibility, not on the value. **Flagged: this is the weakest exclusion in the table.** |
| `deal-margin-hwSs` and the other ten | Blank already means "price at target", which is a real and common intent, and the placeholder says so. Zero margin on one line is also a deliberate position, e.g. hardware at cost to win the hosting. Both states are meaningful and distinguishable today. |
| `deal-ms-{i}-month` (×5) | A blank row is an unused milestone slot. Zero is filtered out by `month > 0 && usd > 0` and never stored. |
| `deal-ms-{i}-usd` (×5) | Same. Zero is how a row is left empty. |
| `deal-cm-{i}-month` (×5) | Same, contractor side. |
| `deal-cm-{i}-usd` (×5) | Same. |
| `deal-cm-{i}-pct` (×5) | Computed from USD and vice versa. Zero percent is a real entry on a schedule that pays nothing at that milestone. |
| `deal-inSsExisting` | An installation rate of zero is a real quotation: a contractor may not charge for a trivial mount. And absence is already handled by `resolveRates`, which distinguishes overridden, catalog and absent. |
| `deal-inSsNew`, `deal-inAqm`, `deal-inHemir` | Same. |
| `deal-ssUnitCost`, `deal-aqUnitCost`, `deal-hemirUnitCost`, `deal-hoSafesight`, `deal-hoAqm`, `deal-hoHemir` | **Read-only displays.** No person enters anything, so the test does not apply. They are catalog facts and `resolveRates` already reports `absent` distinctly from zero. |

## Summary of the change item 2 would make

`ZERO_IS_NOT_A_VALUE` today: **7 keys.** After the ruling: **9**, adding
`recoveryMonths` and `factoring.termMonths`.

**And one exclusion is flagged rather than settled: `lumpSumCost`.** It is ruled
out because the field is hidden on four of five installation types, not because
zero is meaningful there. If the sheet only says "not recorded" when the field
is visible, the exclusion is unnecessary and it should be IN. That is a decision
about conditional fields, not about lump sums, and it is the business's.

---

## What this phase changed

`DESIGN_PRINCIPLES.md` gained the walk pass criterion, verbatim, beside the
stopping condition. `scripts/query-hybrid-recovery.mjs` was added. Nothing else.

---

# Follow-up 1: every reader of `recov`, enumerated

**The Phase 1 claim "read by nothing on hybrid" was a searched absence with no
stated method.** Restated with one.

## How the enumeration was built

**Two directions, because either alone misses a class of reader.**

**Direction A, from the symbol outward.** `grep -rn "\brecov\b"` across every
`.js`, `.mjs` and `.html` in the tree, excluding `node_modules`. Word-boundary
anchored so `recovery`, `recoveryMonths` and `recoveryPerMonth` do not
masquerade as hits.

**Direction B, from the producer outward.** Every call site of `calculateDeal`,
then every read of the `cashFlow` object it returns, then every property taken
off that object. This catches a reader that destructures or spreads without ever
naming `recov`, which direction A cannot see.

**Files reached: all of `src/`, `frontend/`, `scripts/`, plus the two prototype
copies.** Deal sheet renders, version storage, the approval page and the HTTP
routes are all inside that set. **There is no PDF or document export path in
this repository** — `grep` for one returns the `document_details` record type,
which stores a URL and does not render a deal.

## Direction A: every occurrence of `recov`

| file | line | what it is |
|---|---|---|
| `src/lib/deal-calculator.js` | 201 | the assignment |
| | 206 | `defaultTerm`, **hybrid substitutes a literal 12** |
| | 218 | `recoveryPerMonth`, feeds only line 223 |
| | 223 | accrual, **guarded `structure !== 'hybrid'`** |
| | 284 | **exported on the cashFlow object** |
| `scripts/query-hybrid-recovery.mjs` | 11, 19 | comments in this round's own query |
| `Terminus Ops.dc.html`, `Prototype-110826/…` | 6535–6610 | **the prototype, not shipped code** |

**No other file in the repository contains the symbol.**

## Direction B: every consumer of the returned object

| consumer | what it takes off `cashFlow` |
|---|---|
| `src/lib/deal-calculator.js:412` | `.facInterest` |
| `src/lib/approval-page.js:422, 428` | `.minCash`, `.minCashMonth` |
| `frontend/opportunity-deal.js:1008` | `.rows` (year buckets) |
| `frontend/opportunity-deal.js:1102` | `.minCash`, `.minCashMonth`, `.rows` |
| `scripts/query-hybrid-recovery.mjs:46` | `.rows` (this round's query) |

**`grep -rn "\.recov\b"` across `frontend/`, `src/` and `scripts/` returns
nothing.** No property access to `recov` exists outside the calculator.

## The one path that does export it, named

```js
// src/routes/deals.js:212
app.post('/calculate', { schema: { body: dealInputSchema } }, async (request, reply) => {
  const result = calculateDeal(request.body);
  return reply.send(result);
});
```

**`POST /api/deals/calculate` returns the whole result object, so `recov` does
cross the wire on it, for hybrid as for every structure.** That is a genuine
export and the Phase 1 wording did not cover it.

**Its reachability, measured rather than assumed:** `grep` for `deals/calculate`
or `/api/deals` across `frontend/` and `scripts/` returns **one hit, and it is a
comment** in `opportunity-deal.js:9` recording that Submit Deal was removed in
Round 3 Phase 4. **No caller exists in this repository.** The route is
authenticated and live on the server, and nothing in the product calls it.

## Confirmed

**No render, no version, no report and no client-side path reads `recov` for a
hybrid deal, or for any structure.** The single export is an HTTP response body
on a route with no caller.

**The correction to the Phase 1 wording:** "read by nothing" was right about
readers and wrong about exports. `recov` is *exported* by one route and *read*
by nobody.

---

# Follow-up 2: does "not recorded" fire only for visible fields?

## The mechanism

**There are two disclosure paths and neither consults visibility.**

**Path 1, the Deal Summary and Result rows, client side.** `gstPresentation`,
`whtPresentation` and `durationPresentation` in `src/lib/deal-inputs.js` each
call `ratePresentation`, which is:

```js
const recorded = isSet(payload, key);
```

`isSet` reads the payload through `RAW_READERS` and returns false for
`undefined`, `null` and `''`. **It takes the payload and a key. It has no
access to the DOM, so it cannot know whether a field is on screen.** The row
renders because `renderDealMatrix` puts it in the row list unconditionally.

**Path 2, the approval page block 5, server side.**

```js
// src/lib/approval-page.js, buildNotRecorded
for (const key of Object.keys(NUMERIC_DEFAULTS)) {
  if (isSet(payload, key)) continue;
  out.push({ kind: 'default', key, ...defaultProvenance(key),
    note: 'Nobody entered a value. This is the assumption being approved.' });
}
```

**It iterates `NUMERIC_DEFAULTS` — a constant — and reports every key the payload
does not set.** It runs on the server, from a stored payload, with no screen in
existence at all. **`lumpSumCost` is one of the thirteen keys in
`NUMERIC_DEFAULTS`.**

## Measured

`buildNotRecorded` called with a complete two-phase payload, varying only
`installResp`:

| installResp | not-recorded defaults reported |
|---|---|
| Client Own Installation Team | `factoringRatePct`, **`lumpSumCost`** |
| Terminus Contractor - Per Unit | `factoringRatePct`, **`lumpSumCost`** |
| Terminus - Reseller Installation | `factoringRatePct`, **`lumpSumCost`** |
| Terminus Contractor - Lump Sum | `factoringRatePct`, `lumpSumCost` |

## The answer, and it inverts my exclusion

**No. The disclosure does not fire only for visible fields, and it never has.**

**The approval page already tells an approver "Nobody entered a value" for
`lumpSumCost` on every deal that is not a Lump Sum deal** — three of the four
installation types, where the field is hidden and blank is the only correct
state. That is live today, on a control surface, and it is not a consequence of
anything this round proposes.

**So the Phase 1 exclusion of `lumpSumCost` rested on a premise that is false.**
I ruled it out because "the field is hidden on four of five installation types
and putting it IN would make the sheet say not recorded on four of five deals".
The sheet already does, on the page where it matters most.

**What follows for the ruling, stated without taking it.** The question is no
longer whether `lumpSumCost` joins `ZERO_IS_NOT_A_VALUE`. It is whether a
disclosure should be **conditional on the field applying to this deal** — which
is a decision about `buildNotRecorded` and about `factoringRatePct` too, since
that one reports on every deal with factoring switched off.

**Both are existing behaviour and neither is in this round's scope.** Reported,
not touched.
