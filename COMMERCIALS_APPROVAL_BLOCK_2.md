# Block 2, "What moved it": the delta design

Round 38, 2026-08-29. Brought first because it is the piece with no current
equivalent. Blocks 1, 3, 4 and 5 arrange figures that already exist; this one
computes something nothing in the system computes today.

Nothing here is built. This is the design, and the measurements it rests on.

---

## 1. What I measured first

### A version is self-sufficient, and that is the whole enabling fact

`deal_sheet_versions.inputs` is `readPayload()` verbatim
(`frontend/opportunity-deal.js:131`, sent at `:651`). That payload carries the
**catalog rates as ordinary keys**: `ssUnitCost`, `aqUnitCost`, `hemirUnitCost`,
`inSsExisting`, `inSsNew`, `inAqm`, `inHemir`, `hoSafesight`, `hoAqm`,
`hoHemir` (`:148-166`). They are read from the catalog, not the form, and
written into the payload at save.

`buildDealInputs(payload)` (`:230`) is a **pure function of that payload** and
reads no catalog of its own.

So `calculateDeal(buildDealInputs(version.inputs))` reproduces a version exactly,
at the rates it was priced at, with no other input. That is what makes a delta
possible at all, and it was not obvious: the separate `rates` column reads like
the thing you would need, and it is provenance rather than a dependency.

**The consequence that matters for the approver:** a catalog reprice appears in
the delta through the same mechanism as a discount, because both are payload
keys that moved. "Someone priced this down" and "hardware got more expensive"
come out of one computation, distinguished only by which key moved.

### "The last approved version" has no referent today

Three separate findings, and all three are load-bearing:

- `deal_sheet_versions.status` is `'draft' | 'issued'`
  (`supabase/migrations/20260827000006_deal_sheet_versions.sql:95`). **There is
  no approved state.**
- `approvals` is keyed to `(record_id, revision_number, track, approver_id)`
  (`supabase/migrations/20260801000000_initial_schema.sql:46-61`). An approval is
  given against a **record revision**.
- `deal_sheet_versions` carries **no `revision_number`**. Checked against the
  creating migration and every `alter table` on it since; the search was
  calibrated by confirming it finds the two that do exist, which add
  `created_by_email` and `issued_by_email`
  (`supabase/migrations/20260827000008_version_author_email.sql:17-21`).

So an approval names a revision, a version names pricing, and nothing joins
them. The baseline the block needs cannot be selected.

### The payload-to-inputs translation exists twice

`buildDealInputs` (`frontend/opportunity-deal.js:230`) and
`loadDealInputsFromOpportunity` (`src/routes/deals.js:58`). `deals.js:149` names
the client function as its counterpart in a comment. The submit route's
recompute-mismatch check (`deals.js:304-324`) exists because the two can
disagree.

Block 2 needs a **third** caller: it translates a historical payload rather than
the current record. A third copy is not acceptable.

---

## 2. The two prerequisites

Small, and both are the kind of change that gets harder the longer it waits.

**(a) `deal_sheet_versions.revision_number integer not null`, stamped at
creation.** Round 38 Phase 1 already makes taking a version save the record
first, and that save returns its revision number, so the value is in hand with
no extra read. This turns "the last approved version" from a guess into a join.

**(b) `buildDealInputs` moves to `src/lib/deal-inputs.js`**, served to the
browser the way `deal-calculator.js` and `numeric-payload.js` already are, and
`loadDealInputsFromOpportunity` is rewritten to call it. One computation path
per concern. The recompute-mismatch check stays, because it now guards a
different thing: that the client sent what it displayed.

---

## 3. The two baselines, defined exactly

**Baseline A, the last approved.** The version whose `revision_number` is the
highest revision carrying an `approved` decision on the Commercial track for
this record. If there is none, the block says **"never approved"** and shows
block 1 only. It must not quietly fall back to the previous version: that
answers a different question in the same shape, which is the failure mode this
whole round has been finding.

**Baseline B, target.** Not a version. `targetMargin` and `marginOverrides` read
from the **current** payload, because target is a standing intent rather than a
historical fact. Two figures come out of it:

- achieved margin against `targetMargin`, in points
- every line whose `marginOverrides[key] < targetMargin`, with the gap

The second is the one an input screen cannot show. On the input screen a margin
override is a box someone filled in; on the approval page it is a decision to
price a line below the deal's own target, and it should read as one.

---

## 4. The computation

```
now  = buildDealInputs(currentPayload)
base = buildDealInputs(approvedVersion.inputs)
M(x) = calculateDeal(x).achievedMargin

total = M(now) - M(base)

for each payload key k where now.payload[k] differs from base.payload[k]:
    effect(k) = M(now) - M(buildDealInputs({ ...currentPayload, [k]: baseline[k] }))

residual = total - sum(effect(k))
```

**Revert at the payload level, then re-translate.** Not at the dealInputs level.
One payload key rewrites whole derived structures: `installResp` selects between
three different `installLineItems` arrays (`:259-268`), and reverting the derived
array instead of the key would attribute the change to the wrong thing.

### The residual is real and it is not roundoff

Measured on an ordinary three-change re-price (margin priced down 30 to 22 on
SafeSight hardware, unit cost up 1200 to 1380, term 36 to 48 months):

```
hardwareMargins   -2.684 pts
ssUnitCost        +0.078 pts
months            +1.245 pts

total movement    -1.270 pts
sum of the parts  -1.361 pts
RESIDUAL          +0.091 pts
```

The residual is **7% of the movement**. Factoring, WHT gross-up and GST make the
model non-linear, so one-at-a-time effects do not sum, and any presentation that
implies they do is lying to the person who has to sign.

**So the residual gets its own named line and is never distributed across the
others.** "Interaction between these changes" is a true sentence; a proportional
smear is not.

That measurement also produced the second reason this block has to exist:
**`ssUnitCost` rose 15% and margin went UP 0.078 points.** Hardware prices as
cost x margin, so a higher cost raises the price with it, and the ratio moves
against fixed costs rather than with the input. An approver reasoning from the
input screen would get the sign wrong. The block must show the computed effect,
never a plausible narration of it.

---

## 5. What a changed key means

Ordering by form position would be wrong: the form's order is for entering, this
order is for deciding. Rows sort by `|effect|` descending, and each carries the
bucket it belongs to.

| Bucket | Keys | What it tells the approver |
|---|---|---|
| **Priced down** | `targetMargin`, `marginOverrides.*` | Somebody decided to give margin away |
| **Scope** | `ssExisting`, `ssNew`, `aqm`, `hemir`, `duration`, `installResp`, `lumpSumCost` | The deal is a different size or shape |
| **Cost basis moved** | `ssUnitCost`, `aqUnitCost`, `hemirUnitCost`, `inSs*`, `inAqm`, `inHemir`, `hoSafesight`, `hoAqm`, `hoHemir` | Nobody decided this. The catalog reprised underneath |
| **Risk terms** | `warrantyPct`, `whtPct`, `gstPct`, `grossUp`, `fxContingency`, `factoring.*`, `structure`, `recoveryMonths`, `invoicing`, `milestones` | Block 3's exposures, shown here as what moved them |

The third bucket is the one the input screen structurally cannot show, because
those keys are not editable there: they are written from the catalog at save.
Separating it from bucket one is the difference between an approver asking "why
did you discount" and asking "why is this deal worse than the one I approved".

Each row: **what changed, from and to, effect in margin points, effect in
contract net dollars, bucket.**

---

## 6. Where the reason box comes in

Measured, since the question was whether joining it up is the job here.

**It is required, at three layers:** `reason text not null check
(length(btrim(reason)) > 0)` in the schema (`:96`), a 400 with a readable
sentence in the route (`src/routes/deal-sheet-versions.js:84`), and a client
refusal that focuses the box before any request is made
(`frontend/opportunity-deal.js:604`).

**It is read in exactly one place:** `frontend/opportunity-deal.js:568`, as a
`pg-item-note` line under a row in the version list. Nothing in `approvals`
reads it. Nothing else reads it at all.

So it is not "optional and read by nobody". It is **mandatory prose, captured at
the exact moment of the re-price, and shown once as a caption.** Block 2 computes
what moved; the reason is the only place anybody has said why. Putting them side
by side is a display change plus the `revision_number` column from section 2, not
a new field.

That also gives the block its own falsifiability: a reason saying "extended term
at client request" beside a delta whose largest row is a margin override is a
disagreement the approver can see.

---

## 7. What this block must refuse to do

- **Never store the delta.** It is derived from two immutable inputs and stays
  derived. A stored delta is a hardcoded claim with a shelf life.
- **Never substitute a baseline.** No approved version means no block 2.
- **Never distribute the residual.**
- **Never narrate a sign.** The `ssUnitCost` case above shows the intuition and
  the arithmetic disagreeing.

---

## 8. Decisions I am not taking

1. **Is Commercial approval given on a revision or on a version?** Today it is a
   revision, and section 2(a) links them without changing that. If approval
   should be *of a version*, that is a larger and different change.
2. **Nothing ever approved: show delta against V0.1, or show nothing?** Section 3
   proposes nothing. The other reading is defensible.
3. **Does "target" mean `targetMargin` alone, or `targetMargin` plus the
   per-line overrides as they stood at the last approval?** Section 3 reads
   target from now. The alternative makes it a second historical baseline.
4. **Block 4 and 5 treat defaults the opposite way to the input screen.** Noted
   and not designed here.
