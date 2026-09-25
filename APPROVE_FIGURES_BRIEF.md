# Approval-screen zeros round

Branch `approve-figures`, off `main` at `ba9c6f8167d3d055e35b943a054a359d52c8f1a2`,
confirmed equal to `origin/main` by `git ls-remote` against the real remote.

Rule 18 and build discipline 19 govern: this round ends "ready for John's push"
and nothing is pushed from the session.

---

## John's finding, 2026-09-25, verbatim

> Approve pricing now reaches the approval screen, but on TT-SGP-MANUFI-004
> every money figure is ZERO (contract net $0, total cost $0, margin 0.00%, WHT
> $0, GST $0) while Units 26 and Term 60 months populate. The ask reads "Approve
> V1 at 0.0% margin on a contract net of $0", version V1 issued, revision 22,
> reason "test reason 2", author terminus.walk65@gmail.com.

---

## PHASE 0(a): WHERE THE ZERO COMES FROM

**It runs the single derivation. It is starved of its rates.** Neither
hypothesis exactly, and the fix the brief prescribes covers it completely, so
the round proceeds.

The route builds its argument as

```js
catalog: { batches: catalog.batches, missing: catalog.missing, asOf: catalog.asOf }
```

and `buildApprovalPage` opens with

```js
const resolution = resolveRates(payload, catalog.rates ?? {});
```

**`currentRates` returns `{ rates, missing, batches, products, asOf }` and the
object literal carries three of them.** The `?? {}` then consumes the absence, so
`calculateDeal` runs against an EMPTY rate table.

**Unit costs are catalog values and are deliberately NOT stored on a deal**
(R-C2a, the catalog boundary), so every hardware, hosting and per-unit
installation figure collapses to zero while the counts and the term, which do
live on the record, survive untouched. That is the screenshot exactly.

**Measured on the real record rather than reasoned:**

```
the approval page, as the route answers it     contract net 0          units 26
the same derivation with the real catalog      contract net 1,329,982
the same derivation over V1.0's frozen snapshot contract net 1,469,302  margin 21.26%
the same derivation with an EMPTY rate table   contract net 0
  the page and the empty-rate run agree: true
  the record's payload carries a unit cost: false
```

**AND NO UNIT TEST COULD HAVE CAUGHT IT.** `approval-page.test.mjs` passes a
catalog that DOES carry `rates` - added by an earlier round whose own comment
records the page pricing a deal at -6% margin unnoticed - so the suite fed the
page something the route never sends. Verification 47: a fixture shaped by the
reader rather than by the route.

**I walked past this last round.** My approval-view screenshot showed contract
net $285,714 where that deal's sheet said $1,812,848 - installation only,
because `lumpSumCost` is a payload value and survived while everything
rate-derived was zero. My probe asserted the heading rendered and never compared
a figure.

## PHASE 0(b): WHOSE VERSIONS SIT ON WHICH RECORDS

**1,000 versions across 502 records. Author and record owner match in every
bucket**, 951/951, 37/37, 7/7, 4/4, 1/1.

```
NON-BUSINESS versions sitting on BUSINESS-OWNED records:   none
```

**So the zeros are not residue.** `TT-SGP-MANUFI-004` is owned by
`terminus.walk65@gmail.com` and its V1.0 was authored by the same account: a
walk record, walked by John. Its snapshot is real and prices at **$1,469,302**.
**The version is fine; the page could not render it.**

Two things carried to John rather than acted on:

1. **Whether walk-account records count as real.** 37 versions sit on them and
   that is where John walks. They are not `john@`-owned, so a census keyed on
   the business account calls them test data and John may not.
2. **Two business-owned issued versions carry throwaway reasons** - `SMARTC-003`
   V1.0 "testing" and V2.0 "wefasef" - authored by the business account. His own,
   flagged because a required field with no reader becomes ceremony.

**Disposal of anything is John's ruling. This round deleted and marked nothing.**

## THE SHAPE CENSUS BEHIND THE FIX

4,980 versions: **0 with empty inputs**, 4,966 nested `rates.rates`, **0 flat**,
14 with an empty rates column and **none of them issued** - all synthetic
harness drafts on harness-owned records. A flat-shape fallback was written and
removed: no row in the estate could reach it.
