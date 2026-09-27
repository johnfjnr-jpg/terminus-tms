# PHASE 0 FINDING: THE CONTRACTOR PAYMENT SCHEDULE REACHES NO ARITHMETIC

**This is the STOP the brief asked for.** Its own Phase 0 rule reads: *"STOP if
any rule's behaviour is ambiguous or contradicts a ruling of record rather than
documenting a guess."* This contradicts a ruling of record, R-N1, ruled by John
2026-09-21.

Nothing has been changed. No pricing, no UI, no schema. Branch `golden-deals`
at `ad08af4`, nothing pushed.

---

## 1. THE FINDING, IN ONE SENTENCE

**The system refuses to issue a version whose contractor payment schedule does
not sum to the lump sum, and then prices the deal as though there were no
schedule at all.**

The cash flow filters and sums contractor milestones on a `usd` field
(`deal-calculator.js:386, 388, 441`). **Nothing writes `usd` any more**, and the
route **refuses it if it arrives**:

| | |
|---|---|
| `readContractorMilestones` writes | `month`, `label`, `pct`, `incomplete` (`payload.ts:266-275`) |
| `PATCH /opportunities/:id` answers 400 for a row carrying `usd` | `opportunities.js:748`, *"which is derived from pct and is no longer stored"* |
| the cash flow filters on | `x.month > 0 && x.usd > 0` (`deal-calculator.js:386`) |

So `contractorStaged` is **false on every deal the system can save**,
`contractorTotal` is **always 0**, and `upfrontCost` is **always the whole
principal**.

---

## 2. MEASURED, BOTH DIRECTIONS

Run through the live pipeline, `resolveRates` -> `buildDealInputs` ->
`calculateDeal`, on a two-phase lump sum deal with a three-row schedule
totalling 100% of a $214,000 lump sum.

```
AS THE SURFACE SAVES IT (pct only, the only shape the route accepts)
  contractorStaged   false
  contractorOut sum  0
  month 1 hwOut      835000
  principal          835000

WITH usd PRESENT (the shape the cash flow expects, and the route REFUSES)
  contractorStaged   true
  contractorOut sum  214000
  month 1 hwOut      621000
  principal          835000
```

The instrument returns a different value in each state on the system under
test, which is what makes the first reading evidence rather than an absence.

---

## 3. WHAT IT TOUCHES, AND WHAT IT CANNOT

**It cannot move a price, a cost or a margin.** Measured on the same deal, with
both sides present and non-null on every line:

```
SAME   contract net               1,990,454
SAME   one-off price              1,184,714
SAME   total deal cost (all)      1,399,000
SAME   achieved margin            29.7145274394686 %
SAME   P&L total cost             1,399,000
SAME   finance cost               0
SAME   min cash                   3,157 at month 12

MOVES  month 1 cash out           844,400  ->  716,000
MOVES  month 1 cumulative         106,557  ->  234,957
       worst cumulative gap       month 1, 128,400
```

**The defect is purely cash TIMING**, and it closes by the last milestone
month: by month 9 the cumulative position has caught up, which is why `minCash`
at month 12 agrees.

**SO IT CAN MOVE THE REPORTED CASH TROUGH, AND ONLY WHEN THE TROUGH FALLS
INSIDE THE STAGING WINDOW.** On this deal it does not. On a monthly-invoicing
deal, a shorter recovery period or a later final milestone it would, and the
trough is the figure a salesperson reads to decide whether the deal can be
funded.

---

## 4. WHAT IT CONTRADICTS

R-N1, at `milestone-schedule.js:56-83`, in its own words:

> A milestone is a PERCENTAGE of the base it is a schedule of, and its dollar
> figure is derived here and nowhere else. **Every reader - the grid cell, the
> reconciliation below, the cash flow in `deal-calculator.js` - calls this**, so
> they cannot disagree by construction rather than by a comment saying they
> cannot.

**The customer milestones were re-pointed and the contractor milestones were
not.** `due` maps every customer row through `milestoneUsd` before filtering
(`deal-calculator.js:359-361`). `contractorMs` one line below reads the raw
payload. R-N1 names the cash flow as a caller; half of it is.

**AND THE GATE ENFORCES THE SCHEDULE THE ENGINE IGNORES.**
`deal-sheet-versions.js:319-329` refuses a version whose contractor schedule
does not reconcile, with the sentence *"A version records a commercial
commitment and cannot carry a payment schedule that does not match the price it
is a schedule of."* That refusal derives correctly from `pct`. Verification 43's
family, inverted: the display and the gate are right, and the engine is the one
that cannot see it.

---

## 5. THREE RECORDS SAW IT AND READ IT AS A PROPERTY OF THE WORLD

This is Verification 19 exactly, a measured fact stated as a property of the
system rather than as a dead branch.

- **`deal-render.test.tsx:41`** - *"And `contractorStaged` is FALSE on every
  shape measured, so the cash-out row is 'Hardware, warranty and installation'
  rather than the staged pair."* True, measured, and the reason is that the
  branch is unreachable.
- **`deal-render.test.tsx:125`** - *"contractorStaged is false on every measured
  deal shape, so this is the unstaged label. **The staged pair is exercised at
  model level in Session C.**"* **It is not.** `buildCashFlowModel` appears in
  no test file in the repository. The only test touching `contractorStaged: true`
  (`deal-surfaces.test.ts:92`) hands the renderer a cash flow object built by
  hand, so it tests the LABEL and never the model.
- **`deal-inputs-golden.json`** - `contractorMilestones: []` on **all fifteen
  shapes**, so the shared-translation golden never exercises it either.

**Nothing in the estate has ever executed the staged branch.**

---

## 6. ONE INSTANCE, NOT A CLASS. THE CENSUS THAT ESTABLISHES IT

Build discipline 8 says fix the class, not the instance the failure named, so
the class was enumerated before reporting.

**A key-level census came back clean and was blind to this**, because
`contractorMilestones` is both written and read: what is never written is a
sub-key inside each row. Verification 33, a measure with a shape.

`scripts/golden-deals/subkey-census.mjs` is the instrument aimed one level
down. It spies the engine's own reads through a `get` trap across five
structure and installation shapes, so nothing depends on matching a name in
source, and it reports:

```
milestones            writes month,label,pct,incomplete   reads incomplete,label,month,pct
contractorMilestones  writes month,label,pct,incomplete   reads month,usd
                      READ AND NEVER WRITTEN: usd
factoring             writes enabled,ratePct,termMonths,method
                      reads enabled,method,ratePct,termMonths
FAIL: 1 sub-key(s) the engine reads and no writer supplies.
```

**CALIBRATED IN BOTH DIRECTIONS**, on a bucket other than the live instance, so
the calibration is not the finding restated:

```
1. HEALTHY   exit 1  69ms  named: usd                 AS EXPECTED
2. INJECTED  exit 1  65ms  named: usd | zzPhantom     AS EXPECTED
3. REVERTED  exit 1  64ms  named: usd                 AS EXPECTED
             bytes identical to the snapshot: true
```

The injection made `buildDealInputs` read `factoring.zzPhantom`. Snapshot keyed
on the full path, asserted present before injecting, in-flight marker written,
restore compared byte for byte, final reverted run (Verification 44). Durations
64-69ms throughout, so no run carries the instant-failure signature.

**It also refuses rather than passing when a bucket is UNMEASURED**, because a
census that counted an untouched object as clean would be Verification 14's
check with nothing on either side.

**IT IS DELIBERATELY NOT WIRED TO A GATE STAGE YET**, and the reason is
recorded in the file: the two possible rulings want different things from it. A
ruling that brings the engine into line makes it a permanent green guard. A
ruling that the schedule was never meant to reach the cash flow needs a declared
exemption for that sub-key, and minting an exemption before the ruling would be
minting an exemption for a defect.

---

## 7. THE OPTIONS

**(a) BRING THE CASH FLOW INTO LINE. Recommended.** `contractorMs` maps through
`milestoneUsd(pct, lumpCost)` exactly as `due` already does for customer
milestones, and R-N1's own sentence becomes true. The base is `lumpCost`, which
is already in scope at that line. The version gate already refuses a schedule
that does not sum to the lump sum, so the arithmetic is guaranteed to
reconcile. It is one expression, not a design.

**(b) RULE THE SCHEDULE A COMMITMENT-AND-GATE ARTEFACT that deliberately does
not reach the cash flow.** Then the three `x.usd` reads are dead code and go,
`contractorStaged` goes with them, and the deal sheet has to say the contractor
is paid in full in month 1, because today it implies otherwise.

**(c) NEITHER NOW.** Document it as a named SURPRISE in `PRICING_LOGIC.md`,
publish G2's cash flow as the engine actually computes it, and carry the fix to
its own round.

**WHY THE RECOMMENDATION IS (a) AND WHY IT WANTS DECIDING BEFORE THE GOLDENS
ARE COMPUTED.** The whole purpose of this round is to freeze figures verified by
hand, so freezing a cash flow that is about to move is the one outcome to
avoid. Under (c), G2's cash flow section is re-taken a round later and every
hour spent checking it in Excel is spent twice.

---

## 8. WHAT IS BLOCKED AND WHAT IS NOT

**BLOCKED, pending the ruling:**

- **Brief rule 12** ("a milestone's dollars derive from its percentage of the
  one-off price") has two readings and cannot be written in business English
  until one is chosen. That enumeration was made on the customer side and
  asserted of both, which is the fault it now records.
- **G2's cash flow**, the only one of the four golden deals that carries a lump
  sum and a contractor schedule.

**NOT BLOCKED, and not yet built because the brief says STOP:**

- `PRICING_LOGIC.md`'s other 25 rules.
- G1, G3 and G4 in full. None carries a contractor schedule: G1 and G3 are
  per-unit installation, G4 is per-unit with overrides.
- The acceptance harness, which needs all four deals.

**The fixtures are committed** in `scripts/golden-deals/deals.mjs`, so the
ruling resumes the round rather than restarting it. One correction landed there
during Phase 0: **G1 must carry `structure: 'single'` explicitly**, because
`readDealPayload` saves `effectiveStructure(ui)` and `buildDealInputs` applies no
OPEX rule of its own, so a G1 without it would have priced as TWO-PHASE and the
document would have described a shape no saved record has.
