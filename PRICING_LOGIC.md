# HOW TERMINUS PRICES A DEAL

Written for a commercial reader. No code is quoted, and every rule names the
function and file that implements it so any statement here can be checked
against the thing that runs.

**Everything below was read in the source this session, and the four worked
examples in `GOLDEN_DEALS.md` were EXECUTED by the engine rather than worked out
by hand.** Where the code does something surprising, it is in
**[SURPRISES](#surprises)** rather than smoothed over.

---

## THE SHAPE OF IT

A deal is priced in six steps, in this order. Nothing later feeds anything
earlier.

```
1  count the units, and cost them from the rate card
2  decide what each line prices AT: a margin, or an absolute price
3  turn cost into price, line by line, in three groups
4  add the groups up into the contract value
5  apply withholding tax and GST
6  lay the money out month by month, and read the cash trough
```

`calculateDeal` in `src/lib/deal-calculator.js` is the whole of it. Everything
else is a caller.

---

## STEP 0. WHERE A RATE COMES FROM

**Rule 1. Every rate resolves one of three ways, never two: quoted for this job,
taken from the catalog, or ABSENT.**
`resolveRates`, `src/lib/rate-resolution.js`

"Absent" is a real answer and not a zero. The screen says so rather than pricing
something at nothing without mentioning it.

**Rule 2. Only the four INSTALLATION rates may be quoted per deal. The six
hardware and hosting rates are catalog facts and cannot be overridden.**
`OVERRIDABLE_RATE_KEYS` and `CATALOG_ONLY_RATE_KEYS`, `src/lib/rate-resolution.js`

The test, and it is worth knowing because it decides the next new rate too: *is
this cost the same wherever the deal happens, or quoted for this job?* A
SafeSight camera costs what it costs everywhere. A city-centre installation with
traffic management is not a business park.

**This is enforced, not merely documented.** A deal payload that somehow carried
a hardware cost could not price with it: the resolver never reads those keys
from a payload at all.

**Rule 3. The calculator never reaches for the catalog.** Rates arrive already
resolved and it is handed numbers.
`buildDealInputs` refuses to run without them, `src/lib/deal-inputs.js`

---

## STEP 1. UNITS, COST, AND THE WARRANTY

**Rule 4. Hardware cost is units times unit cost, per product, added up.**
`calculateHardwareAndWarranty`, `src/lib/deal-calculator.js`

**Rule 5. The warranty COUNT is a percentage of the SafeSight units only,
rounded UP to a whole unit.**
same function

Not of the mix. A warranty provision is a spare SafeSight, so an AQ Sensor or a
HEMIR on the same deal does not create one. 24 SafeSight at 5% is 1.2, which
rounds up to **2 units**.

**Rule 6. A warranty unit is valued at one SafeSight unit cost PLUS the
existing-infrastructure installation rate**, because a spare goes where a unit
already stands.
same function

**Rule 7. The warranty carries NO MARGIN. It reaches the customer at exactly
what it cost.**
`calculateDeal`, where the warranty line is built with a hardcoded zero margin

This is enforced where the pricing happens, not remembered at each writer: the
warranty is deliberately absent from the list of lines that may carry a price
override, so nothing can price it at anything other than cost.
`PRICE_OVERRIDE_KEYS`, `src/lib/deal-calculator.js`

---

## STEP 2. WHAT EACH LINE PRICES AT

**Rule 8. Every line prices from the deal's target margin unless that line has
its own.**
`buildDealInputs`, `src/lib/deal-inputs.js`

**Rule 9. A line may instead carry an ABSOLUTE PRICE. The margin is then not
used, and the margin you see reported is the one that price IMPLIES against the
cost.**
`buildCostGroup`, `src/lib/deal-calculator.js`

**Rule 10. Eight named lines may carry an absolute price. The warranty may
not.**
`PRICE_OVERRIDE_KEYS`, `src/lib/deal-calculator.js`

**Rule 11. Changing a fundamental input returns every ABSOLUTE override to the
derivation. A MARGIN survives, because a margin is a ratio and still means what
it meant.**
`FUNDAMENTAL_VALUE_IDS`, `frontend-react/src/deal/payload.ts`

Change the unit count and a price somebody typed for the hardware line is no
longer a price for that hardware. Change the unit count and a 45% margin is
still 45%.

---

## STEP 3. TURNING COST INTO PRICE

**Rule 12. Price is cost DIVIDED by one minus the margin, rounded to whole
dollars. It is not a markup.**
`priceFromCost`, `src/lib/deal-calculator.js`

```
30% margin on $100 of cost   ->   100 / (1 - 0.30)  =  $142.86
                       NOT   ->   100 x 1.30        =  $130.00
```

The difference is the point of the rule: at $130 the margin is 23%, not 30%.
The margin is clamped to the range 0 to 99, so nothing divides by zero.

**Rule 13. Three groups: hardware (including the warranty), installation, and
hosting. Hosting is PER MONTH; the other two are one-off.**
`calculateDeal`, `src/lib/deal-calculator.js`

**Rule 14. Installation is priced from the responsibility, and the four
arrangements are genuinely different lines**: four per-unit lines, one lump sum
line, or one zero line where the client installs.
`buildDealInputs`, `src/lib/deal-inputs.js`

---

## STEP 4. THE CONTRACT VALUE

**Rule 15. Contract net = hardware price + installation price + hosting price
times the number of months.**
`calculateContractTotals`, `src/lib/deal-calculator.js`

**Rule 16. Total deal COST is the same shape**: hardware cost + installation
cost + hosting cost times the months.
same function

---

## STEP 5. TAX

**Rule 17. Withholding tax is deducted by the CUSTOMER. Whether Terminus bears
it depends on one switch.**
`calculateTax`, `src/lib/deal-calculator.js`

**Rule 18. GROSSED UP: the invoice base is raised until the customer's deduction
leaves contract net intact, and Terminus bears nothing.**
```
invoice base = contract net / (1 - WHT%)
```

**Rule 19. NOT grossed up: the invoice base IS contract net, and the whole
withholding amount is a cost to Terminus.**

Both in `calculateTax`. The figure that carries it into the bottom line is the
BORNE amount, which is zero under a gross-up.

**Rule 20. GST is computed on the invoice base and is not a cost to Terminus.**
same function

---

## STEP 6. THE BOTTOM LINE

**Rule 21. Total deal cost adds three things on top of the priced groups:
finance cost, the WHT Terminus bears, and any carried Test Bed cost.**
`calculateDeal`, `src/lib/deal-calculator.js`

**Rule 22. Test Bed cost is a sunk cost added to COST ONLY. It never touches
contract net.** It reduces the achieved margin and changes no price.
same function

**Rule 23. Achieved margin is measured against CONTRACT NET.**
same function

---

## STEP 7. CASH, MONTH BY MONTH

**Rule 24. The structure decides how the one-off price is collected, and there
are three.**
`buildCashFlowModel`, `src/lib/deal-calculator.js`

| structure | how the one-off price arrives |
|---|---|
| **single** | recovered evenly over the WHOLE term |
| **two-phase** | recovered evenly over the RECOVERY PERIOD, then hosting runs on |
| **hybrid** | no recovery period at all. It arrives by customer MILESTONE |

**OPEX is single phase.** Every OPEX deal is saved with the single structure, so
this is the live meaning of OPEX and not only a reading kept for old records.
`effectiveStructure`, `frontend-react/src/deal/payload.ts`

**Rule 25. A two-phase deal with no recovery period recorded has NO recovery
period. It does not quietly recover over zero months.**
`buildCashFlowModel`, and `recoveryMonths` in `src/lib/deal-inputs.js`

**Rule 26. Annual invoicing bills each 12-month block in the FIRST month of that
block. Monthly invoicing bills each month as it accrues.**
`billed`, inside `buildCashFlowModel`

**Rule 27. A milestone is a MONTH and a PERCENTAGE. Its dollar figure is
DERIVED, every time, by one function, and no dollar figure is stored on a
milestone anywhere.**
`milestoneUsd`, `src/lib/milestone-schedule.js`

**There are two milestone schedules and they are percentages of different
things**, which is the part worth holding on to:

| schedule | who pays | a percentage OF |
|---|---|---|
| customer milestones | the customer pays Terminus | the one-off PRICE |
| contractor milestones | Terminus pays the contractor | the lump sum COST |

**Rule 28. A contractor payment schedule DEFERS cost out of month 1. With no
schedule, the whole contractor cost leaves in month 1.**
`buildCashFlowModel`, `src/lib/deal-calculator.js`

The month 1 default is a decision and not a leftover: nobody has staged the
payments, so there is nothing to defer, and the earliest possible outflow is the
honest assumption for a cash position somebody is going to fund against.

**Rule 29. A payment with an amount and no month counts toward the schedule's
total and moves no cash.** It also stops a version being issued, and does not
stop a save.
`scheduleReconciliation`, `src/lib/milestone-schedule.js`

**Rule 30. A version cannot be issued carrying a contractor schedule that does
not add up to the lump sum it is a schedule of**, within what whole-cent
rounding can legitimately reach.
`scheduleReconciliation` and the refusal in `src/routes/deal-sheet-versions.js`

**Rule 31. PO factoring advances the hardware and installation COST in month 1
and repays it on a schedule**, straight-line or declining-balance.
`buildLoanSchedule` and `buildCashFlowModel`, `src/lib/deal-calculator.js`

**Rule 32. A factoring facility with no term recorded prices NOTHING.** No
schedule, no advance, and the finance cost is reported as not recorded rather
than as zero, so the total cost is marked incomplete instead of quietly
understating itself.
`buildCashFlowModel` and `calculateDeal`

---

## OPEX: THE SAME ENGINE, DRIVEN BACKWARDS

**Rule 33. Under OPEX the customer is quoted one ALL-IN monthly fee per unit,
covering hardware, the warranty share, installation and hosting, amortised over
the term.**
`opexRows`, `src/lib/opex.js`

**Rule 34. That fee PRICES the deal. The engine works backwards from it by an
INVERSE ALLOCATION: every line of that product type is scaled so the type's
contract total lands exactly on the fee.**
`buildDealInputs`, `src/lib/deal-inputs.js`

The mix the deal was built with is preserved and only the level moves, because
the target is spread across the lines in proportion to what they would have
charged.

**Rule 35. A type may be given a target MARGIN instead of a fee, and the
absolute fee wins if both are stored.**
same function

**Rule 36. The warranty is a FIXED part of that target and is not scaled**,
because it goes at cost by rule 7. Everything else absorbs the difference.
same function

**Rule 37. The margin shown on the OPEX table is BLENDED and is not any
component's own margin.** It sits below the hardware line's margin, because the
warranty inside it earns nothing.
`opexRows`, `src/lib/opex.js`

**Rule 38. Under lump-sum installation the lump is allocated across the product
types by the catalog's own per-unit installation rates, falling back to unit
count when there are no rates to weigh by.**
`opexRows`, `src/lib/opex.js`

**This is a POSITION, not a settled rule.** The code says so at the site, in
terms, and it is John's to overturn.

---

## SURPRISES

Things the engine does that a reasonable person would not predict. Every one was
measured this session.

**S1. The all-in fee you type is not exactly the fee that comes back.** G1 was
given $650.00 per SafeSight unit per month and the table reports **$649.99**.
Every line price rounds to whole dollars, and the fee is recovered by dividing
those rounded prices back out, so the last cent has nowhere to live.
`buildCostGroup` rounds; `opexRows` divides back.

**S2. Under OPEX, the deal's target margin stops applying to most of the deal.**
G1 has a 32% target margin and **eight of its eleven lines do not price from
it**: the all-in fee's allocation writes an absolute price onto every scalable
line. The 32% still prices the lines of any type that has no fee and no target
margin of its own. This is rule 34 working correctly, and it means "the deal's
margin" is not a statement about most of its lines.

**S3. The cash flow is not rounded and the prices are.** Line prices are whole
dollars; a month's hardware recovery is a price divided by a month count and
carries cents, so G2's month 1 shows **$789,809.33** of hardware revenue. Both
are right and they do not look like the same kind of number.

**S4. A rate nobody has recorded prices at zero, and the warning is on the
screen rather than in the arithmetic.** The resolver reports the absence and the
calculator treats the line as a zero-cost line, because a deal with one unpriced
product still has to price the rest. **If the warning is not read, the deal is
cheap for a reason nothing in the figures states.**
`buildDealInputs`, and the absent list from `resolveRates`

**S5. Three recorded fields affect no figure at all**: the currency contingency
percentage, and the bid and proposal currencies. The approval page says so in
those words, which is the honest arrangement, but they are on the pricing screen
and they look like inputs.
`approval-page.js` names `fxContingency` as "recorded and does NOT affect any
figure on this page"

**S6. Achieved margin never asks whether any of the revenue is collected.** It
is contract net minus total cost over contract net. A deal whose recovery period
means a large part of the hardware price is never invoiced still reports the
margin it was priced at. The cash flow is the only place that shows it, and
`minCash` is the figure to read.

**S7. Gross-up raises what the customer is invoiced.** It is described as
protecting the contract value, which it does, and the mechanism is a larger
invoice. On G4, contract net of $1,646,964 becomes an invoice base of
**$1,871,550** at 12% withholding.

**S8. A two-phase deal and a hybrid deal of the same size collect completely
differently, and neither is wrong.** Two-phase spreads the one-off price evenly
over the recovery period; hybrid pays it in lumps on the customer's milestone
months and has no recovery period at all. Comparing their cash troughs is
comparing two different commercial arrangements.

**S9. A contractor schedule stages cost and changes no price.** It moves cash
out of month 1 and nothing else: contract net, every line price, total cost and
achieved margin are identical with and without it. This is now asserted rather
than remembered, on G2 and in `contractor-staging.test.mjs`.

---

## WHAT THIS DOCUMENT DOES NOT COVER

- **Anything after pricing.** Approval routing, version issuing and stage gates
  read these figures and are not described here.
- **The catalog's own maintenance.** How a rate batch is published and which
  batch a deal reads is `base-costs`, not the calculator.
- **The screen.** Every rule above is about the engine. Where a surface shows a
  figure, it reads it from these same functions, and this document is not
  evidence about the rendering.
