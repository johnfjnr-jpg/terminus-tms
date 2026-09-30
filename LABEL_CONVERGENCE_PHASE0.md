# LABEL CONVERGENCE, PHASE 0: MEASUREMENT

Investigate only, no code. **Two STOPs, and one of them ends the round's L3 as
written.** Reported for sign-off.

---

## 0.1 BASE

`git ls-remote origin main` = **`6550b09`**, equal to local `main`. Tree clean.
Branch `label-convergence` created, brief committed verbatim at `df2d80d`
before any other commit.

**26 remote branches**, one of which is not a round branch:
`claude/admiring-maxwell-0k6gk4`. Named because it is the only unexplained one.

---

## 0.2 THE LABEL CENSUS. THE COUNT IS NOT SEVEN

Structural census over **875 files**, comments stripped, calibrated: the
composer itself must be seen, and it is.

### The rule itself is implemented FOUR times in production, not once

| site | |
|---|---|
| `src/lib/version-label.js:29-30` | the composer |
| `src/routes/deal-sheet-versions.js:760` | a full copy of the ternary |
| `src/routes/transition-requests.js:662` | a copy |
| `src/routes/records.js:77-79` | a copy, split across three lines |

**THE EXISTING GUARD CANNOT SEE ANY OF THE THREE.**
`version-label.test.mjs` enumerates **a hardcoded list of five files** and none
of them is in `src/routes/`. It reports clean and has been reporting clean while
three copies sat outside its list. Verification 19 exactly: an enumeration by
NAME fails on the unrecorded instance.

### And ~12 further ad-hoc compositions in user-facing strings

`src/routes/deal-sheet-versions.js` 549, 650, 653, 721 (refusals and audit
detail) · `src/routes/transition-requests.js` 210, 297 · `frontend-react/src/versions/model.ts`
184, 222, 223 · `frontend/app.js` 1339, 1344, 6999.

**`frontend/app.js:6999` is the Approved Version field** and it is the awkward
one: it composes from `opp.issued_major` **alone**, so it has no minor to print.
Printing `V1.0` there means either deriving `.0` from the rule that an approved
version is always `x.0`, or carrying the minor through. **That is a decision,
not an implementation detail, and it is flagged rather than assumed.**

---

## 0.3 THE ISSUE/ISSUED CENSUS

**58 user-facing lines** about versions and approval, plus **7** that are a
different sense of the word entirely (issuing an Account Number or a reference
number, all log lines, none user-facing). The 7 are out of scope by meaning.

### AND ONE AMBIGUITY IN L4 THAT NEEDS YOUR RULING BEFORE IT IS BUILT

L4 says *"user-facing copy that says issue/issued for the approval event becomes
approve/approved"*, and defines APPROVED as *"the version through the Approve
pricing gate"*.

**There are two distinct events today, and the copy is about both:**

1. **Issue a version** - promoting a draft to a major (`POST /deal-sheet-versions/:vid/issue`,
   the `Issue V0.3 as V1` button). This is what sets `status = 'issued'`.
2. **Approve the version** - the pricing approval gate, where named approvers
   sign off on tracks (`transition-requests`).

L4's definition names the second. But *"the DB status word stays `issued`"*
points at the first, because that is the word event 1 writes.

**Which of the two becomes "approve/approved" in copy changes roughly 40 strings
or roughly 15.** I have not guessed. Phase 1 needs the ruling.

---

## 0.4 L2 DRIVEN. CONFORMING, 9 OF 9

Driven through the real routes on a fresh opportunity, then torn down.

```
after three saves        V0.1/draft  V0.2/draft  V0.3/draft
after issuing the newest V0.1/draft  V0.2/draft  V1.0/issued
after two more saves     ... V1.0/issued  V1.1/draft  V1.2/draft
after the second approval ... V1.0/issued  V1.1/draft  V2.0/issued
```

- explicit save bumps the MINOR: V0.1, V0.2, V0.3 **PASS**
- approving relabels **IN PLACE** to `<major>.0`: 3 rows before, 3 rows after **PASS**
- later saves go x.1, x.2 **PASS**
- the next approval goes to (x+1).0 **PASS**

**R-VL1..3 conform.**

### AND THIS IS L1's WHOLE DEFECT, IN ONE VIEW

The same versions, printed by the composer:

```
V0.1 (draft)   -> "V0.1"
V1.0 (issued)  -> "V1"      <-- the data says 1.0
V1.1 (draft)   -> "V1.1"
V2.0 (issued)  -> "V2"      <-- the data says 2.0
```

**The stored numbering is already correct. R-VL4 is purely a DISPLAY
convergence**, which is a materially smaller and safer change than it reads.

---

## 0.5 FROZEN RATES

Measured over **every one of 5,515 versions**, with the walk asserted equal to
the exact count before any conclusion was drawn.

```
nested rates present  5,501
flat (legacy shape)       0
EMPTY rates column       14      all 14 are DRAFTS
of those, ISSUED          0      <- H2's population today
```

**H2's condition does not exist in the data.** The 14 match a census recorded in
`approval-page.js` some rounds ago, so the population has not grown.

**But the state is REACHABLE, which is the part that matters.** Rates are frozen
at CREATE (`deal-sheet-versions.js:497`), not at issue, and the issue route
checks only `status === 'draft'`. **Issuing any one of those 14 existing empty
drafts would produce exactly the state H2 refuses.** So H2 is a live gap, not a
historical one, and it needs no synthetic fixture: a real empty draft exists.

### A NEAR-MISS OF MY OWN, RECORDED

My first reading said *"3,217 issued versions, 1,000 with empty frozen rates"*.
**Both figures were wrong and the second was wrong twice.** The query was capped
at PostgREST's 1,000-row default while `count` reported 3,217, and I was reading
`inputs.rates` when the authoritative accessor is the **`rates` column**, nested
as `rates.rates` (`approval-page.js:845`). Caught by the result being too
uniform to be true. The figures above come from a paged walk with coverage
asserted.

---

## 0.6 REACHABILITY: BOTH YES

- **`pricingChanged`** is exported from `src/lib/version-pricing.js` and already
  imported by `version-approval.js`, `transition-requests.js` and
  `opportunity-headline.js`, all server-side. The approval page also already
  builds a `moved` structure with a baseline label. **H1 has its input.**
- **Frozen batch dates** are on the version: `deal-sheet-versions.js:497-503`
  freezes `batches`, `missing` and `as_of` into the `rates` column.
  **H3 is confirmed as a real defect with a reachable fix:** `approval-page.js:848`
  passes `catalog.batches, catalog.missing, catalog.asOf` - **today's catalog** -
  where two lines above it, `pricedRates` already correctly prefers
  `version.rates.rates`. H3 is the same re-point, one line later.

---

## THE TWO STOPS

### STOP 1. L3 FAILS AS WRITTEN

> *"R-REV2 VERIFY ONLY: lumpSumCost is in the fundamental-input clear list.
> Absent: STOP."*

**It is absent.** `FUNDAMENTAL_VALUE_IDS` (`payload.ts:73`) holds the four
counts, duration, warrantyPct and the four installation rates. **`deal-lumpCost`
is not there, under either spelling.**

**And the absence is deliberate and already on the record**, which is why this
is a ruling rather than a defect. `payload.ts:68` says:

> *"DELIBERATELY ABSENT, and reported rather than assumed: `lumpSumCost` is an
> absolute the derivation does not multiply by anything... Carried to John as the
> one judgement call in this list."*

The stated test for the list is *a figure for a QUANTITY*: change the quantity
and the figure silently prices a different deal. A lump sum is an absolute that
no quantity multiplies, so by that test it does not belong. **R-REV2 says it
does.** The two disagree, and it is yours to settle:

- **(a) R-REV2 governs**: add `deal-lumpCost`, and the list's stated test needs
  rewording, because the lump sum does not satisfy it.
- **(b) the code's position governs**: R-REV2 is amended to exclude it, and the
  reasoning already written is promoted to the decisions doc.

### STOP 2. L4's TWO EVENTS

Section 0.3. Which event's copy becomes approve/approved.

---

## WHAT PHASE 0 DOES NOT ESTABLISH

- **No screenshots yet.** Every label finding above is from source and from
  driving the API. What a person sees at 1240 and 1920 is Phase 1's evidence.
- **The census covers composition, not consumption.** A site that receives a
  label from the server and prints it is correct today and is not in the count.
- **The 58 issue/issued lines are classified by meaning, not by surface.** Which
  of them a user actually sees needs the walk.
