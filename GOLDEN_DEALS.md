# THE FOUR GOLDEN DEALS

**PROVISIONAL until John confirms these figures.** Until then the acceptance
harness says so in its own output.

Every figure below was EXECUTED by the live pricing engine, not paraphrased
from it. The run is `scripts/golden-deals/compute.mjs`, committed, and it writes
this file and the harness's expectations from one pricing run each, so the
document and the suite cannot disagree.

The pipeline, exactly as the application runs it:

```
resolveRates(payload, catalog)  ->  buildDealInputs  ->  calculateDeal
                                                     (+ opexRows on OPEX)
```

## The rate card all four price against

**Declared in the fixture, NOT read from the database**, so a golden deal
means the same thing next year. The live catalog is a batch with an effective
date and it moves; a suite pinned to it would go red the first time somebody
published a price change, and the red would say nothing about the engine.
**These are the numbers to put in Excel.**

| rate | value |
|---|---|
| SafeSight unit cost | 8,000 |
| AQ Sensor unit cost | 2,000 |
| HEMIR unit cost | 100,000 |
| Hosting per SafeSight unit per month | 200 |
| Hosting per AQ Sensor per month | 100 |
| Hosting per HEMIR per month | 500 |
| Install per SafeSight on existing infrastructure | 1,500 |
| Install per SafeSight on new infrastructure | 2,500 |
| Install per AQ Sensor | 400 |
| Install per HEMIR | 3,000 |

## The four, and what each one is for

| deal | shape | what it exercises |
|---|---|---|
| G1 | OPEX, single phase | the all-in monthly fee, the inverse allocation, the blended margin |
| G2 | CAPEX, two-phase | the recovery period, and contractor payment milestones |
| G3 | hybrid | PO factoring, withholding tax borne by Terminus, and one zero-unit line |
| G4 | CAPEX, two-phase | an absolute price override, a margin override, a rate override, gross-up |

---
# G1. OPEX single-phase: all-in monthly fee and blended margin

## The inputs, in full

| input | value |
|---|---|
| Payment mode | opex |
| Structure | single |
| SafeSight units on existing infrastructure | 18 |
| SafeSight units on new infrastructure | 6 |
| AQ Sensor units | 9 |
| HEMIR units | 2 |
| Contract duration, months | 48 |
| Recovery period, months | not recorded |
| Target margin | 32% |
| Warranty | 5% |
| Installation responsibility | Terminus Contractor - Per Unit |
| Lump sum cost | n/a |
| Invoicing | annual |
| Withholding tax | 0% |
| GST | 0% |
| Grossed up for WHT | no |
| OPEX all-in monthly fee per unit, ss | 650 |
| OPEX target margin, aq | 38% |

## The rates this deal priced against, and where each came from

| rate | value | source |
|---|---|---|
| SafeSight unit cost | 8,000 | catalog |
| AQ Sensor unit cost | 2,000 | catalog |
| HEMIR unit cost | 100,000 | catalog |
| Hosting per SafeSight unit per month | 200 | catalog |
| Hosting per AQ Sensor per month | 100 | catalog |
| Hosting per HEMIR per month | 500 | catalog |
| Install per SafeSight on existing infrastructure | 1,500 | catalog |
| Install per SafeSight on new infrastructure | 2,500 | catalog |
| Install per AQ Sensor | 400 | catalog |
| Install per HEMIR | 3,000 | catalog |

## Step 1. Hardware cost, and the warranty provision

```
hardware cost = 8,000 x 24  +  2,000 x 9  +  100,000 x 2
              = 410,000

warranty COUNT = ceiling( 24 SafeSight units x 5% ) = 2 unit(s)
   the basis is SAFESIGHT UNITS ONLY, and it rounds UP
warranty UNIT VALUE = 8,000 unit cost + 1,500 existing-infrastructure install = 9,500
warranty COST = 2 x 9,500 = 19,000
```

## Step 2. The margin each line prices at

| line | prices from | the figure, and where it came from |
|---|---|---|
| SafeSight hardware | an absolute PRICE | 301,722.26, from the OPEX all-in fee allocation. The margin is not used |
| AQ Sensor hardware | an absolute PRICE | 29,025.74, from the OPEX all-in fee allocation. The margin is not used |
| HEMIR hardware | a MARGIN | 32%, the deal's target margin |
| Warranty provision | nothing. It goes at COST | the warranty reaches the customer at cost, by rule |
| Install, SafeSight on existing infrastructure | an absolute PRICE | 42,429.81, from the OPEX all-in fee allocation. The margin is not used |
| Install, SafeSight on new infrastructure | an absolute PRICE | 23,572.24, from the OPEX all-in fee allocation. The margin is not used |
| Install, AQ Sensor | an absolute PRICE | 5,804.93, from the OPEX all-in fee allocation. The margin is not used |
| Install, HEMIR | a MARGIN | 32%, the deal's target margin |
| Hosting, SafeSight | an absolute PRICE | 7,543.24, from the OPEX all-in fee allocation. The margin is not used |
| Hosting, AQ Sensor | an absolute PRICE | 1,451.78, from the OPEX all-in fee allocation. The margin is not used |
| Hosting, HEMIR | a MARGIN | 32%, the deal's target margin |

## Step 3. The three priced groups

Price is `cost / (1 - margin)`, rounded to whole dollars. It is a DIVISION,
not a markup: a 30% margin on $100 of cost is $142.86, not $130.

**Hardware**

| line | cost | margin used | price | implied margin | priced from |
|---|---|---|---|---|---|
| SafeSight hardware | 192,000 | n/a | 301,722 | 36.365263388152% | an absolute price override |
| AQ Sensor hardware | 18,000 | n/a | 29,026 | 37.98663267415421% | an absolute price override |
| HEMIR hardware | 200,000 |  | 294,118 | 32.000081599902074% | cost / (1 - margin) |
| Warranty provision | 19,000 |  | 19,000 | 0% | cost / (1 - margin) |
| **total** | **429,000** | | **643,866** | | |

**Installation**

| line | cost | margin used | price | implied margin | priced from |
|---|---|---|---|---|---|
| Install, SafeSight on existing infrastructure | 27,000 | n/a | 42,430 | 36.36577893000236% | an absolute price override |
| Install, SafeSight on new infrastructure | 15,000 | n/a | 23,572 | 36.365179025963% | an absolute price override |
| Install, AQ Sensor | 3,600 | n/a | 5,805 | 37.98449612403101% | an absolute price override |
| Install, HEMIR | 6,000 |  | 8,824 | 32.00362647325476% | cost / (1 - margin) |
| **total** | **51,600** | | **80,631** | | |

**Hosting** (per month)

| line | cost | margin used | price | implied margin | priced from |
|---|---|---|---|---|---|
| Hosting, SafeSight | 4,800 | n/a | 7,543 | 36.36484157497017% | an absolute price override |
| Hosting, AQ Sensor | 900 | n/a | 1,452 | 38.01652892561983% | an absolute price override |
| Hosting, HEMIR | 1,000 |  | 1,471 | 32.01903467029232% | cost / (1 - margin) |
| **total** | **6,700** | | **10,466** | | |

## Step 4. Contract totals

```
one-off price      = hardware 643,866 + installation 80,631 = 724,497
hosting per month  = 10,466
hosting over term  = 10,466 x 48 = 502,368
CONTRACT NET       = 724,497 + 502,368 = 1,226,865

total deal cost    = 429,000 + 51,600 + 6,700 x 48 = 802,200
margin before finance = (1,226,865 - 802,200) / 1,226,865 = 34.61383281779169%
```

## Step 5. Withholding tax and GST

```
NOT grossed up, so the invoice base IS contract net = 1,226,865
  WHT deducted by the customer = 1,226,865 x 0% = 0
  GST                          = 1,226,865 x 0% = 0
  WHT BORNE BY TERMINUS        = 0   (the full amount, because there is no gross-up)
```

## Step 6. The bottom line

```
priced cost        802,200
finance cost     + 0
WHT borne        + 0
Test Bed cost    + 0   (none of these four came from a conversion)
TOTAL DEAL COST  = 802,200

ACHIEVED MARGIN  = (1,226,865 - 802,200) / 1,226,865 = 34.61383281779169%
```

## Step 7. The OPEX table: what the customer is quoted per unit per month

| type | units | all-in monthly fee per unit | blended margin | contract total |
|---|---|---|---|---|
| SafeSight | 24 | 649.99 | 35.44234149051534% | 748,788 |
| AQ Sensor | 9 | 241.96 | 38.00644809475063% | 104,527 |
| HEMIR | 2 | 3,891.15 | 32.00374782492303% | 373,550 |

The margin here is BLENDED across hardware, warranty, installation and
hosting, so it sits below the margin the hardware line itself prices at:
the warranty inside it reaches the customer at cost.

## Step 8. Cash flow, month by month

```
structure          single
recovery period    48 months
invoicing          annual in advance, so each 12-month block bills in its first month
contractor staged  no, so the whole contractor cost leaves in month 1

total revenue      1,226,865
total cost         802,200
MINIMUM CASH       -254,284 at month 12
```

| month | hardware in | hosting in | advance | CASH IN | hardware out | contractor out | hosting out | factoring principal | factoring interest | CASH OUT | net | cumulative |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 181,124.25 | 125,592 | 0 | 306,716.25 | 480,600 | 0 | 6,700 | 0 | 0 | 487,300 | -180,583.75 | -180,583.75 |
| 2 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | -187,283.75 |
| 3 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | -193,983.75 |
| 4 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | -200,683.75 |
| 5 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | -207,383.75 |
| 6 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | -214,083.75 |
| 7 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | -220,783.75 |
| 8 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | -227,483.75 |
| 9 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | -234,183.75 |
| 10 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | -240,883.75 |
| 11 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | -247,583.75 |
| 12 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | -254,283.75 |
| 13 | 181,124.25 | 125,592 | 0 | 306,716.25 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | 300,016.25 | 45,732.5 |
| 14 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | 39,032.5 |
| 15 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | 32,332.5 |
| 16 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | 25,632.5 |
| 17 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | 18,932.5 |
| 18 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | 12,232.5 |
| 19 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | 5,532.5 |
| 20 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | -1,167.5 |
| 21 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | -7,867.5 |
| 22 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | -14,567.5 |
| 23 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | -21,267.5 |
| 24 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | -27,967.5 |
| 25 | 181,124.25 | 125,592 | 0 | 306,716.25 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | 300,016.25 | 272,048.75 |
| 26 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | 265,348.75 |
| 27 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | 258,648.75 |
| 28 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | 251,948.75 |
| 29 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | 245,248.75 |
| 30 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | 238,548.75 |
| 31 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | 231,848.75 |
| 32 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | 225,148.75 |
| 33 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | 218,448.75 |
| 34 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | 211,748.75 |
| 35 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | 205,048.75 |
| 36 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | 198,348.75 |
| 37 | 181,124.25 | 125,592 | 0 | 306,716.25 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | 300,016.25 | 498,365 |
| 38 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | 491,665 |
| 39 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | 484,965 |
| 40 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | 478,265 |
| 41 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | 471,565 |
| 42 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | 464,865 |
| 43 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | 458,165 |
| 44 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | 451,465 |
| 45 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | 444,765 |
| 46 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | 438,065 |
| 47 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | 431,365 |
| 48 | 0 | 0 | 0 | 0 | 0 | 0 | 6,700 | 0 | 0 | 6,700 | -6,700 | 424,665 |

---

# G2. CAPEX two-phase: recovery period and milestone payments

## The inputs, in full

| input | value |
|---|---|
| Payment mode | capex |
| Structure | twoPhase |
| SafeSight units on existing infrastructure | 22 |
| SafeSight units on new infrastructure | 14 |
| AQ Sensor units | 7 |
| HEMIR units | 3 |
| Contract duration, months | 60 |
| Recovery period, months | 18 |
| Target margin | 30% |
| Warranty | 4% |
| Installation responsibility | Terminus Contractor - Lump Sum |
| Lump sum cost | 214,000 |
| Invoicing | annual |
| Withholding tax | 0% |
| GST | 0% |
| Grossed up for WHT | no |
| MARGIN OVERRIDE, Hosting, SafeSight | 41% |
| MARGIN OVERRIDE, Hosting, AQ Sensor | 37% |
| MARGIN OVERRIDE, Hosting, HEMIR | 44% |

**Contractor payment milestones** (a percentage of the lump sum COST)

| month | milestone | % |
|---|---|---|
| 1 | Contract start | 40% |
| 5 | Installation complete | 35% |
| 9 | Go live | 25% |

## The rates this deal priced against, and where each came from

| rate | value | source |
|---|---|---|
| SafeSight unit cost | 8,000 | catalog |
| AQ Sensor unit cost | 2,000 | catalog |
| HEMIR unit cost | 100,000 | catalog |
| Hosting per SafeSight unit per month | 200 | catalog |
| Hosting per AQ Sensor per month | 100 | catalog |
| Hosting per HEMIR per month | 500 | catalog |
| Install per SafeSight on existing infrastructure | 1,500 | catalog |
| Install per SafeSight on new infrastructure | 2,500 | catalog |
| Install per AQ Sensor | 400 | catalog |
| Install per HEMIR | 3,000 | catalog |

## Step 1. Hardware cost, and the warranty provision

```
hardware cost = 8,000 x 36  +  2,000 x 7  +  100,000 x 3
              = 602,000

warranty COUNT = ceiling( 36 SafeSight units x 4% ) = 2 unit(s)
   the basis is SAFESIGHT UNITS ONLY, and it rounds UP
warranty UNIT VALUE = 8,000 unit cost + 1,500 existing-infrastructure install = 9,500
warranty COST = 2 x 9,500 = 19,000
```

## Step 2. The margin each line prices at

| line | prices from | the figure, and where it came from |
|---|---|---|
| SafeSight hardware | a MARGIN | 30%, the deal's target margin |
| AQ Sensor hardware | a MARGIN | 30%, the deal's target margin |
| HEMIR hardware | a MARGIN | 30%, the deal's target margin |
| Warranty provision | nothing. It goes at COST | the warranty reaches the customer at cost, by rule |
| Installation, lump sum | a MARGIN | 30%, the deal's target margin |
| Hosting, SafeSight | a MARGIN | 41%, overridden for this line |
| Hosting, AQ Sensor | a MARGIN | 37%, overridden for this line |
| Hosting, HEMIR | a MARGIN | 44%, overridden for this line |

## Step 3. The three priced groups

Price is `cost / (1 - margin)`, rounded to whole dollars. It is a DIVISION,
not a markup: a 30% margin on $100 of cost is $142.86, not $130.

**Hardware**

| line | cost | margin used | price | implied margin | priced from |
|---|---|---|---|---|---|
| SafeSight hardware | 288,000 |  | 411,429 | 30.000072916590714% | cost / (1 - margin) |
| AQ Sensor hardware | 14,000 |  | 20,000 | 30.000000000000004% | cost / (1 - margin) |
| HEMIR hardware | 300,000 |  | 428,571 | 29.999929999929996% | cost / (1 - margin) |
| Warranty provision | 19,000 |  | 19,000 | 0% | cost / (1 - margin) |
| **total** | **621,000** | | **879,000** | | |

**Installation**

| line | cost | margin used | price | implied margin | priced from |
|---|---|---|---|---|---|
| Installation, lump sum | 214,000 |  | 305,714 | 29.999934579378106% | cost / (1 - margin) |
| **total** | **214,000** | | **305,714** | | |

**Hosting** (per month)

| line | cost | margin used | price | implied margin | priced from |
|---|---|---|---|---|---|
| Hosting, SafeSight | 7,200 |  | 12,203 | 40.998115217569456% | cost / (1 - margin) |
| Hosting, AQ Sensor | 700 |  | 1,111 | 36.99369936993699% | cost / (1 - margin) |
| Hosting, HEMIR | 1,500 |  | 2,679 | 44.00895856662934% | cost / (1 - margin) |
| **total** | **9,400** | | **15,993** | | |

## Step 4. Contract totals

```
one-off price      = hardware 879,000 + installation 305,714 = 1,184,714
hosting per month  = 15,993
hosting over term  = 15,993 x 60 = 959,580
CONTRACT NET       = 1,184,714 + 959,580 = 2,144,294

total deal cost    = 621,000 + 214,000 + 9,400 x 60 = 1,399,000
margin before finance = (2,144,294 - 1,399,000) / 2,144,294 = 34.75708088536366%
```

## Step 5. Withholding tax and GST

```
NOT grossed up, so the invoice base IS contract net = 2,144,294
  WHT deducted by the customer = 2,144,294 x 0% = 0
  GST                          = 2,144,294 x 0% = 0
  WHT BORNE BY TERMINUS        = 0   (the full amount, because there is no gross-up)
```

## Step 6. The bottom line

```
priced cost        1,399,000
finance cost     + 0
WHT borne        + 0
Test Bed cost    + 0   (none of these four came from a conversion)
TOTAL DEAL COST  = 1,399,000

ACHIEVED MARGIN  = (2,144,294 - 1,399,000) / 2,144,294 = 34.75708088536366%
```

## Step 7. Cash flow, month by month

```
structure          twoPhase
recovery period    18 months
invoicing          annual in advance, so each 12-month block bills in its first month
contractor staged  yes, from the schedule above

total revenue      2,144,294
total cost         1,399,000
MINIMUM CASH       33,925 at month 12
```

| month | hardware in | hosting in | advance | CASH IN | hardware out | contractor out | hosting out | factoring principal | factoring interest | CASH OUT | net | cumulative |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 789,809.33 | 191,916 | 0 | 981,725.33 | 621,000 | 85,600 | 9,400 | 0 | 0 | 716,000 | 265,725.33 | 265,725.33 |
| 2 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 256,325.33 |
| 3 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 246,925.33 |
| 4 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 237,525.33 |
| 5 | 0 | 0 | 0 | 0 | 0 | 74,900 | 9,400 | 0 | 0 | 84,300 | -84,300 | 153,225.33 |
| 6 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 143,825.33 |
| 7 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 134,425.33 |
| 8 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 125,025.33 |
| 9 | 0 | 0 | 0 | 0 | 0 | 53,500 | 9,400 | 0 | 0 | 62,900 | -62,900 | 62,125.33 |
| 10 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 52,725.33 |
| 11 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 43,325.33 |
| 12 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 33,925.33 |
| 13 | 394,904.67 | 191,916 | 0 | 586,820.67 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | 577,420.67 | 611,346 |
| 14 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 601,946 |
| 15 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 592,546 |
| 16 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 583,146 |
| 17 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 573,746 |
| 18 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 564,346 |
| 19 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 554,946 |
| 20 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 545,546 |
| 21 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 536,146 |
| 22 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 526,746 |
| 23 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 517,346 |
| 24 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 507,946 |
| 25 | 0 | 191,916 | 0 | 191,916 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | 182,516 | 690,462 |
| 26 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 681,062 |
| 27 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 671,662 |
| 28 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 662,262 |
| 29 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 652,862 |
| 30 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 643,462 |
| 31 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 634,062 |
| 32 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 624,662 |
| 33 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 615,262 |
| 34 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 605,862 |
| 35 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 596,462 |
| 36 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 587,062 |
| 37 | 0 | 191,916 | 0 | 191,916 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | 182,516 | 769,578 |
| 38 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 760,178 |
| 39 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 750,778 |
| 40 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 741,378 |
| 41 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 731,978 |
| 42 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 722,578 |
| 43 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 713,178 |
| 44 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 703,778 |
| 45 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 694,378 |
| 46 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 684,978 |
| 47 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 675,578 |
| 48 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 666,178 |
| 49 | 0 | 191,916 | 0 | 191,916 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | 182,516 | 848,694 |
| 50 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 839,294 |
| 51 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 829,894 |
| 52 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 820,494 |
| 53 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 811,094 |
| 54 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 801,694 |
| 55 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 792,294 |
| 56 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 782,894 |
| 57 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 773,494 |
| 58 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 764,094 |
| 59 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 754,694 |
| 60 | 0 | 0 | 0 | 0 | 0 | 0 | 9,400 | 0 | 0 | 9,400 | -9,400 | 745,294 |

---

# G3. Hybrid with PO factoring and withholding tax

## The inputs, in full

| input | value |
|---|---|
| Payment mode | capex |
| Structure | hybrid |
| SafeSight units on existing infrastructure | 26 |
| SafeSight units on new infrastructure | 11 |
| AQ Sensor units | 5 |
| HEMIR units | 0 |
| Contract duration, months | 36 |
| Recovery period, months | not recorded |
| Target margin | 34% |
| Warranty | 3% |
| Installation responsibility | Terminus Contractor - Per Unit |
| Lump sum cost | n/a |
| Invoicing | monthly |
| Withholding tax | 15% |
| GST | 8% |
| Grossed up for WHT | no |
| PO factoring | on, 1.4% per month, 24 months, declining |

**Customer payment milestones** (a percentage of the one-off PRICE)

| month | milestone | % |
|---|---|---|
| 2 | Contract start | 45% |
| 7 | Installation complete | 35% |
| 13 | Go live | 20% |

## The rates this deal priced against, and where each came from

| rate | value | source |
|---|---|---|
| SafeSight unit cost | 8,000 | catalog |
| AQ Sensor unit cost | 2,000 | catalog |
| HEMIR unit cost | 100,000 | catalog |
| Hosting per SafeSight unit per month | 200 | catalog |
| Hosting per AQ Sensor per month | 100 | catalog |
| Hosting per HEMIR per month | 500 | catalog |
| Install per SafeSight on existing infrastructure | 1,500 | catalog |
| Install per SafeSight on new infrastructure | 2,500 | catalog |
| Install per AQ Sensor | 400 | catalog |
| Install per HEMIR | 3,000 | catalog |

## Step 1. Hardware cost, and the warranty provision

```
hardware cost = 8,000 x 37  +  2,000 x 5  +  100,000 x 0
              = 306,000

warranty COUNT = ceiling( 37 SafeSight units x 3% ) = 2 unit(s)
   the basis is SAFESIGHT UNITS ONLY, and it rounds UP
warranty UNIT VALUE = 8,000 unit cost + 1,500 existing-infrastructure install = 9,500
warranty COST = 2 x 9,500 = 19,000
```

## Step 2. The margin each line prices at

| line | prices from | the figure, and where it came from |
|---|---|---|
| SafeSight hardware | a MARGIN | 34%, the deal's target margin |
| AQ Sensor hardware | a MARGIN | 34%, the deal's target margin |
| HEMIR hardware | a MARGIN | 34%, the deal's target margin |
| Warranty provision | nothing. It goes at COST | the warranty reaches the customer at cost, by rule |
| Install, SafeSight on existing infrastructure | a MARGIN | 34%, the deal's target margin |
| Install, SafeSight on new infrastructure | a MARGIN | 34%, the deal's target margin |
| Install, AQ Sensor | a MARGIN | 34%, the deal's target margin |
| Install, HEMIR | a MARGIN | 34%, the deal's target margin |
| Hosting, SafeSight | a MARGIN | 34%, the deal's target margin |
| Hosting, AQ Sensor | a MARGIN | 34%, the deal's target margin |
| Hosting, HEMIR | a MARGIN | 34%, the deal's target margin |

## Step 3. The three priced groups

Price is `cost / (1 - margin)`, rounded to whole dollars. It is a DIVISION,
not a markup: a 30% margin on $100 of cost is $142.86, not $130.

**Hardware**

| line | cost | margin used | price | implied margin | priced from |
|---|---|---|---|---|---|
| SafeSight hardware | 296,000 |  | 448,485 | 34.00002229728977% | cost / (1 - margin) |
| AQ Sensor hardware | 10,000 |  | 15,152 | 34.00211193241817% | cost / (1 - margin) |
| HEMIR hardware | 0 |  | 0 | no price, so none | cost / (1 - margin) |
| Warranty provision | 19,000 |  | 19,000 | 0% | cost / (1 - margin) |
| **total** | **325,000** | | **482,637** | | |

**Installation**

| line | cost | margin used | price | implied margin | priced from |
|---|---|---|---|---|---|
| Install, SafeSight on existing infrastructure | 39,000 |  | 59,091 | 34.00010153830533% | cost / (1 - margin) |
| Install, SafeSight on new infrastructure | 27,500 |  | 41,667 | 34.00052799577603% | cost / (1 - margin) |
| Install, AQ Sensor | 2,000 |  | 3,030 | 33.993399339933994% | cost / (1 - margin) |
| Install, HEMIR | 0 |  | 0 | no price, so none | cost / (1 - margin) |
| **total** | **68,500** | | **103,788** | | |

**Hosting** (per month)

| line | cost | margin used | price | implied margin | priced from |
|---|---|---|---|---|---|
| Hosting, SafeSight | 7,400 |  | 11,212 | 33.99928647877274% | cost / (1 - margin) |
| Hosting, AQ Sensor | 500 |  | 758 | 34.03693931398417% | cost / (1 - margin) |
| Hosting, HEMIR | 0 |  | 0 | no price, so none | cost / (1 - margin) |
| **total** | **7,900** | | **11,970** | | |

## Step 4. Contract totals

```
one-off price      = hardware 482,637 + installation 103,788 = 586,425
hosting per month  = 11,970
hosting over term  = 11,970 x 36 = 430,920
CONTRACT NET       = 586,425 + 430,920 = 1,017,345

total deal cost    = 325,000 + 68,500 + 7,900 x 36 = 677,900
margin before finance = (1,017,345 - 677,900) / 1,017,345 = 33.3657707070856%
```

## Step 5. Withholding tax and GST

```
NOT grossed up, so the invoice base IS contract net = 1,017,345
  WHT deducted by the customer = 1,017,345 x 15% = 152,602
  GST                          = 1,017,345 x 8% = 81,388
  WHT BORNE BY TERMINUS        = 152,602   (the full amount, because there is no gross-up)
```

## Step 6. The bottom line

```
priced cost        677,900
finance cost     + 72,526
WHT borne        + 152,602
Test Bed cost    + 0   (none of these four came from a conversion)
TOTAL DEAL COST  = 903,028

ACHIEVED MARGIN  = (1,017,345 - 903,028) / 1,017,345 = 11.236797743145148%
```

## Step 7. Cash flow, month by month

```
structure          hybrid
recovery period    none (this structure has no recovery period)
invoicing          monthly
contractor staged  no, so the whole contractor cost leaves in month 1
factoring          393,500 advanced in month 1, repaid over 24 months, declining
factoring interest 72,525.69 in total

total revenue      1,017,345
total cost         750,425.69
MINIMUM CASH       4,070 at month 1
```

| month | hardware in | hosting in | advance | CASH IN | hardware out | contractor out | hosting out | factoring principal | factoring interest | CASH OUT | net | cumulative |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 | 11,970 | 393,500 | 405,470 | 393,500 | 0 | 7,900 | 0 | 0 | 401,400 | 4,070 | 4,070 |
| 2 | 263,891.25 | 11,970 | 0 | 275,861.25 | 0 | 0 | 7,900 | 13,908.74 | 5,509 | 27,317.74 | 248,543.51 | 252,613.51 |
| 3 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 14,103.46 | 5,314.28 | 27,317.74 | -15,347.74 | 237,265.78 |
| 4 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 14,300.91 | 5,116.83 | 27,317.74 | -15,347.74 | 221,918.04 |
| 5 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 14,501.12 | 4,916.62 | 27,317.74 | -15,347.74 | 206,570.3 |
| 6 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 14,704.14 | 4,713.6 | 27,317.74 | -15,347.74 | 191,222.57 |
| 7 | 205,248.75 | 11,970 | 0 | 217,218.75 | 0 | 0 | 7,900 | 14,909.99 | 4,507.74 | 27,317.74 | 189,901.01 | 381,123.58 |
| 8 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 15,118.73 | 4,299 | 27,317.74 | -15,347.74 | 365,775.84 |
| 9 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 15,330.4 | 4,087.34 | 27,317.74 | -15,347.74 | 350,428.1 |
| 10 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 15,545.02 | 3,872.72 | 27,317.74 | -15,347.74 | 335,080.37 |
| 11 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 15,762.65 | 3,655.08 | 27,317.74 | -15,347.74 | 319,732.63 |
| 12 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 15,983.33 | 3,434.41 | 27,317.74 | -15,347.74 | 304,384.89 |
| 13 | 117,285 | 11,970 | 0 | 129,255 | 0 | 0 | 7,900 | 16,207.1 | 3,210.64 | 27,317.74 | 101,937.26 | 406,322.16 |
| 14 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 16,434 | 2,983.74 | 27,317.74 | -15,347.74 | 390,974.42 |
| 15 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 16,664.07 | 2,753.67 | 27,317.74 | -15,347.74 | 375,626.68 |
| 16 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 16,897.37 | 2,520.37 | 27,317.74 | -15,347.74 | 360,278.95 |
| 17 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 17,133.93 | 2,283.81 | 27,317.74 | -15,347.74 | 344,931.21 |
| 18 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 17,373.81 | 2,043.93 | 27,317.74 | -15,347.74 | 329,583.47 |
| 19 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 17,617.04 | 1,800.7 | 27,317.74 | -15,347.74 | 314,235.74 |
| 20 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 17,863.68 | 1,554.06 | 27,317.74 | -15,347.74 | 298,888 |
| 21 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 18,113.77 | 1,303.97 | 27,317.74 | -15,347.74 | 283,540.26 |
| 22 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 18,367.36 | 1,050.37 | 27,317.74 | -15,347.74 | 268,192.52 |
| 23 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 18,624.51 | 793.23 | 27,317.74 | -15,347.74 | 252,844.79 |
| 24 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 18,885.25 | 532.49 | 27,317.74 | -15,347.74 | 237,497.05 |
| 25 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 19,149.64 | 268.09 | 27,317.74 | -15,347.74 | 222,149.31 |
| 26 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 0 | 0 | 7,900 | 4,070 | 226,219.31 |
| 27 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 0 | 0 | 7,900 | 4,070 | 230,289.31 |
| 28 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 0 | 0 | 7,900 | 4,070 | 234,359.31 |
| 29 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 0 | 0 | 7,900 | 4,070 | 238,429.31 |
| 30 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 0 | 0 | 7,900 | 4,070 | 242,499.31 |
| 31 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 0 | 0 | 7,900 | 4,070 | 246,569.31 |
| 32 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 0 | 0 | 7,900 | 4,070 | 250,639.31 |
| 33 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 0 | 0 | 7,900 | 4,070 | 254,709.31 |
| 34 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 0 | 0 | 7,900 | 4,070 | 258,779.31 |
| 35 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 0 | 0 | 7,900 | 4,070 | 262,849.31 |
| 36 | 0 | 11,970 | 0 | 11,970 | 0 | 0 | 7,900 | 0 | 0 | 7,900 | 4,070 | 266,919.31 |

---

# G4. CAPEX two-phase with an absolute price override and a margin override

## The inputs, in full

| input | value |
|---|---|
| Payment mode | capex |
| Structure | twoPhase |
| SafeSight units on existing infrastructure | 15 |
| SafeSight units on new infrastructure | 9 |
| AQ Sensor units | 6 |
| HEMIR units | 4 |
| Contract duration, months | 54 |
| Recovery period, months | 24 |
| Target margin | 29% |
| Warranty | 6% |
| Installation responsibility | Terminus Contractor - Per Unit |
| Lump sum cost | n/a |
| Invoicing | annual |
| Withholding tax | 12% |
| GST | 0% |
| Grossed up for WHT | yes |
| MARGIN OVERRIDE, SafeSight hardware | 45% |
| PRICE OVERRIDE, HEMIR hardware | 612,000 |
| RATE OVERRIDE, Install per SafeSight on existing infrastructure | 1,650 |

## The rates this deal priced against, and where each came from

| rate | value | source |
|---|---|---|
| SafeSight unit cost | 8,000 | catalog |
| AQ Sensor unit cost | 2,000 | catalog |
| HEMIR unit cost | 100,000 | catalog |
| Hosting per SafeSight unit per month | 200 | catalog |
| Hosting per AQ Sensor per month | 100 | catalog |
| Hosting per HEMIR per month | 500 | catalog |
| Install per SafeSight on existing infrastructure | 1,650 | quoted for this job (catalog says 1,500) |
| Install per SafeSight on new infrastructure | 2,500 | catalog |
| Install per AQ Sensor | 400 | catalog |
| Install per HEMIR | 3,000 | catalog |

## Step 1. Hardware cost, and the warranty provision

```
hardware cost = 8,000 x 24  +  2,000 x 6  +  100,000 x 4
              = 604,000

warranty COUNT = ceiling( 24 SafeSight units x 6% ) = 2 unit(s)
   the basis is SAFESIGHT UNITS ONLY, and it rounds UP
warranty UNIT VALUE = 8,000 unit cost + 1,650 existing-infrastructure install = 9,650
warranty COST = 2 x 9,650 = 19,300
```

## Step 2. The margin each line prices at

| line | prices from | the figure, and where it came from |
|---|---|---|
| SafeSight hardware | a MARGIN | 45%, overridden for this line |
| AQ Sensor hardware | a MARGIN | 29%, the deal's target margin |
| HEMIR hardware | an absolute PRICE | 612,000, entered for this line. The margin is not used |
| Warranty provision | nothing. It goes at COST | the warranty reaches the customer at cost, by rule |
| Install, SafeSight on existing infrastructure | a MARGIN | 29%, the deal's target margin |
| Install, SafeSight on new infrastructure | a MARGIN | 29%, the deal's target margin |
| Install, AQ Sensor | a MARGIN | 29%, the deal's target margin |
| Install, HEMIR | a MARGIN | 29%, the deal's target margin |
| Hosting, SafeSight | a MARGIN | 29%, the deal's target margin |
| Hosting, AQ Sensor | a MARGIN | 29%, the deal's target margin |
| Hosting, HEMIR | a MARGIN | 29%, the deal's target margin |

## Step 3. The three priced groups

Price is `cost / (1 - margin)`, rounded to whole dollars. It is a DIVISION,
not a markup: a 30% margin on $100 of cost is $142.86, not $130.

**Hardware**

| line | cost | margin used | price | implied margin | priced from |
|---|---|---|---|---|---|
| SafeSight hardware | 192,000 |  | 349,091 | 45.00001432291294% | cost / (1 - margin) |
| AQ Sensor hardware | 12,000 |  | 16,901 | 28.998284125199692% | cost / (1 - margin) |
| HEMIR hardware | 400,000 | n/a | 612,000 | 34.64052287581699% | an absolute price override |
| Warranty provision | 19,300 |  | 19,300 | 0% | cost / (1 - margin) |
| **total** | **623,300** | | **997,292** | | |

**Installation**

| line | cost | margin used | price | implied margin | priced from |
|---|---|---|---|---|---|
| Install, SafeSight on existing infrastructure | 24,750 |  | 34,859 | 28.99968444304197% | cost / (1 - margin) |
| Install, SafeSight on new infrastructure | 22,500 |  | 31,690 | 28.99968444304197% | cost / (1 - margin) |
| Install, AQ Sensor | 2,400 |  | 3,380 | 28.99408284023669% | cost / (1 - margin) |
| Install, HEMIR | 12,000 |  | 16,901 | 28.998284125199692% | cost / (1 - margin) |
| **total** | **61,650** | | **86,830** | | |

**Hosting** (per month)

| line | cost | margin used | price | implied margin | priced from |
|---|---|---|---|---|---|
| Hosting, SafeSight | 4,800 |  | 6,761 | 29.004585120544302% | cost / (1 - margin) |
| Hosting, AQ Sensor | 600 |  | 845 | 28.99408284023669% | cost / (1 - margin) |
| Hosting, HEMIR | 2,000 |  | 2,817 | 29.00248491302805% | cost / (1 - margin) |
| **total** | **7,400** | | **10,423** | | |

## Step 4. Contract totals

```
one-off price      = hardware 997,292 + installation 86,830 = 1,084,122
hosting per month  = 10,423
hosting over term  = 10,423 x 54 = 562,842
CONTRACT NET       = 1,084,122 + 562,842 = 1,646,964

total deal cost    = 623,300 + 61,650 + 7,400 x 54 = 1,084,550
margin before finance = (1,646,964 - 1,084,550) / 1,646,964 = 34.14853026538528%
```

## Step 5. Withholding tax and GST

```
GROSSED UP, so the invoice base is raised until the customer's deduction
leaves contract net intact:
  invoice base = 1,646,964 / (1 - 12%) = 1,871,550
  WHT deducted by the customer = 1,871,550 x 12% = 224,586
  GST                          = 1,871,550 x 0% = 0
  WHT BORNE BY TERMINUS        = 0   (zero, because the gross-up passes it to the customer)
```

## Step 6. The bottom line

```
priced cost        1,084,550
finance cost     + 0
WHT borne        + 0
Test Bed cost    + 0   (none of these four came from a conversion)
TOTAL DEAL COST  = 1,084,550

ACHIEVED MARGIN  = (1,646,964 - 1,084,550) / 1,646,964 = 34.14853026538528%
```

## Step 7. Cash flow, month by month

```
structure          twoPhase
recovery period    24 months
invoicing          annual in advance, so each 12-month block bills in its first month
contractor staged  no, so the whole contractor cost leaves in month 1

total revenue      1,646,964
total cost         1,084,550
MINIMUM CASH       -106,613 at month 12
```

| month | hardware in | hosting in | advance | CASH IN | hardware out | contractor out | hosting out | factoring principal | factoring interest | CASH OUT | net | cumulative |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 542,061 | 125,076 | 0 | 667,137 | 684,950 | 0 | 7,400 | 0 | 0 | 692,350 | -25,213 | -25,213 |
| 2 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | -32,613 |
| 3 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | -40,013 |
| 4 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | -47,413 |
| 5 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | -54,813 |
| 6 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | -62,213 |
| 7 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | -69,613 |
| 8 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | -77,013 |
| 9 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | -84,413 |
| 10 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | -91,813 |
| 11 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | -99,213 |
| 12 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | -106,613 |
| 13 | 542,061 | 125,076 | 0 | 667,137 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | 659,737 | 553,124 |
| 14 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 545,724 |
| 15 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 538,324 |
| 16 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 530,924 |
| 17 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 523,524 |
| 18 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 516,124 |
| 19 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 508,724 |
| 20 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 501,324 |
| 21 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 493,924 |
| 22 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 486,524 |
| 23 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 479,124 |
| 24 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 471,724 |
| 25 | 0 | 125,076 | 0 | 125,076 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | 117,676 | 589,400 |
| 26 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 582,000 |
| 27 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 574,600 |
| 28 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 567,200 |
| 29 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 559,800 |
| 30 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 552,400 |
| 31 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 545,000 |
| 32 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 537,600 |
| 33 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 530,200 |
| 34 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 522,800 |
| 35 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 515,400 |
| 36 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 508,000 |
| 37 | 0 | 125,076 | 0 | 125,076 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | 117,676 | 625,676 |
| 38 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 618,276 |
| 39 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 610,876 |
| 40 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 603,476 |
| 41 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 596,076 |
| 42 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 588,676 |
| 43 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 581,276 |
| 44 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 573,876 |
| 45 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 566,476 |
| 46 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 559,076 |
| 47 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 551,676 |
| 48 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 544,276 |
| 49 | 0 | 62,538 | 0 | 62,538 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | 55,138 | 599,414 |
| 50 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 592,014 |
| 51 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 584,614 |
| 52 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 577,214 |
| 53 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 569,814 |
| 54 | 0 | 0 | 0 | 0 | 0 | 0 | 7,400 | 0 | 0 | 7,400 | -7,400 | 562,414 |
