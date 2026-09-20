# Walk 4, Phase 0: measured, nothing built

Model: **Claude Opus 5 (1M context)**.
Branch `opp-walk4`, off `main` at `37a2196`, confirmed equal to `origin/main`
and to `git ls-remote origin main` before the branch was cut.

**Nothing is built. Nothing is pushed.**

---

## 0. The headline, first

**Two findings change a disposition, and both need John.**

- **O2 does NOT release for build.** Phase 0 found a scope change in it: the
  three elements fit on one line at 1440 with **7px to spare** and are **67px
  short at 1240**. There is also a standing ruling, A1, that deliberately does
  the opposite of what O2 asks.
- **O4's prototype answer EXISTS and is concrete.** It is not a case of "no
  record, needs restatement". The prototype is in this repository and specifies
  the two panels in detail, including two things the current build does not
  have at all.

O3, O5 and O6 release for build as written.

---

## 1. Q1: the Commercials section order (O3)

Measured on the rendered surface, top to bottom, after the panel had
initialised and computed.

| | current | O3's target |
|---|---|---|
| 1 | Units Required and Installation | **Structural Terms** |
| 2 | Structural Terms | **Units/Installation** |
| 3 | **Deal Sheet Summary** | Payment Terms |
| 4 | Payment Terms | Cash Flow |
| 5 | Cash flow (USD) | **Deal Sheet** |
| 6 | Versions | Versions |

**Two sections move and one moves a long way.** Structural Terms comes up from
2 to 1, Units/Installation drops to 2, and the **Deal Sheet travels from 3 to
5**, past Payment Terms and Cash Flow.

**The cost: it is a JSX move, not a data change.** `VANILLA_SECTIONS` in
`sections.ts` is a list of four and looks like the order, but it drives
LATCHING and DIRTY state, not render order. The order lives in `DealPanel.tsx`
as the sequence of `<section>` and component calls. So the reorder is a
structural edit to the render tree.

**And a rebuild is also a survey.** `VANILLA_SECTIONS` order and the render
order already disagree: the list does not contain the Deal Sheet at all, which
is why it can sit third on screen while the list has four entries. Anything
reading that list as "the order" is reading a different fact.

**One instrument note.** The first run of this census read **28 titles, 17 of
them at y=0**, because `#deal-form-vanilla` is a full duplicate of this screen
that renders nothing. A title inside it is not a section of the live surface.
The census now excludes the three retired blocks by name.

---

## 2. Q2: Hybrid payment terms against the prototype (O4)

### The prototype exists, and this is what it says

`Prototype-110826/Terminus Ops.dc.html`, 11,391 lines, 25 mentions of hybrid.
The search was calibrated on a known-present term before its results were read.

It specifies **two panels**:

**Panel one, "Hardware milestones (max 5)"**

| | |
|---|---|
| columns | **Month, Project milestone, %, USD** |
| rows | five |
| the milestone cell | a **`<select>`** of project-milestone options |
| after the rows | a **Total row**: blank, "Total", total %, total USD |
| below that | **"Computed hardware price: ..."** |
| conditional | a short-fall note when the five do not total 100% |

**Panel two, invoicing and hosting**

| | |
|---|---|
| "Invoicing" | two options, **Annual in advance** and **Monthly** |
| then | a schedule label, the year rows, a **Total**, and a hosting note |

The prototype's own rule text, `op53`, is worth quoting because it is the
contract: *"Hybrid only. Maximum of 5. Each milestone carries the Month the
payment is made, the Project Milestone (picklist) it is tied to, and the % of
the hardware and installation total. The USD value is calculated from the %,
and entering USD recalculates the %. The five must total 100%."*

### What the current build has

**The two panels already exist** inside `#deal-hybrid-group`, which is the
useful surprise: O4 is not building two panels from nothing.

Measured live, the delta is four things:

1. **They are STACKED, not side by side.** Panel one at y=3151, panel two at
   y=3538, both `left=319` and both `width=753`. Two panels in the prototype's
   sense means two columns; today it is one column of two blocks.
2. **No Total row.** The prototype totals the % and the USD. The current grid
   ends at row five.
3. **No "Computed hardware price" line.**
4. **The Milestone cell is a free-text `<input>`**, where the prototype
   specifies a **picklist**. The column is also titled "Milestone" rather than
   "Project milestone", and "% of hardware" rather than "%".

**What the current build has that the prototype does not**: a warning when the
percentages do not total 100, which is the prototype's short-fall note built a
different way, and a read-only computed USD column, which is the prototype's
"USD is calculated from the %" half. **The prototype also allows typing USD to
recalculate the %, and the current build does not**: the USD input is
`readOnly` with `tabIndex={-1}`.

**That last one is a behaviour change, not a layout change**, and it is the
part of O4 most likely to be larger than it looks.

---

## 3. Q3: the Month field and the milestone grid (O5, O6)

### O6: the misalignment mechanism, and it is structural

**A table is nested inside another table's `tbody`.** Confirmed by asserting
parentage on the live DOM rather than by reading the source:

> the field table is nested INSIDE the header table's tbody: **true**

`section5.tsx` renders `<table class="doc-table">` with a `<thead>` of four
`<th>`, and puts the whole of `MilestoneGrid` (which renders **its own
`<table>`**) inside that table's single `<tbody>`. So the header row and the
fields are laid out by two different tables with independent column widths.

The consequence, measured:

```
  header  Month              left=  319 width=512
  header  Milestone          left=  831 width=90
  header  % of hardware      left=  921 width=105
  header  USD                left= 1026 width=46
  field 1                    left=  319 width=112
  field 2                    left=  431 width=112
  field 3                    left=  542 width=112
  field 4                    left=  654 width=177

  HEADER-TO-FIELD OFFSET per column: [0, 400, 379, 372]
```

The outer table has one real row, so its first column absorbs the entire inner
table's width (512px) and the other three headers are pushed to the right of
it. **Three of the four headers sit 372 to 400px away from the fields they
name.** That is exactly John's "headers currently offset far right".

### O6: the partial borders

Visible in the capture and consistent with the measurement: the Month, Milestone
and % inputs render with **no visible border** (a 1px bottom at 0.12 alpha on
the dark ground), while the USD input carries the **`.is-computed`** treatment
and reads as a bright outlined box. Four cells in a row, three unbordered and
one boxed, is the fragmentary look.

### O5: the Month field

```
  width: 88px      maxLength: "2"
```

**88px of box for two characters.** The field is sized by the table column, not
by its content, and the content is capped at two characters by the markup
itself, so the requirement is already stated in the DOM.

---

## 4. Q4: the pricing calculation, end to end (O7's blast radius)

**No design decisions here. This is the map.**

### Where a per-unit price is derived

```
priceFromCost(cost, marginPct)          price = cost / (1 - margin)
  -> priceGroup()                        per-row rawCost and rawPrice
     -> hardware group
     -> installation group
     -> hosting group (per month)
```

There is **no per-unit price variable today**. A unit's price is a row inside a
group, derived from its cost and a margin, and the margin may already be
overridden per line by `marginOverrides`. **That is the closest existing thing
to O7's switch**: the estate already has a per-line override, of the MARGIN.
O7 asks to override the PRICE instead.

### What consumes it

```
oneOffPrice     = hardware.rawTotalPrice + install.rawTotalPrice
hostingMonthPrice = hosting.rawTotalPrice
hostingTermPrice  = hostingMonthPrice * months
contractNet       = oneOffPrice + hostingTermPrice
achievedMarginPreFinance
```

| output | consumed by |
|---|---|
| `rawTotalPrice` | `deal/rows.ts`, `deal/section4.tsx` (the deal sheet lines), `deal/intake.tsx`, `testbed/costBreakdown.ts` |
| `oneOffPrice` | `deal/milestones.ts` (**the milestone USD is a % of this**), `DealPanel.tsx` |
| `hostingMonthPrice` | the calculator, into the term price |
| `contractNet` | `opportunity-headline.js` (**the headline figure**), `approval-page.js`, `routes/deals.js`, `ApprovalBlocks.tsx`, `deal-inputs.js` |
| `achievedMargin` | the calculator, `approval-page.js`, `DealPanel.tsx`, `panelParts.tsx`, `routes/deals.js` |
| `marginOverrides` | `latches.js`, `version-pricing.js`, `deal-inputs.js`, `approval-page.js`, `routes/opportunities.js` |

### What a unit-level price override would touch

Six things, and the last two are the ones that make it more than a UI change:

1. **The deal sheet lines**, which display cost and price per row.
2. **`contractNet`**, and therefore the Opportunity's **headline total contract
   value** and the weighted amount derived from it.
3. **The cash flow**, which schedules `oneOffPrice` and the hosting price.
4. **The milestones**, whose USD is a percentage of `oneOffPrice`: change a
   unit price and every milestone USD moves under the same percentages.
5. **`achievedMargin`**, which is currently DERIVED from cost and price. An
   entered price makes margin an output rather than an input, which is the
   direction O7 names ("recalculated % Margin").
6. **Versions and approvals.** `version-pricing.js` and `approval-page.js` read
   the pricing inputs, and an approved version FREEZES them. A new override key
   is a new payload key that must be carried into the snapshot, the approval
   page's reader, and the route allowlist, or an approver sees a price the deal
   does not have.

**And one thing the map says that the spec does not.** O7's table has a
**Warranty %** column and says warranty is entered as a percentage of hardware
cost per unit and becomes a **separate deal sheet line item**. Today warranty is
inside the hardware group ("Unit cost and warranty" is one card), so making it a
separate line is a change to the GROUP STRUCTURE, not only to the display.

---

## 5. Q5: the Notes header (O2), and the scope change

### What it is today

```
  card title   top=575  "Notes"
  header row   top=605  "Latest first" + the range buttons
  add note     top=641  "Add note"
  distinct tops: 3
```

**Three lines**, not one. The card title is outside the header row, and Add
note has wrapped onto a third line because the 355px header cannot hold it.

### The shared component already has the collapsed mode

`NotesHistory` takes `actionsInHeader` and `title`, and `LeadCard` already
passes both. The Opportunity band passes neither, so it renders the
un-collapsed shape inside our own `Card`.

**So O2 is mostly a matter of using the mode that exists** rather than building
one. That is the cheap half.

### And here is the scope change

**There is a standing ruling, A1, that does the opposite of what O2 asks**, and
it is recorded at the code:

> *"Latest first" gives way to the rungs when there are rungs. The column is a
> third of a card and cannot hold NOTES + Latest first + three rungs + Add
> note: measured, the secondary wrapped to two lines and Add note was clipped
> at the column edge.*

O2 asks for **NOTES, LATEST FIRST and the range buttons together**. A1 ruled
that "Latest first" gives way precisely when the range buttons appear.

**Measured on the Opportunity band, which is a different surface from the lead
card A1 was ruled on:**

| | 1440 | 1240 |
|---|---|---|
| card width available | 385px | **311px** |
| NOTES + Latest first + range | **378px, FITS** (7px spare) | **378px, 67px SHORT** |
| all four, with Add note | 475px, 90px short | 475px, 164px short |

**So O2 as written is achievable at 1440 and not at 1240**, and Add note never
fits on that line at either width.

**This is why O2 does not release for build.** Three answers are available and
they are John's to choose, not mine:

1. **Keep A1's rule and apply O2 only where it fits**, so "Latest first" gives
   way at 1240 and returns at 1440. Honest, and the header changes shape with
   the window.
2. **Shorten the range buttons** so all three fit at 1240. "Latest 2 / Last 10
   / All" is 235px of the 311px available; shorter labels or an icon would buy
   the 67px.
3. **Widen the Notes card** in the band, which moves Summary and the follow-up
   task with it.

**Add note stays off that line under all three**, which is what the existing
`actionsInHeader` mode already does.

---

## 6. What this report does NOT establish

- **No design decision is taken for O7 or O8.** Section 4 is a map of what an
  override would touch, not a proposal for how it should work.
- The O4 delta is measured on the **rendered surface and the prototype's
  markup**. I have not established that the prototype's *layout* put the two
  panels side by side, only that it declares two blocks; the side-by-side
  reading comes from the current build rendering them stacked at identical left
  and width, which is what makes them read as one column.
- The milestone measurements are at **1440 on one record**. The offsets are
  structural, so they will not depend on data, but the numbers are from one
  viewport.

---

## 7. Dispositions

| | Disposition after Phase 0 |
|---|---|
| **O1** | DEFERRED by John. Untouched |
| **O2** | **DOES NOT RELEASE.** Scope change found, section 5. Three options, John's choice |
| **O3** | **Releases.** A JSX reorder; two sections move and the Deal Sheet moves past two |
| **O4** | **Waits for John.** The prototype answer is concrete, section 2. The delta includes a behaviour change: the prototype lets USD be typed to recalculate the %, and the current build does not |
| **O5** | **Releases.** 88px of box for a 2-character field |
| **O6** | **Releases.** The mechanism is a nested table; the fix is structural, not a margin tweak |
| **O7/O8** | **Waits for John.** Blast radius mapped, section 4. Warranty as a separate line is a change to the group structure |

---

## 8. State

One commit on `opp-walk4`: `7b90b3a`, the brief, markdown only, riding the
green gate at `37a2196` under build discipline 48(a).

This report and its probe commit next. **Nothing is pushed.**
