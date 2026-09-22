# Walk 11: close-out

Branch `walk11`, off `main` at `5632035`, confirmed equal to `origin/main` by
`git ls-remote`. Deal sheet reorganization excluded pending design, as
instructed.

---

## RECONCILED BY COUNTING

The brief carries no phase headings, because the round is three findings and a
Phase 0. Counted against commits rather than read:

| | Commit |
|---|---|
| Brief and Phase 0: the mechanism, the fit, the card today | `1721bd2` |
| D2 | `0f5ec7e` |
| D1 | `7a3446f` |
| D3 | `524fa12` |
| Close-out and `CURRENT_STATE.md` | this commit |

**Rulings in force: 1**, the walk 11 instruction itself, quoted verbatim in
`WALK11_BRIEF.md`. No ruling was given in conversation during the round, so
nothing had to be appended at a phase.

---

## D1: the contacts card coheres

| clause | built | evidence |
|---|---|---|
| a proper grid presentation | yes | `doc-table kc-table`; **20 of 20** header and cell properties identical to a `doc-table` injected into the live document |
| the note says what it is | yes | placeholder `Stance note`, plus an accessible name carrying the contact's name |
| Record becomes Save | yes | live at both widths |
| feedback unifies on Saved | yes | `Saved.` / `Could not save that.`, and the word Record appears nowhere on the card |

**The treatment had drifted five properties**, none of them decided: 9px
against 10.5px, 0.06em against 0.1em, `--muted` against `--muted-2`, a plain
hairline under the head where every other grid uses the strong one, and 13px
cells against 14px.

The comparison is made against a **live `doc-table`**, not against numbers
typed into the probe, so it cannot go stale when somebody retunes the estate's
grid.

The table grew 611px to 772px and still sits **74px inside its panel at
1240**. `kc-table` keeps only the `width: auto` that K1's stopped measurement
rests on.

**18/18 live**, both widths. Three component tests written RED FIRST.

---

## D2: the tax line fits a standard card

| | before | after |
|---|---|---|
| WHT item | **155px** | **78px** |
| row total including two 12px gaps | 455px | **378px** |
| usable inside a standard card | 430px | 430px |
| headroom | **-25px** | **+52px** |
| lines used at 1240 | **2** | **1** |
| card at 1440 | 932px, spanning | **460px, standard** |

**The label was setting the width**: `Withholding Tax %` measured 155px
against its own 90px box. `WHT %` returns the item to the box.

`pg-card--wide` is removed rather than left unused. Its only calibration,
`scripts/walk8/calibrate-item1.mjs`, injected on the rule this ruling deletes
and is retired with it; `scripts/walk8/probe-tax-line.mjs` is re-pointed and
reads **11/11**, now reporting one line at 1240 where the span could not help.

**12/12 live.**

---

## D3: installation is a line with a margin

### The mechanism, established at both ends before anything was built

```
TT-SGP-MANUFI-004   lumpSumCost 200000, targetMargin 30, inLump (none)
                    round(200000 / (1 - 30/100)) = 285714
```

and `$285,714` read off the live screen. All four live lump-sum deals carry no
override.

**What writes it: nothing, and the reason is an allowlist.** `MARGIN_KEYS`
held eleven keys and `inLump` was not among them, while `marginFor('inLump')`
has read `marginOverrides.inLump` since the lump-sum line existed. A margin box
added to the screen would have rendered, accepted typing and been **discarded
at save**, with nothing failing. Architecture 9.

### Built

The Installation row reads `installGroup`'s own totals, the same object the
summary matrix, the one-off price row and the cash flow read. Nothing is
recomputed, which is R-N1's requirement, and the screenshot shows
`INSTALLATION $400,000` reaching the Deal Sheet matrix.

**The margin cell is a box on one path and a readout on the other, and that
is the point.** Lump sum is one line nothing else controls, so a box here is
the only control it has ever had. Per-unit is four lines each with its own box
in the Installation section, and a single box driving four keys would disagree
with them on the first edit: two writers of one value.

### Proven by DB read-back

```
typed 50 with real keyboard events
save enabled -> clicked -> revision 2 -> 3
marginOverrides.inLump stored: 50
price 400000, surviving a reload, box "50"
```

**17/17 live**, both widths, and the expectation is derived from the record at
the moment of the read rather than from the loop.

---

## WHAT THE ROUND FOUND IN ITS OWN WORK

Four, and three were found by an instrument rather than by reading.

1. **The first wrap measure was wrong.** `.terms-wht-pair` is
   `align-items: flex-end`, so three items of different heights have three
   different tops while sitting on one line. Verification 4's recorded remedy
   - assert equal `top` - is the wrong axis here, and it reported 2 lines for
   a 455px row inside a 902px box. The measure is now the container's content
   height against its tallest item, calibrated by forcing the card narrow.
2. **`PRICING_CARD_MARGIN_IDS` was a typed list of seven.** Adding `inLump` to
   `MARGIN_KEYS` created a census field in NEITHER exclusion set, so the
   generic renderer produced a **second `deal-margin-inLump`** - which the
   file's own comment predicts: "one id with two elements, and readPayload
   reads whichever the DOM returns first". A D3 test caught it; the duplicate
   id suite could not, because it reads `frontend/index.html`. The list is
   derived now.
3. **A calibration injection came back SILENT**, and the silence was a defect
   in code written that hour: the Installation row declared its own `const ig`
   beside the card's, eight lines apart, so an injection aimed at one left the
   other reading correctly. Two readers of one value. Collapsed, and the
   injection then fired.
4. **I corrupted `CURRENT_STATE.md` by redirecting into it.** The generator
   writes the file itself and prints its status to stdout, so
   `state-dump.mjs > CURRENT_STATE.md` replaced the header with "Wrote
   /Users/...". Caught by reading the diff, restored from `HEAD`, regenerated.

---

## REPORTED, NOT BUILT

Each is a scope change, and the brief says stop on those.

1. **Three labels for `whtPct`, and they disagree.** `census.ts` now says
   `WHT %`; `approval-format.ts` says `Withholding tax %`; and
   `src/lib/version-pricing.js:180` says `Withholding Tax %`. The split
   pre-existed this round in kind, and D2 named one label. Verification 20.
2. **The estate-wide Record/Recorded census**, thirteen user-visible
   occurrences, comments stripped and the scan calibrated. Two were this
   round's. **Four more are the same vocabulary**, all in the Opportunity
   assessment panel in vanilla `app.js`: the `Record` button at `4464` and the
   `Recording N...` / `Recorded N of M.` feedback at `4326`, `4362`, `4364`.
   The rest are different senses and should not move: `Record scores`,
   `Record the rejection`, `Recorded on the stage tabs.` as a signpost,
   `Recorded X, Y.` as prose, and the note placeholder `Record an interaction
   or update`, where Record is an invitation to type.
3. **"Next to Currency" is satisfied ordinally, not side by side.** Measured:
   `.terms-cards` is `repeat(auto-fit, minmax(340px, 460px))`, which gives
   **two columns at 1440 and one at 1240**, so three cards put the third on
   row 2. Tax Adjustments immediately follows Currency in the flow and sits at
   `(302, 1448)` under Margin and Warranty at 1440, directly under Currency at
   1240. Literal adjacency needs one of the other two cards moved, or the
   deliberate 460px cap raised - and that cap is D2's own requirement.
4. **`pg-total-price-hw` now totals hardware AND installation.** The card's
   rows must sum to its total, so the total moved; the id still says `hw`.
   Verification 19's shape. Its one caller,
   `scripts/probe-payment-layout.mjs`, asserts its fixture has no installation
   spend, so its reading is unchanged.

---

## Exit gate

| Point | Answered |
|---|---|
| Every finding built or reported | **Yes.** D1, D2, D3 built; four items reported |
| D3's Phase 0 measured before building | **Yes**, at both ends: computed and read off the screen |
| D2's measurement met, or stopped | **Met.** 378px into 430px, one line, standard card, both widths |
| Red-first guards | **Yes.** D1 three tests red first, D2's probe 2 of 8 red first, D3 five tests red first |
| Calibrated both directions | **Yes. 8/8**, every injection on its NAMED check, plus a live injection for D1's treatment detector |
| Silences explained | **Yes**, and the one silence was a real defect |
| Live proof at 1440 and 1240 | **Yes.** D1 18/18, D2 12/12, D3 17/17 |
| Screenshots opened and read | **Yes**, three of them |
| DB read-back on the stored margin | **Yes.** `marginOverrides.inLump = 50`, revision 2 to 3 |
| Fixtures torn down, re-queried | **Yes.** 132 live, none created in the last 6 hours, zero walk11 residue, 60 counters intact |
| `CURRENT_STATE.md` regenerated | **Yes**, and its diff is counts plus the React bundle and suite |
| Merged or pushed | **No push from the session** |
