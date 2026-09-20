# Walk 4: verifying the scouting Phase 0

Model: **Claude Opus 5 (1M context)**.
Branch `opp-walk4` at `03c2a82`. **Nothing built, nothing pushed.**

Five claims from a Phase 0 run in a separate container against `37a2196`,
re-measured here independently. I did not read that report; I measured the
claims as stated.

---

## 0. The verdict, first

**All five claims hold.** Two are sharper than stated. **And the verification
found two errors in MY OWN Phase 0 report**, which is the part worth reading
first, because my report is the one already in your hands.

| claim | verdict |
|---|---|
| O3: zero order guards | **CONFIRMED, and sharper** |
| O5/O6: nested two tables, and a 44px prototype spec | **CONFIRMED, both** |
| O4: `hybridSchedule` null call site, prototype panels | **CONFIRMED, and it is worse than I reported** |
| O7: no per-unit grain, the `rawTotalPrice` consumer map | **CONFIRMED, with a refinement** |
| O8: collides with warranty-as-spare-units | **CONFIRMED, and my report got this wrong** |

---

## 1. Where MY OWN report was wrong

Stated first because you are holding it.

### 1a. I said warranty is not a separate line. It already is.

My report: *"warranty is inside the hardware group ('Unit cost and warranty' is
one card), so making it a separate line is a change to the GROUP STRUCTURE."*

**That is wrong.** `deal-calculator.js:430-433`:

```js
const hardwareGroup = buildCostGroup([
  { key: 'hwSs',       cost: ssUnitCost * ssUnits,   marginPct: 0 },
  { key: 'hwAqm',      cost: aqUnitCost * aqUnits,   marginPct: 0 },
  { key: 'hwHemir',    cost: hemirUnitCost * hemirUnits, marginPct: 0 },
  { key: 'hwWarranty', cost: hardware.warrantyCost,  marginPct: 0 },
]);
```

`hwWarranty` is **already its own keyed row**, alongside the three products. The
CARD is titled "Unit cost and warranty", and I read a display grouping as the
calculation's structure. **O8's "warranty a separate deal sheet line item" is
much closer to already-true than I said.**

### 1b. I said the hybrid has two panels. The second one renders nothing.

My report: *"The two panels already exist inside `#deal-hybrid-group`, which is
the useful surprise."*

**`DealPanel.tsx:570` passes `hybridSchedule={null}`.**

So `#deal-hybrid-schedule` is empty. `YearScheduleView`'s hybrid branch, with
its year rows, Total and hosting note, is **never rendered on the Opportunity**.

**The evidence was in my own output and I read past it.** My measurement
recorded panel two's text as exactly `"InvoicingAnnual in advanceMonthly"`: the
invoicing radios and nothing else. No year rows, no total, no note. I saw a
second panel and called it close to the prototype; what is there is a pair of
radio buttons.

**So O4 is larger than my report said.** The second panel is not stacked, it is
absent.

---

## 2. O3: zero order guards. CONFIRMED, and sharper

There is no guard on the live section order, and the reason is worse than
"nobody wrote one".

**Three assertions LOOK like order guards:**

```
latches.test.mjs:52            slices between deal-section-4 and deal-section-5
latches.test.mjs:54            slices between the stats grid and deal-sections-1-2
commercials-wiring.test.mjs:548  deal-cashflow-grid comes after deal-section-6
```

**Every one reads `frontend/index.html`, and every id they name is INSIDE the
retired `#deal-form-vanilla` block**, measured by byte offset:

```
  deal-section-4        INSIDE the retired #deal-form-vanilla
  deal-section-5        INSIDE the retired #deal-form-vanilla
  deal-section-6        INSIDE the retired #deal-form-vanilla
  deal-cashflow-grid    INSIDE the retired #deal-form-vanilla
  deal-sections-1-2     INSIDE the retired #deal-form-vanilla
```

That is `CLAUDE.md`'s own standing qualification arriving in practice: the green
of those suites is not evidence about the live deal form.

**The consequence for O3 is concrete.** The reorder happens in `DealPanel.tsx`.
Those assertions read markup the reorder does not touch, so **every suite would
stay green whichever order the live sections ended up in.** O3 needs a new
guard on the rendered order, or it ships with no detector.

---

## 3. O5 and O6: the mechanism and the 44px. BOTH CONFIRMED

**The nested two tables**, asserted on the live DOM by parentage, not read from
source:

> the field table is nested INSIDE the header table's tbody: **true**

**And the prototype's own answer, which I had not measured before:**

```
grid-template-columns: 44px 195px 44px 64px
```

Used **three times** in the milestone block: the header row, the data rows and
the total row. **One grid, three users.** That is precisely why the prototype
aligns and the current build does not.

| | Month | Project milestone | % | USD |
|---|---|---|---|---|
| prototype | **44px** | 195px | 44px | 64px |
| today | **88px** | 112px | 112px | 177px |

**So O5 and O6 are ONE fix, not two.** Adopting the prototype's grid sets the
Month field to 44px (O5) and puts the headers on the same track as the fields
(O6) in a single change. The 44px is not a number somebody chose today; it is
the prototype's own.

---

## 4. O4: the call site and the panels. CONFIRMED

`hybridSchedule={null}` at `DealPanel.tsx:570`, covered in section 1b.

**And the prototype's two panels are genuinely SIDE BY SIDE**, which my report
explicitly said it had not established:

```
display:grid
grid-template-columns: minmax(365px,1fr) minmax(0,280px)
gap: 20px
align-items: start
```

Milestones left, flexible from 365px; invoicing and hosting right, capped at
280px. **The current build renders both at `left=319 width=753`**, which is one
column of two blocks.

---

## 5. O7: no per-unit grain. CONFIRMED, with a refinement

There is no per-unit price. The only division by a unit count is
`avgHwCost = hardwareCost / totalUnits`, and the code says of it, in its own
comment: **"NOTHING PRICES ANYTHING FROM IT any more."**

**The refinement: the grain that DOES exist is per PRODUCT TYPE.**

```js
{ key: 'hwSs',    cost: ssUnitCost * ssUnits,  marginPct: hardwareMargins?.hwSs }
{ key: 'hwAqm',   cost: aqUnitCost * aqUnits,  marginPct: hardwareMargins?.hwAqm }
{ key: 'hwHemir', cost: hemirUnitCost * hemirUnits, marginPct: hardwareMargins?.hwHemir }
```

A unit cost is an input that is **immediately multiplied up**; the line is the
product type. And `marginOverrides` already operates at exactly that grain.

**That matters for O7 more than the absence does.** O7's rows are Safesight,
Safesight Value Priced, Air Quality, HEMIR: three of those ARE the existing
per-type grain. So O7 is closer to "a second override at an existing grain"
than to "a new per-unit grain", with **Safesight Value Priced as a genuinely
new line**. The `rawTotalPrice` consumer map in my report stands.

---

## 6. O8: the warranty collision. CONFIRMED, and it is a real one

```js
const warrantyBasisUnits = ssUnits;
const warrantyUnitCost   = ssUnitCost + ssInstallExistingCost;
const warrantyUnits      = Math.ceil(warrantyBasisUnits * warrantyPct / 100);
const warrantyCost       = Math.round(warrantyUnits * warrantyUnitCost);
```

**`warrantyPct` is a percentage of a UNIT COUNT.** It produces whole spare
SafeSight units, each valued at its own cost **plus the cost of installing it**.
Warranty is a quantity of spare hardware.

**O7/O8's spec says warranty is "entered as % of hardware COST per unit".**

Same field name, two different meanings:

| | `warrantyPct` today | O7/O8's "Warranty %" |
|---|---|---|
| percentage of | **unit count** (SafeSight only) | **hardware cost per unit** |
| produces | whole spare units, `ceil` | a cost uplift |
| valued at | unit cost **plus installation** | n/a |
| basis | SafeSight units only | per unit, all types |

**This is the Verification 23 shape**: two defensible definitions of one name,
and nothing in the codebase can see the disagreement because each is correct
where it sits. The estate's reading was corrected as recently as 2026-09-16
after an audit found a mix-average valuation under-provisioning warranty by a
measured $16,337 against $33,000 on one deal.

**So O8 cannot be built as specified without deciding which `warrantyPct`
means what.** Three readings, and the choice is yours, not mine:

1. O7/O8's "Warranty %" is a **different field** with a new name, and
   `warrantyPct` keeps meaning spare units.
2. `warrantyPct` **changes meaning** to a cost percentage, which invalidates
   the spare-units model and the 2026-09-16 correction with it.
3. The panel **displays** the existing spare-units warranty as an effective
   percentage of cost, deriving the column rather than accepting it.

---

## 7. What this verification does NOT establish

- I did not read the scouting report. I measured the five claims **as you
  stated them**, so an agreement here means the claim is true, not that the two
  reports say the same thing in the same words.
- The prototype grid figures are read from its markup. I have not rendered the
  prototype.
- O8's three readings are options, not a recommendation.

---

## 8. What changes

| | before this verification | after |
|---|---|---|
| **O3** | releases | **releases, and needs a NEW guard**: the existing order assertions are against dead markup |
| **O4** | "two panels, stacked" | **the second panel renders nothing**, `hybridSchedule={null}`. Prototype confirmed side by side |
| **O5/O6** | two fixes | **ONE fix**: adopt the prototype's `44px 195px 44px 64px` grid |
| **O7** | no per-unit grain | unchanged, refined: the grain is per product type and already carries overrides |
| **O8** | "a change to the group structure" | **wrong in my report.** Warranty is already its own line. The real obstacle is the `warrantyPct` collision |
