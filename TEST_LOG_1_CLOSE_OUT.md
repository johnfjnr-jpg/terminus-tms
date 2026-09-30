# TEST_LOG_1: CLOSE-OUT

Branch `test-log-1` off `main` at `d09a979`. Three rulings, one walk item, and a
tolerance position that reversed mid-round.

---

## THE EXIT GATE, POINT BY POINT

**E1. G2, G3 and G4 exact and UNMOVED. G1 moved by the residue only.**

G1's SafeSight row, the one carrying a stored fee:

| figure | old | new |
|---|---|---|
| `opex[0].contractTotal` | 748,788 | **748,800** = 650 x 24 x 48 |
| `opex[0].monthlyFee` | 649.9895833 | **650** |

**83 figures moved in total and every one traces to a single 12-dollar
residue**, spreading through the cash flow as 3, 6, 9 and 12 across the annual
billing blocks. Largest movement **12.00**. **Nothing beyond the residue.**

AQ Sensor and HEMIR **did not move**: they carry no stored fee.

**G5 added**, PROVISIONAL alongside G1 for the Excel check:

```
contract net       1,694,469        SafeSight  21 units  fee  700.00  total   882,000
total deal cost    1,191,500        AQ Sensor   9 units  fee  288.67  total   155,880
achieved margin      29.6830%       HEMIR       3 units  fee 3647.72  total   656,589

SafeSight check    21 x 700 x 60 = 882,000
```

**E2. The tie proved from the click, in BOTH modes, red on the old code first.**

11 of 11 in a browser on a real Lump Sum OPEX deal saved through the route:
**$630,000** and **$1,008,000** exactly, per-unit and lump sum alike, with the
fee cell still reading what was typed.

**On the old code, rebuilt bundle and all, the same probe read $1,050,056
against $630,000.** Scored on WHICH assertion failed, not on the exit code.

**E3. R-TL2 proved both ways, client and server.**

Client 6 of 6 from the click; server 7 of 7 over HTTP, with the non-owner
refused **403 for OWNERSHIP** rather than by the new rule.

**E4. `TT-SGP-MANUFI-004` NOT written by this round.** Below.

**E5. W-TL2 14 of 14**, screenshots opened and read. W-TL3 in Phase 0.

**E6.** Gate, merge, merged gate, `ls-remote` re-check.

---

## E4: WHAT JOHN WILL SEE WHEN HE OPENS HIS RECORD

**No write of any kind.** LIVE at Solution Alignment, revision 39, last saved
2026-09-28, still storing `paymentMode: capex`, `opexUnitFees {ss:500}` and
`opexUnitMargins {ss:0}`.

**It opens exactly as he left it**, in CAPEX, where those two keys price
nothing.

**Switched back to OPEX**, the SafeSight row now reads:

```
fee 500  ->    630,000      was 1,053,798
fee 800  ->  1,008,000      was 1,431,798
```

Both exactly `21 x fee x 60`. The $423,798 constant is gone.

**AND HIS NEXT SAVE WILL DROP THE INERT MARGIN.** R-TL2's server rule removes
`opexUnitMargins.ss` where a fee sits beside it. The round does not write the
record; the next save cleans it, and the probe asserts that dropping it moves
no figure.

---

## WHAT THE ROUND FOUND THAT THE RULINGS DID NOT NAME

**W-TL2's two halves paid for each other.** Phase 0 measured that doubling the
stance note ALONE does not fit at 1240 - 150px needed against 137px of unused
panel - and I carried that forward as a thing to measure rather than predict.
Measured after: it fits with 50px spare, because dropping the time from Linked
shrank that column 152px to 94px. **The table grew by 91px, not 150.**
Verification 28 doing real work: each change right alone, each misleading about
the pair.

**A generated file had never been declared generated.** `GOLDEN_DEALS.md` is
written by `compute.mjs`, was CREATED last round - and a creation is exempt from
the routing guard because it has no anchor to miss - so this round MODIFIED it
for the first time and **the guard refused the commit**. The gap surfaced at the
exact moment it first mattered. Declared now.

---

## WHAT I GOT WRONG, AND WHAT CAUGHT IT

1. **The residue applied to margin-driven rows**, moving G1's AQ Sensor by -11.
   AQ carries a margin, and John's words are that such rows keep price-first
   derivation. Outside the ruling. Caught by reading the moved-figure list.
2. **My own test restated the share weighting** instead of calling
   `installShares`, and went red when shares became whole-dollar - correctly.
   A test that restates the rule is the second reader R-TL1 exists to delete,
   arriving inside the test for R-TL1.
3. **My R-TL2 tests asserted the opposite of the ruling.** They expected the
   cleared cell to render EMPTY; it renders the DERIVED value, which is what
   "shows its derived value at normal weight" means. The observable for
   "cleared" is the override flag, not an empty box.
4. **A Phase 0 reader-2 figure derived by difference**, which conflated "what it
   saw" with "the discrepancy" and was wrong for per-unit. Re-measured directly.
5. **A probe selector guessed rather than read** (`.stat-cell`), returning null
   for every headline field - which reads exactly like a missing figure.
6. **A commit that wrote nothing.** The tooling refused a command mid-flight, so
   the heredoc never ran and the Phase 0 file did not exist. Caught by checking
   for the file rather than reading the absence of an error as success.
7. **The undeclared generated file**, above.

---

## THE QUEUE

**"RESET TO TARGET MARGIN" ON THE OPEX TABLE. Queued by John 2026-09-30, NOT
built in this round.**

> Clears every row's stored fee AND margin overrides; rows re-derive from cost
> plus the deal's target margin.

**THE MOCKUP GATE APPLIES.** It is a Commercials surface, so a static mockup
goes to John for approval **before any build**. Nothing about it was designed,
sketched or implemented here.

**R-TL1a is unchanged by it**: total = `units x fee x term` exactly when a fee is
stored, and margin-driven rows keep price-first derivation.

**Also queued, from this round's own measurements:**

- **`check-reachable` mangles an IPv6 resolver when it prints one.** It splits on
  `:` and keeps the last field, so `fe80::a289:66ff:fe8a:e518%en1` prints as
  `e518%en1` - destroying the identity in the very line that serves as the VPN
  evidence. It did not matter here because `scutil` was read directly.
- **The composer guard excludes test files** (from the previous round, still
  true): a label composed inside a test is not caught.

---

## WHAT THIS ROUND DOES NOT ESTABLISH

- **G1 and G5 are PROVISIONAL.** The figures are what the engine does, not yet
  what John has confirmed it should do. G2 to G4 remain CONFIRMED and unmoved.
- **The `installShares` fallback to unit count is untested here.** It fires only
  when a catalog carries no per-unit install rates at all, and no fixture in this
  round reaches it.
- **W-TL3 is a report, not a finding.** A follow-up concept exists as two payload
  keys; nothing was proposed and nothing built.
- **The residue line is a decision, not a derivation.** Hardware was chosen for
  three stated reasons, and a different choice would be equally exact and would
  put the odd dollars somewhere else.
