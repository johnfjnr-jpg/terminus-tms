# Fix panel: status

**Written 2026-08-31. This is a STATUS REPORT, not a build.** It was outstanding
and it is first, and the plain answer is at the top rather than at the end.

---

## The plain answer

**None of the four items is built.** The conflict-cluster report landed, its
point 3 was withdrawn and replaced by the stage approvals workflow, and that
workflow then absorbed every boundary since: five migrations, the routes, the
enforcement move, the client and the queue. **The other four items were never
started.**

| # | item | status |
|---|---|---|
| 1 | Installation explanatory text removed | **not started** |
| 2 | Latch grouping: Units Required + Installation | **not started** |
| ~~3~~ | ~~Date rules~~ | **withdrawn**, replaced by the stage approvals workflow, which is built |
| 4 | Assessment: "Regulatory or external driver" | **not started** |
| 5 | Assessment criteria review recorded as a scheduled session | **not started** |

**Item 5 is a documentation record and is the cheapest of the four**, and it has
been outstanding as long as the others.

---

## 1. Installation explanatory text

**Removed entirely: all three paragraphs and the catalog rates line. The option
labels carry the meaning alone.**

### The shipped labels, as ruled

The report is to list them, and these are the four values in
`frontend/index.html`, which are also the stored payload values:

> `Client Own Installation Team`
> `Terminus Contractor - Per Unit`
> `Terminus Contractor - Lump Sum`
> `Terminus - Reseller Installation`

### What comes out, measured

| what | where | today |
|---|---|---|
| "Who installs, and therefore whether installation cost sits in this deal at all." | `index.html:1891` | static |
| the per-option note | `#deal-installResp-note`, rendered from `INSTALL_RESP_NOTES` | **four sentences, one per option**, written by the business |
| "The contractor's fixed price for the whole installation…" | `index.html:1897` | static, lump sum only |
| "Existing infrastructure means mounting on poles…" | `index.html:1886` | static |
| "Rates from batch …, effective …" | `#deal-install-basis` | **the catalog rates line**, rendered |

**Five things, not three**, and the count matters because the ruling names three
paragraphs and the catalog line. **`INSTALL_RESP_NOTES` is the one worth
flagging**: it is four sentences written by the business, one per option, and it
is the thing most likely to be meant by "the option labels must carry the meaning
alone" or most likely to be the exception. **It needs one word of confirmation
before it goes.**

### The supersession this creates

The item 5 readable-width measurement, 48 to 84 characters across both
installation states at both widths, **measured prose that would no longer exist**.
It is superseded by the removal and the supersession is to be recorded beside the
item 5 ruling, not deleted: a measurement that was correct and is now moot reads
differently from one that was wrong.

---

## 2. Latch grouping

**Units Required and Installation become one latch group with one button. Five
latchable becomes four.**

Today, `src/lib/latches.js` holds five panels and the suite asserts
`LATCH_PANELS.length === 5`. The combined panel would carry Installation's signal
capability, and **Units Required contributes none**, which is already measured:
it is one of the two named in `NO_SIGNAL_POSSIBLE` because unit counts sit
outside `ZERO_IS_NOT_A_VALUE` on purpose.

**What the change touches, and the partition test is the interesting one.** The
suite asserts that every key in `ZERO_IS_NOT_A_VALUE` is claimed by exactly one
panel, disjoint and exact in both directions. Merging two panels must keep that
true, and the merged panel inherits `lumpSumCost`, the four install rates and the
four install margins. **The test is what makes the merge safe rather than
plausible**, so it changes in the same commit.

**One consequence to state:** after the merge, `NO_SIGNAL_POSSIBLE` holds only
Cash flow. The "silent by construction" list becomes a list of one, and the test
that asserts every panel NOT on that list can signal must still pass, which it
will, because the merged panel can.

---

## 4. Assessment: "Regulatory or external driver"

**Under the Commercial lens, same four-step scale plus Not applicable. Internal
pain owner unchanged.**

### What is there now, measured

The Commercial lens (`2e83c3cd`) holds **seven** criteria, `sort_order` 1 to 7,
all on the **Deal evidence, five level** scale (`5e6e2176`), whose levels are:

| value | label | reason required |
|---|---|---|
| 1 | Not applicable | no |
| 2 | Unknown | **yes** |
| 3 | Our hypothesis | no |
| 4 | Buyer confirmed | no |
| 5 | Verified | no |

**"Same four-step scale plus Not applicable" IS this scale**, exactly: values 2
to 5 are the four steps and value 1 is Not applicable. **No new scale is
needed**, which is worth saying because it was the obvious thing to build.

`assessOrgPainOwner`, "Internal pain owner", is on the **Organisational** lens and
is untouched, as ruled.

### What the build needs

1. a `scoring_criteria` row: `assessCommRegulatoryDriver`, Commercial lens,
   `sort_order` 8, scale `5e6e2176`
2. **five `scoring_anchors` rows**, one per score. Anchors are per CRITERION, not
   per scale, so a new criterion has none until they are written. **Their wording
   is the business's**, in the voice of the existing ones, and it is the only
   part of this item that cannot be derived
3. no backfill. Existing assessments carry the new row unset, which the ruling
   states and the schema already does: a criterion with no score is unscored

**Lens totals and the `assessmentReviewed` exit criterion follow the data**, so
neither needs a change: both read the criteria table.

**One thing to check before building, not after:** whether `rescore_through_stage`
should be set. Every Commercial criterion has it null today, so the answer is
almost certainly null, and "almost certainly" is what the check is for.

---

## 5. The assessment criteria review, as a scheduled session

**A `DESIGN_PRINCIPLES.md` record, not a build.** A full review of the assessment
criteria, **including the Test Bed scoring anchors simplified in earlier rounds**,
scheduled as its own session after Round 41 closes, with real-use findings as its
input.

**It is a record and it is not written.** Nothing else in this file is that
cheap, and it has been outstanding as long as the rest.

---

## What I would do next, if the order is mine

**5, then 2, then 4, then 1.**

5 is a paragraph. 2 is contained and its test does the hard part. 4 is
mechanical once the anchor wording exists, and the wording is the business's.
**1 is last because it is the only one with an open question in it**, and asking
it is cheaper than building the wrong removal:

> **Do the four per-option notes in `INSTALL_RESP_NOTES` go with the three
> paragraphs and the catalog line?**
