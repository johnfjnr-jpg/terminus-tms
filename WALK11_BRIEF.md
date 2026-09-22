# Walk 11: the brief, and Phase 0

Branch `walk11`, off `main` at `5632035`, confirmed equal to `origin/main` by
`git ls-remote` against the real remote rather than the local tracking ref.

Rule 18 governs: **this round ends "ready for John's push"** and nothing is
pushed from the session.

**Deal sheet reorganization is EXCLUDED pending design.**

---

## The findings, verbatim

> **D1, the contacts card coheres (John's rulings):** the row becomes a proper
> grid presentation consistent with the estate's data grids; the stance note
> input gains a label or placeholder saying what it is (its purpose per the
> stance history design: a short note recorded with the stance); the Record
> button becomes "Save"; feedback vocabulary unifies on Saved (the "Recorded."
> text goes). Estate-wide check: report any other surface still using
> Record/Recorded so the vocabulary closes whole.
>
> **D2, Tax Adjustments moves beside Currency (John's ruling, superseding the
> walk-8 span):** the label shortens to "WHT %" (the estate's abbreviation),
> MEASURE that the one-line row now fits inside a standard 460px card at both
> widths, and the card takes the grid position next to Currency. If the
> measurement still misses, STOP and report the number.
>
> **D3, Installation as its own line in Unit Cost and Warranty with an
> adjustable margin %:** Phase 0 FIRST measures how the installation price
> derives today (where $285,714 comes from, which margin feeds it, what writes
> it), reports the mechanism, then adds the line so its margin control drives
> the same single derivation the summary and cash flow read. The R-N1
> percentage-authoritative principle governs: one derivation, all readers. DB
> read-back on the stored margin.

---

## PHASE 0, D3: THE MECHANISM, MEASURED

### Where $285,714 comes from

`TT-SGP-MANUFI-004`, read from its latest revision:

```
installResp            "Terminus Contractor - Lump Sum"
lumpSumCost            200000
targetMargin           30
marginOverrides.inLump (none)

price = round(200000 / (1 - 30/100)) = 285714
```

and the figure `$285,714` was then read off the live screen, so the
derivation is confirmed at both ends rather than only in arithmetic.

### The chain, in full

| step | where |
|---|---|
| `marginFor(key) = overrides[key] ?? targetMargin` | `src/lib/deal-inputs.js:369` |
| lump-sum line `{ key: 'inLump', cost: lumpSumCost, marginPct: marginFor('inLump') }` | `deal-inputs.js:396` |
| `rawPrice = priceFromCost(cost, marginPct)` | `deal-calculator.js:130` |
| `oneOffPrice = hardwareGroup.rawTotalPrice + installGroup.rawTotalPrice` | `deal-calculator.js:209` |

**One derivation already.** The summary matrix, the Deal Sheet's one-off price
row, the cash flow and the milestone warning all read `installGroup` through
`calculateContractTotals`. Nothing computes an installation price a second
way, so R-N1's principle is satisfied today and the round must not break it.

### WHICH MARGIN FEEDS IT: the target, always, and nothing can change that

**All four live lump-sum opportunities carry no `inLump` override:**

```
TT-SGP-SMARTC-003   250000 @ 30%  (none) -> 357143
TT-SGP-MANUFI-004   200000 @ 30%  (none) -> 285714
TT-SGP-SMARTC-113   300000 @ 30%  (none) -> 428571
TT-SGP-SMARTC-112   250000 @ 30%  (none) -> 357143
```

### WHAT WRITES IT: nothing, and the reason is an allowlist

```js
// frontend-react/src/deal/payload.ts:27
export const MARGIN_KEYS = [
  'hwSs', 'hwAqm', 'hwHemir', 'hwWarranty', 'inSsEx', 'inSsNew',
  'inAqm', 'inHemir', 'hoSs', 'hoAqm', 'hoHemir',
]
```

**Eleven keys, and `inLump` is not one of them.** `readDealPayload` builds
`marginOverrides` by looping that list, and `hydrate` fills the boxes from the
same list. So `marginFor('inLump')` reads a key the client can never send.

**This is Architecture rule 9 exactly**: an allowlist that gives no feedback
when it excludes something. A margin box added to the screen with the id
`deal-margin-inLump` would render, accept typing, and **be silently discarded
at save** until `inLump` is added to `MARGIN_KEYS`. The round has to change
both or neither.

The server does not constrain the key set: `opportunities.js:626` validates
every entry as a non-negative percent and allows any name. Its comment says
"all 11 line keys", which becomes a stale claim the moment a twelfth exists.

### The consequence today

**A lump-sum installation is always priced at the target margin, and there is
no control anywhere that can price it otherwise.** The per-unit path has four
margin boxes in the Installation section (`deal-margin-inSsEx` and the other
three); the lump-sum path has none. That asymmetry is what D3 closes.

---

## PHASE 0, D2: THE FIT, MEASURED

Live, both widths, with the line-count instrument calibrated in both
directions on the element itself.

| | 1440 | 1240 |
|---|---|---|
| columns in `.terms-cards` | 2 | 1 |
| Tax Adjustments card | **932px**, `grid-column 1 / -1` | 460px, spanning a single column |
| usable inside the card | 902px | **430px** |
| the three items | 155 + 201 + 75 | 155 + 201 + 75 |
| sum including two 12px gaps | **455px** | **455px** |
| lines used | 1 | **2** |
| headroom | +447px | **-25px** |

**So the row fits at 1440 only because the card spans**, and the moment it
becomes a standard card it is 25px short. That is the number D2's stop
condition is about.

`Withholding Tax %` is 155px against a 90px box, so the label is what sets
that item's width. Shortening it to `WHT %` should return the item to its box
width.

### A CORRECTION TO MY OWN FIRST MEASURE

The first Phase 0 pass reported the row wrapping to **2 lines at 1440 inside a
902px box**, which cannot be true of a 455px row. `.terms-wht-pair` is
`align-items: flex-end`, so three items of different heights have three
different tops while sitting on one line, and Verification 4's recorded remedy
- assert equal `top` - is the wrong axis here.

The measure is now the container's own content height against its tallest
item, which is alignment-independent, and it is calibrated by forcing the card
narrow and watching it read 3.

---

## PHASE 0, D1: THE CARD TODAY

Measured live, identical at both widths:

```
table display        table
first row cells      TD 67px | TD 116px | TD 282px | TD 127px | TD 19px
alignment            every cell text-align: start
stance note input    placeholder "(none)", labelled: false
buttons              Record / Record / Add
```

### Estate-wide Record/Recorded census, comments stripped

Thirteen user-visible occurrences, scan calibrated against a known-present
string. Classified by whether they are the same vocabulary D1 is closing:

| site | text | same vocabulary? |
|---|---|---|
| `KeyContacts.tsx:228` | `Record` button | **YES, this round** |
| `KeyContacts.tsx:151` | `Recorded.` feedback | **YES, this round** |
| `app.js:4464` | `Record` button, Opportunity assessments | **YES, a save action** |
| `app.js:4326/4362/4364` | `Recording N...` / `Recorded N of M.` | **YES, save feedback** |
| `StagePanel.tsx:483` | `Record scores` | save action, but the noun is part of the phrase |
| `app.js:1804` | `Record the rejection` | a confirm label, reads as a sentence |
| `TestBedPanel.tsx:192`, `index.html:971` | `Recorded on the stage tabs.` | a signpost, not feedback |
| `scoring.ts:175` | `Recorded X, Y.` | prose summarising what happened |
| `app.js:5371`, `index.html:539` | placeholder `Record an interaction or update` | **different sense**: an invitation to type |

**Reported rather than changed, because changing six more surfaces is a scope
change and D1 asks for the report.** The four marked "YES" beyond this round's
card are the Opportunity assessment panel, which is vanilla `app.js` and has
its own save flow.

---

## Method for this round

- Every layout claim is a RELATIONSHIP measured on the live DOM, at 1440 and
  1240, before and after.
- Every new guard red-first, calibrated both directions, silences explained.
- `marginOverrides` changes get a DB read-back, because a payload allowlist is
  exactly the shape that accepts a write and stores nothing.
- Commits at every phase boundary. Nothing pushed.
