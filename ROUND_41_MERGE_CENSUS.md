# Round 41 item 4: the merge census

**REPORT ONLY. No merge code has been written.** The one code change made while
taking this census is named in full at the end: it is a defect this round created,
found by the census, in one of the two blocks about to be merged.

**Row counts prove nothing here**, because the merge changes rows deliberately.
This is a census of FACTS: a labelled figure, in a named column, under a named
condition.

---

## The method, stated first, and it runs in both directions

**A census taken one way is a census of one deal.** `CLAUDE.md` rule 33: every
measure has a shape, and what falls outside it is found by looking or not at all.

### Direction one, from the source

Both blocks build a `rows` array of literal objects, so every row and every
branch is enumerable by reading the file. Read through the comment stripper
(`CLAUDE.md` Verification 39), so a sentence describing a row cannot be counted
as a row.

| file | render path | enumerated |
|---|---|---|
| `frontend/opportunity-deal.js` | `renderDealMatrix(result, payload)` | **8 rows × 4 columns** |
| `frontend/opportunity-deal.js` | `renderDealSheet(result, payload)` | **17 rows × 1 value** |
| `frontend/opportunity-deal.js` | `computeDealMatrixCols(result, payload)` | what each matrix column contains |
| `frontend/opportunity-deal.js` | `renderResults(result, payload)` | the three message lines in the same section |
| `src/lib/deal-inputs.js` | `gstPresentation`, `whtPresentation`, `durationPresentation`, `ratePresentation` | **every label variant**, both branches each |
| `frontend/index.html` §4 | static markup | the two headings, the GST field-note, the unit count slot |

**This direction finds rows no reachable deal state can produce**, which is why
it is first.

### Direction two, from the screen

`scripts/probe-fact-census.mjs` drives the real page through **18 conditions**
and collects every rendered label and value from both blocks.

**Each condition is a delta from a KNOWN BASE, not from the condition before
it.** The first version applied them cumulatively, so by the time `gross up off`
ran an earlier step had already set the WHT rate to 0 and the absorbed-WHT row
could only ever read all dashes. **That is a sweep of one PATH through the
condition space presented as a sweep of the space**, and the rows it never
reached looked like rows that do not exist. Corrected, the row produces
`H=$81,890 Ho=$41,656 I=$49,714 T=$173,260`.

Conditions swept: as loaded · GST cleared / 7 / 0 / 8 · WHT cleared / 10 / 0 / 15
· duration cleared / 36 · gross up on / off · factoring off / on with term / on
with term cleared · structure single / twoPhase / hybrid · WHT 15 with gross up
OFF · WHT cleared with gross up OFF.

**Result: 16 distinct matrix labels and 32 distinct Result labels observed**,
against 8 and 17 source rows. The multiplier is the label variants: a row whose
label names a rate has one label per rate state.

### What direction two could NOT reach, named rather than reported as absent

Three branches exist in the source and no condition on this screen produces them.
They are in the census on the strength of the source read alone.

| branch | why unreachable here |
|---|---|
| `deal-milestone-warn` | fires only on **hybrid AND a milestone schedule that does not reconcile**. TT-SGP-SMARTC-003 has no milestones, so `msRec.hasSchedule` is false. |
| `Test Bed cost, carried from conversion` with a figure | `testBedCost` arrives from **conversion**, not from any control on this screen. Always `-` on this deal. |
| matrix `of which financing` on Hosting or Installation | hardcoded `'-'` in both columns; **no deal state can put a figure there.** |

**The only live opportunity carrying any units is TT-SGP-SMARTC-003.** The other
three read `$0` on every figure, so they exercise no branch this one does not.

---

## Part A. Every fact rendered today

### A1. The Deal Summary matrix, `#deal-matrix`

Four columns throughout: **Hardware (USD), Hosting (USD), Installation (USD),
Total (USD)** — four facts in the head row.

| # | row | columns carrying a fact | conditional? |
|---|---|---|---|
| 1 | Revenue | H, Ho, I, T | no |
| 2 | Cost | H, Ho, I, T | no |
| 3 | of which financing | H, T | **yes, three states** |
| 4 | of which withholding tax absorbed by Terminus | H, Ho, I, T | **yes**, each column dashes at zero |
| 5 | Margin | H, Ho, I, T | no |
| 6 | Withholding tax deducted | H, Ho, I, T | **yes, two label variants** |
| 7 | GST | T only | **yes, two label variants, three value states** |
| 8 | Price to customer | T only | **yes, two label variants** |

**Row 3, `of which financing`** — the three states, all observed:

| state | condition | renders |
|---|---|---|
| a figure | factoring on, term recorded | `$252,794` (H and T) |
| `-` | factoring off, or no interest | `-` |
| `not recorded` | factoring on, `factoring.termMonths` absent | `not recorded` |

**Row 6 label** — `whtPresentation`: `Withholding tax at N%, deducted by the
customer` when `whtPct` is set, `Withholding tax, not recorded` when it is not.
When not recorded, H/Ho/I are `-` and T reads `not recorded`.

**Row 7 label** — `gstPresentation`: `GST at N%, added to the invoice` or `GST,
not recorded`. T reads a figure, `-` at a recorded 0%, or `not recorded`.

**Row 8 label** — `Price to customer, contract price plus GST` or `Price to
customer, excludes GST`.

**What row 2 CONTAINS is itself a fact and it is not visible as one.**
`computeDealMatrixCols` folds **finance cost, test bed cost and the WHT absorbed
apportionment** into the Cost row before Total and Margin are computed. So the
matrix's Cost is a different decomposition from the Result list's cost lines,
and this matters for the merge. See Part B.

### A2. The Result list, `#deal-sheet`

One value per row, plus the heading.

| # | row | conditional? |
|---|---|---|
| 0 | heading: **`Result (USD) · N units`** | `N` = `result.hardware.totalUnits`, **a fact the matrix does not carry** |
| 1 | One-off price, hardware, warranty and installation | no |
| 2 | Hosting price over N months / **contract duration not recorded** | **yes** |
| 3 | Revenue, contract value net | no |
| 4 | Hardware and warranty cost | no |
| 5 | Installation cost | no |
| 6 | Hosting cost over N months / **contract duration not recorded** | **yes** |
| 7 | PO factoring interest | **yes, three states** |
| 8 | Withholding tax absorbed by Terminus / **grossed up and recovered from the customer** | **yes**, on `grossUp` |
| 9 | Test Bed cost, carried from conversion | **yes**, `-` when zero |
| 10 | Total cost | no |
| 11 | Gross margin | no |
| 12 | Invoice reconciliation, from revenue | no |
| 13 | Grossed up for WHT at N% / rate not recorded / **No gross up, WHT absorbed** | **yes**, three labels |
| 14 | GST at N%, passed through / GST, not recorded | **yes**, three value states |
| 15 | Price to customer … (+ `, grossed up for WHT`) | **yes**, four labels |
| 16 | Withholding tax deducted | **yes**, three value states |
| 17 | Net receipt after WHT | no |

### A3. In the same section, and in the census because the merge moves the panels around them

| element | fact | condition |
|---|---|---|
| heading | `Deal Summary (USD)` | always |
| `.field-note` | "Contract prices are quoted exclusive of GST…" | always, static |
| `#deal-cashflow-ok` | `Cash position stays positive throughout the term. Lowest cash position: X in month N.` | `minCash >= 0` |
| `#deal-cashflow-warn` | `Cash position goes negative. Lowest cash position: X in month N.` | `minCash < 0` |
| `#deal-milestone-warn` | milestone total against the hardware and installation price, with the reconciliation statement | **hybrid AND a schedule that does not reconcile** |

---

## Part B. Every fact the merged panel displays

**One P&L walk, with the per-group split as its expansion.** The Result list's
17 rows are the complete story from price to net receipt; the matrix's four
columns are an **orthogonal cut of the same money, by product group**. So the
merge is not one list absorbing the other: it is **one set of rows gaining three
columns.**

| merged row | value | H / Ho / I split available |
|---|---|---|
| One-off price, hardware, warranty and installation | as today | H + I |
| Hosting price over N months *(or not recorded)* | as today | Ho |
| **Revenue, contract value net** | as today | **H, Ho, I** — the matrix's Revenue row |
| Hardware and warranty cost | as today | H |
| Installation cost | as today | I |
| Hosting cost over N months *(or not recorded)* | as today | Ho |
| PO factoring interest *(figure / `-` / `not recorded`)* | as today | H |
| Withholding tax absorbed *(or grossed up and recovered)* | as today | **H, Ho, I** — the matrix's apportionment |
| Test Bed cost, carried from conversion | as today | H |
| **Total cost** | as today | **H, Ho, I** — the matrix's Cost row |
| **Gross margin** | as today | **H, Ho, I** — the matrix's Margin row |
| Invoice reconciliation, from revenue | as today | total only |
| Grossed up for WHT *(three labels)* | as today | total only |
| GST *(three states)* | as today | total only |
| Price to customer *(four labels)* | as today | total only |
| Withholding tax deducted *(three states)* | as today | **H, Ho, I** — the matrix's row 6 |
| Net receipt after WHT | as today | total only |
| heading | `Result (USD) · N units` | the unit count survives |
| four column names | Hardware / Hosting / Installation / Total | shown with the split |
| the GST field-note | as today | always |
| the three message lines | as today | unchanged conditions |

**Every fact in Part A appears in Part B.**

---

## Part C. Facts that disappear

**None.**

Named individually, because "none" is the answer that most needs its working
shown. Each fact that exists in only one of the two blocks, and where it lands:

| fact, and which block holds it today | in the merged panel |
|---|---|
| **unit count** (Result heading only) | kept, on the merged heading |
| one-off price, hosting price (Result only) | kept as rows |
| hardware / installation / hosting cost as separate lines (Result only) | kept as rows |
| test bed cost (Result only) | kept as a row |
| invoice reconciliation, gross-up amount, net receipt after WHT (Result only) | kept as rows |
| **Revenue split by group** (matrix only) | kept, as the Revenue row's expansion |
| **Cost split by group** (matrix only) | kept, as the Total cost row's expansion |
| **Margin split by group** (matrix only) | kept, as the Gross margin row's expansion |
| **WHT-absorbed apportionment by group** (matrix only) | kept, as that row's expansion |
| the four column names (matrix only) | kept |
| GST field-note (section only) | kept |

**And one duplication is deliberately resolved rather than kept twice.** Revenue,
Total cost and Margin each appear in both blocks, forty rows apart, with the same
figures. In the merged panel each is **one row with a split**, which is what makes
the merge a merge rather than a relocation.

---

## RULED 2026-08-30. Both are recorded here so the census carries its own defence

### RULING 1: UNFOLD. One arithmetic story, disjoint rows summing to Total cost

**Ruled by the business.** Finance cost, test bed carried and absorbed WHT become
**their own unsplit full-width rows below the product-split rows**. Total cost is
the **visible sum of everything above it**. No "of which" memo lines that also
live inside the total.

**The reason, recorded with the decision:** on an approval surface **a column an
approver can sum and match beats a compact fold**, and the census named the cost
of the alternative precisely: *somebody will add them up.*

**THREE FOLDED FACTS END WITH THE FOLD, and none of them may go quietly.** Each
is a consequence of the ruling rather than an oversight, and each is named with
what replaces it.

| what ends | what it was | why it ends |
|---|---|---|
| **the WHT-absorbed apportionment across Hardware / Hosting / Installation** | `whtBorne` split pro-rata by price share, remainder to the last column | It is an **apportionment computed for display**, not a measured allocation of anything. Ruling 1 makes absorbed WHT a full-width row, so the split has nowhere to sit and nothing to reconcile against. |
| **finance cost and test bed cost sitting inside the Hardware column** | both added to `cols[0].cost` before Total and Margin | Neither is a hardware cost. They were folded there so the matrix's Total and Margin matched `achievedMargin`; unfolding is what ruling 1 asks for, and the sum stays visible instead. |
| **the per-column Margin as currently defined** | `price − cost` where cost includes the three folded items | The figure changes meaning once the fold goes. **It is not deleted: it becomes a per-column margin BEFORE the three deductions**, with a label that says so, and the three full-width rows below reconcile it to Gross margin. |

**The last one is a row whose LABEL must change, not a row that disappears.**
Called `Margin` after the unfold it would name a different number from the one it
names today, which is the shape `CLAUDE.md` Architecture 9's fourth variant
warns about: a string that stopped being true when the thing under it moved.

**The merged shape ruling 1 produces**, and every line sums:

```
                                        Hardware   Hosting   Installation   Total
  One-off price, hardware, warranty and installation
                                            H          -           I          T
  Hosting price over N months                -         Ho          -          T
  Revenue, contract value net                H         Ho          I          T
  Hardware and warranty cost                 H          -          -          T
  Installation cost                          -          -          I          T
  Hosting cost over N months                 -         Ho          -          T
  Margin before financing, test bed and withholding
                                             H         Ho          I          T
  PO factoring interest                   ─────────── full width ─────────    T
  Test Bed cost, carried from conversion  ─────────── full width ─────────    T
  Withholding tax absorbed by Terminus    ─────────── full width ─────────    T
  Total cost                                                                  T   = the six cost rows
  Gross margin                                                                T   = Revenue − Total cost
```

### RULING 2: the hardcoded dash cells are NOT FACTS

**Ruled by the business.** The `of which financing` row's **Hosting and
Installation** cells are the literal string `'-'` in the source, in both columns,
under every condition. **No deal state can put a figure there.**

They are **empty by construction**, so they may cease to exist in the merge
**without amending this census**, and **Part C's "no fact disappears" stands
unqualified.**

**The distinction the ruling draws, and it is worth keeping:** a cell that
renders `-` because a value is zero is a fact about the deal. A cell that renders
`-` because the code has no expression for it is a **hole in a grid**, and
counting it would inflate the census with cells that report nothing. This is the
same test `CLAUDE.md` Architecture 9's fourth variant applies to a hardcoded
claim: a literal is not derived from anything, so it cannot be falsified by
anything, and it is not evidence.

---

## STILL OPEN, REPORT ONLY: the two breakdowns

**The question.** The brief says the breakdown expands **inside** the panel
"rather than beside it". Round 40 Phase 3 built `#btn-toggle-detail` /
`#deal-detail-panel` to open **beside** the summary, quoting the business's own
layout words:

> "the option to select to open the detailed revenue and costs per unit /
> summary totals etc horizontally next to the deal sheet summary panel"

`CLAUDE.md` Verification 23: two correct decisions about the same behaviour, taken
in different rounds, produce a conflict nothing detects. **Are these two
different breakdowns, or one superseding the other?**

### The answer the enumeration gives: TWO BREAKDOWNS, DIFFERENT IN KIND

They differ on **three axes at once**, which is what makes neither a candidate to
supersede the other.

| | (a) the detail panel, BESIDE | (b) the matrix columns, the merge's split |
|---|---|---|
| **grain** | per PRODUCT LINE, 11 lines | per PRODUCT GROUP, 3 columns |
| **editable** | **yes.** Eleven `deal-margin-*` inputs | **no.** Read-only figures |
| **period** | hosting is **per month** | hosting is **over the term** |
| **covers** | cost, margin %, price | revenue, cost, margin, and today the WHT apportionment |
| **opened by** | `#btn-toggle-detail` | would be the merged panel's own expansion |

### (a) enumerated in full, and it is NOT all in one place

**This is the finding of the enumeration.** "The detail panel" holds seven of the
eleven lines. **The four installation lines live in section 2, in
`#deal-install-table`**, under a different heading, behind a different
condition.

**In `#deal-detail-panel`, beside the summary** (`frontend/index.html`
2099-2185, rendered by `renderPricingCards`):

| card | lines | per line | card total |
|---|---|---|---|
| **Unit cost and warranty** | hwSs, hwAqm, hwHemir, hwWarranty | name, basis note (`N units x $C`), cost, **margin % input**, price | cost, price |
| **Hosting (per month)** | hoSs, hoAqm, hoHemir | same | cost, price |

plus `#deal-catalog-notice` (batch and effective date, or a product with no
current batch, or a non-USD bid currency) and `#deal-catalog-warn`, and the
heading `Detail, per line` with `Computed pricing (USD) · costs mirrored from
Base Cost Data`.

**In `#deal-install-table`, section 2 Installation** (`frontend/index.html`
1888-1900), and **hidden unless per-unit installation is chosen**:

| lines | per line | total |
|---|---|---|
| inSsEx, inSsNew, inAqm, inHemir | label, **units**, **rate input**, cost, **margin % input**, price | cost, price |

**So (a) is complete only when read across two sections**, and its installation
third is conditional on the installation responsibility while the other two
thirds are not.

### The overlap, measured on TT-SGP-SMARTC-003 rather than reasoned

**(a)'s per-line figures sum EXACTLY to (b)'s columns.** Not approximately, and
not by construction of the display: both read the same `result.groups`.

| group | (a), summed from its lines | (b), the column |
|---|---|---|
| hardware | cost $382,154 · price $545,934 | cost $382,154 · price $545,934 |
| hosting | cost **$5,400/mo** · price **$7,714/mo** | cost **$194,400** · price **$277,704** *(× 36 months)* |
| installation | cost $232,000 · price $331,428 | cost $232,000 · price $331,428 |

**The hosting row is the one that would mislead.** (a) and (b) show the same
group in different periods, and nothing on either says so beyond the card title's
`(per month)`. If the two are ever shown together, that is the line to label.

### What this means for the ruling, stated as options rather than as a recommendation

1. **Both, unchanged in kind.** The merged panel expands to the group split
   inside; `Show detail` keeps opening the per-line pricing beside. Two buttons,
   two breakdowns, no fact moves. **The layout words are satisfied by both**,
   because they describe (a) and the brief describes (b).
2. **Both, with the installation third brought home.** As above, and (a) stops
   being split across two sections. That is a change to section 2 and outside the
   merge.
3. **One breakdown.** (b) becomes the expansion and (a) folds into it as a second
   level. **This is the only option that touches editing**: the eleven margin
   inputs live in (a), and `CLAUDE.md` Verification 20's addendum applies with
   force, because a control that edits a value is also what supplies it on save.
   Round 40 already met that exact failure with these exact eleven inputs.

**No recommendation, and the reason is that this is a layout ruling.** What the
enumeration establishes is that **nothing is forced**: no fact is duplicated
between (a) and (b) except the group totals, which (b) derives from the same
source (a) itemises.

---

## The defect the census found, and it is this round's own

**Ruling 5 taught the matrix to say `not recorded` when factoring is on with no
term. Its neighbour still said `-`, which everywhere else on that list means
zero. Two blocks about to be merged, disagreeing about the same fact.**

That is Round 39's GST fault reintroduced by the round that was removing it, and
the merge would have carried one of the two forward.

**A third surface had the same state.** With no term the schedule is empty, so
the cash flow grid printed `Factoring principal repayment` and `Factoring
interest` as **a full run of zeros across the term** for a facility that is
switched on.

| surface | before | now |
|---|---|---|
| matrix, `of which financing` | `not recorded` | `not recorded` |
| Result, `PO factoring interest` | **`-`** | `not recorded` |
| cash flow grid | **a term of zeros** | one row: `Factoring, term not recorded` |

Fixed, because `CLAUDE.md` rule 10's limit is authorship: a defect the round
introduced is part of the change, not a queue item. All three now branch on the
same `costIncomplete` / `factoringTermMissing` flag rather than each testing for
absence its own way, and a test asserts the count of readers and the order of the
guard.

## Where the evidence is

`.verify/census/census.json` holds every observed label and every distinct value
per label per condition. `scripts/probe-fact-census.mjs` reproduces it:

```bash
PUPPETEER_PATH=/tmp/tms-probe/node_modules/puppeteer/lib/puppeteer/puppeteer.js node scripts/probe-fact-census.mjs
```
