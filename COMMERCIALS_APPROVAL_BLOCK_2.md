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

**(a) `deal_sheet_versions.revision_number`, stamped at creation. BUILT,
2026-08-29**, in `20260829000001_version_carries_its_revision.sql`. Nullable
rather than `not null`: one version row predates the column and is `issued`,
which the immutability trigger refuses to alter, so it carries null and cannot
be approved. Not backfilled. See section 9.

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

## 4. The computation: a sequential bridge

```
opening = calculateDeal(buildDealInputs(approvedVersion.inputs)).achievedMargin

state = approvedVersion.inputs
for each step in ORDER:
    state = { ...state, ...(the changed keys belonging to that step) }
    effect(step) = M(state) - M(previous state)

closing = M(state) = current margin
```

Each effect is measured **on top of the prior one**, not against the current
state in isolation. The steps therefore telescope and the bridge sums to the
total exactly, which is the property that matters: an approver reconciling the
page can arrive at the closing figure from the opening figure by reading down.

### The order, and it is printed on the page

```
units  ->  term  ->  cost basis  ->  discount or override  ->  risk terms
```

Printed as a caption under the bridge, not left implicit, so it reads as a
convention rather than as an arbitrary sequence somebody chose. This is the same
shape as a price/volume/mix/FX bridge in any P&L pack, and an approver has seen
it before.

**Order-dependence is a known and accepted property of this shape**, not a
defect being hidden. It is real here and it is bounded. Measured, same three
changes, documented order against its reverse:

```
                     documented order          reversed
opening              14.038 pts  $235,070      14.038 pts  $235,070
term                 +1.087 pts  +$17,148      +1.245 pts  +$17,148
cost basis           +0.327 pts  +$10,681      +0.136 pts   +$9,626
discount             -2.684 pts   -$8,088      -2.651 pts   -$7,033
closing              12.768 pts  $254,811      12.768 pts  $254,811

total movement       -1.270 pts                -1.270 pts
sum of the steps     -1.270 pts                -1.270 pts
UNEXPLAINED           0.000 pts                 0.000 pts
```

Both reconcile exactly. The individual steps move by up to 0.19 points between
orders, which is why the order is stated rather than assumed.

### Superseded: one-at-a-time plus a residual

An earlier draft of this document proposed measuring each change against the
current state independently and carrying the leftover as an "interaction" line.
Measured, that leftover was **7% of the total movement** on the same three
changes, and it is not roundoff: factoring, WHT gross-up and GST make the model
non-linear.

**A page that reconciles beats one that is purer and leaves 7% unexplained.**
The one-at-a-time figures are more defensible per line and the page as a whole
is then unreadable, because the approver cannot get from the opening figure to
the closing one. That trade goes the other way.

### Revert and apply at the payload level, then re-translate

Not at the dealInputs level. One payload key rewrites whole derived structures:
`installResp` selects between three different `installLineItems` arrays
(`frontend/opportunity-deal.js:259-268`), so applying a derived array instead of
the key would attribute the step to the wrong thing.

### Never narrate a sign

Measured on the same data: **`ssUnitCost` rose 15% and the margin step was
POSITIVE**, +0.327 points. Hardware prices as cost x margin, so a higher cost
raises the price with it and the ratio moves against fixed costs rather than
with the input. An approver reasoning from the input screen would get the sign
wrong, and so would a page that labelled the row from the direction of the
input. Every row shows the computed effect and nothing else.

## 5. The five steps, and which keys belong to each

The bridge steps ARE the buckets. Every payload key belongs to exactly one step,
and the assignment is what makes the order in section 4 mean something rather
than being a sort.

| Step | Keys | What it tells the approver |
|---|---|---|
| **1. Units** | `ssExisting`, `ssNew`, `aqm`, `hemir` | The deal is a different size |
| **2. Term** | `duration`, `recoveryMonths`, `invoicing`, `milestones`, `structure` | It is spread differently over time |
| **3. Cost basis** | `ssUnitCost`, `aqUnitCost`, `hemirUnitCost`, `inSsExisting`, `inSsNew`, `inAqm`, `inHemir`, `hoSafesight`, `hoAqm`, `hoHemir` | Nobody decided this. The catalog reprised underneath |
| **4. Discount or override** | `targetMargin`, `marginOverrides.*`, `installResp`, `lumpSumCost` | Somebody decided to give margin away |
| **5. Risk terms** | `warrantyPct`, `whtPct`, `gstPct`, `grossUp`, `fxContingency`, `factoring.*` | Block 3's exposures, shown here as what moved them |

**Step 3 is the one the input screen structurally cannot show**, because those
keys are not editable there: they are written from the catalog at save
(`frontend/opportunity-deal.js:148-166`). Separating it from step 4 is the
difference between an approver asking "why did you discount" and asking "why is
this deal worse than the one I approved".

Each step shows: **the keys that moved, from and to, the step's effect in margin
points, and the step's effect in contract net dollars.** A step where nothing
moved is omitted; a step where several keys moved is one row with the keys
listed, because the effect is measured for the step, not per key. Splitting a
step into per-key lines would reintroduce exactly the attribution problem
section 4 rejected.

`installResp` and `lumpSumCost` sit in step 4 rather than step 1 deliberately:
they change who installs and at what price, which is a commercial choice, not a
change in how much equipment the client is getting.

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
- **Never reorder the bridge per deal.** The order is a convention; choosing it
  per deal to make a story land is exactly what a bridge is for and exactly what
  makes one worthless.
- **Never narrate a sign.** The `ssUnitCost` case above shows the intuition and
  the arithmetic disagreeing.
- **Never present the bridge without its opening and closing figures.** The
  reconciliation is the reason it is a bridge rather than a list.

---

## 8. Decisions I am not taking

1. ~~**Is Commercial approval given on a revision or on a version?**~~ **TAKEN,
   2026-08-29: of a VERSION.** A revision is a save and thirty of them can mean
   nothing; a version is the commercial object, self-sufficient, reproducible,
   carrying its own catalog rates and a mandatory reason, and it is what goes to
   the customer. Implemented without fragmenting the engine: `approvals` stay
   keyed to a record revision, which is deliberate and record-type agnostic; the
   version carries the revision it was taken from; approving V1.2 is approving
   that revision. See section 9.
2. **Nothing ever approved: show delta against V0.1, or show nothing?** Section 3
   proposes nothing. The other reading is defensible.
3. **Does "target" mean `targetMargin` alone, or `targetMargin` plus the
   per-line overrides as they stood at the last approval?** Section 3 reads
   target from now. The alternative makes it a second historical baseline.
4. **Block 4 and 5 treat defaults the opposite way to the input screen.** Noted
   and not designed here.

---

## 9. What was built, 2026-08-29

Decision 1 in section 8 was taken: **approval is of a version.** Implemented
without forking the engine.

| | |
|---|---|
| `approvals` | unchanged, still keyed to `(record_id, revision_number, track, approver_id)` and still record-type agnostic |
| `deal_sheet_versions.revision_number` | new, nullable, not backfilled |
| `deal_sheet_versions_immutable()` | extended in the same migration, so a draft-to-issued relabel cannot move the revision a version names |
| `src/lib/version-approval.js` | the one evaluator, derived on every read, never stored |
| `POST .../deal-sheet-versions` | requires `expected_revision`, refuses 409 if the record moved, stamps it |
| `GET .../deal-sheet-versions` | returns `approval: { state, revisionApproved, revisionsSince, ... }` per version |

**Any revision after approval voids it.** An approval at revision N reads
`superseded` the moment revision N+1 exists, and the version list says so in a
sentence naming how far the record has moved. Without it an approval means
"something was once approved", which is worse than none because it looks like
control.

Evidence, `scripts/probe-version-approval.mjs`, 13/13 over HTTP:

```
PASS  a version with no expected_revision is refused          -> 400
PASS  a version naming a revision the record has left         -> 409
PASS  the version carries the revision it was taken from      revision_number=1
PASS  approving that revision approves the version            state=approved
PASS  ONE revision after approval voids it                    approved -> superseded
PASS  and the page can say how far it has moved               revisionsSince=1
PASS  a new version approved at the current revision          state=approved
PASS  and the superseded one STAYS superseded                 state=superseded
```

**Still to build for block 2 itself:** prerequisite (b), moving
`buildDealInputs` into `src/lib/`, and then the bridge in sections 4 and 5.

### The window that is not closed, stated rather than claimed closed

The version POST reads the record's current revision and refuses if it differs,
then inserts. A revision landing between those two would leave the version
naming the revision the client saw while the record has moved on. **That is not
a lock and calling it one would be exactly the kind of label CLAUDE.md
Verification 19 was written about.**

What makes it small: every Opportunity payload writer now carries its own
precondition, so a concurrent write is a deliberate guarded act rather than a
stray save. Closing it properly means inserting the version inside the same
advisory lock `append_record_revision` takes, which is a Postgres function this
change did not need and the next one may.
