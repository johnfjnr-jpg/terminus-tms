# Walk 5, Phase 0: measured before build

Branch `opp-walk5` off `main` at `85ad44c`, confirmed equal to `origin/main`
by `git ls-remote` rather than by the local tracking ref.

**Nothing has been built.** Two findings need John's ruling before they can be,
and one of them is not the one the instruction expected.

---

## THE HEADLINE: W1 DOES NOT FIT, AND IT IS NOT CLOSE

**Measured on the live surface at both widths:**

| | 1440 | 1240 |
|---|---|---|
| `NOTES` | 40px | 40px |
| the action group (`Latest 2`, `Last 10`, `All`, `Add note`) | 298px | 298px |
| `Latest first` | 88px | 88px |
| `Showing 2 of 3` | 92px | 92px |
| plus two gaps | 16px | 16px |
| **W1 asks for** | **533px** | **533px** |
| **available inside the card** | **385px** | **311px** |
| **verdict** | **over by 148px** | **over by 222px** |

`Latest first` was measured by **building the element and reading it**, not by
carrying walk 4's number forward.

**This is ruling A1's set plus one more item, and A1 was remeasured nine days
ago.** A1 cleared `Latest first` from that line because the column is a third
of a card; walk 4 then found that even with it gone the row still overran the
card by 34px at 1240 and clipped `ADD NOTE` against the neighbouring card,
which is why `.panel-head` now wraps for this one header.

**Nothing is being refused.** W1 is a real request about a real awkwardness -
the count sits on its own line below a header that has room for nothing. But
533 into 311 is not a sizing question, so **this needs a ruling on what gives
way.** The honest options, with what each costs:

1. **Let it wrap**, which is what it does today: `NOTES` and the controls on
   one line, the count below. Costs nothing, changes nothing, and is the state
   John is calling awkward.
2. **Drop `Latest first` permanently** and put `Showing 2 of 3` on the line
   instead. 337 + 92 + 8 = **437px**, still over 385 and 311. **Does not fit
   either.**
3. **Put the count inside the action group**, replacing nothing: same 437px
   problem.
4. **Shorten the rungs.** `Latest 2 / Last 10 / All` is 235px of the 298. A
   shorter vocabulary - `2 / 10 / All` - would take roughly 120px off and bring
   the line to about 317px, which fits at 1440 and not at 1240.
5. **Widen the notes column**, which takes width from Summary or Follow-up.

**Only option 4 or 5 can satisfy W1 as written, and both change something John
has not been asked about.** That is the ruling input.

---

## W12: THE PROTOTYPE'S DROPDOWN, AND WHAT BECAME OF IT

### What the prototype had, verbatim

`Terminus Ops.dc.html:1643` renders the Project Milestone column as a
`<select>`, fed from `m.options`, which is built at `:6857` from the picklist
`projectMilestone` defined at `:5592`:

```
{ id: 'projectMilestone', label: 'Project Milestone',
  usedBy: 'Used by Opportunities -> Payment Terms -> Hardware Milestones',
  values: [
    'Contract start',
    'Hardware delivered to site',
    'Installation complete',
    'Commissioning',
    'Go live',
    'Final acceptance',
  ] }
```

with a leading `{ value: '', label: 'Select milestone' }`. **Both** milestone
grids used it: the customer one at `:6857` and the contractor one at `:6691`.

### What exists today

**The vocabulary survived. The control did not, on one of the two grids.**

- `frontend-react/src/deal/milestones.ts` exports `CONTRACTOR_MILESTONES`,
  which is **exactly the prototype's six values in the prototype's order**,
  with the same `Select milestone` placeholder.
- The **INSTALLATION (contractor) grid renders a `<select>`** from it, and even
  handles a stored value outside the list by keeping it as its own option
  rather than discarding it.
- The **customer payment-terms grid renders a free-text `<input>`.**

**And the file's own comment is false.** It opens: *"They are the SAME
COMPONENT with different bases. Both read Month | Milestone | % | USD."* They
are not the same component - `MilestoneGrid` uses inputs, `ContractorGrid` uses
a table with a select - and nothing could have failed on that sentence.

### Were named milestones lost?

**No.** Measured across every live opportunity, reading the latest revision of
each:

| | rows | carrying a name |
|---|---|---|
| customer milestones | **0** | 0 |
| contractor milestones | 13 | **13** |

and every one of the 13 is one of the prototype's six:

```
4 x "Contract start"        3 x "Installation complete"
3 x "Commissioning"         2 x "Go live"
1 x "Final acceptance"
names in the data that are NOT one of the six: 0
```

**So the data is clean and the customer grid has never been used.** Restoring
its dropdown is a small change: the constant and the option-builder already
exist and are already wired to the other grid.

**The open question for John** is whether the list should stay a hardcoded
constant or become a vocabulary table. The estate already has that pattern four
times over - `contact_roles`, `contact_stances`, `industries`,
`closed_lost_reasons`, each a small table with `id, label, sort_order` and a
GET route. A table is a schema change; the constant is not.

---

## W3: SCOPING KEY CUSTOMER CONTACTS - SMALLER THAN IT LOOKS

### Where the list comes from today

`KeyContacts.tsx` fetches `KC_ROUTES.contacts`, which is `/api/contacts`
**unscoped** - every live contact in the system, 17 of them today.

### The relationship in the data

**A contact's account is `records.parent_record_id`, not `records.account_id`.**
`qualify_contact` sets it. This report's first two passes measured the wrong
column and then a capped page, and both are corrected below rather than quietly
rerun.

| | |
|---|---|
| live contacts | 17, of which **13 carry an account** |
| live opportunities | 18, **all 18 carry an `account_id`** |
| live accounts | 7 |
| `record_contacts` rows | **8,547 exact, all 8,547 walked** |

### What scoping would touch, and it is very little

| | |
|---|---|
| opportunities whose account has at least one contact | **18 of 18** |
| opportunities whose scoped picker would be EMPTY | **0** |
| existing links where the contact **is** in the opportunity's account | **13** |
| existing links where the contact is in a **different** account | **0** |
| existing links where the contact has **no** account | **0** |

**Not one existing row would be invalidated, and no picker would go empty.**

**And the route already exists.** `GET /contacts` has taken an `?account_id=`
query since Round 11 Phase 5, and it filters on `parent_record_id` - the column
that is actually populated. So the client change is to pass the opportunity's
`account_id` to a parameter that is already there and already correct.

The add route already selects the opportunity's `account_id` for its ownership
check and simply does not compare the contact against it, so server-side
enforcement is an added validation rather than a new query.

**The ruling input is narrow:** whether the picker is *filtered* to the account
or merely *defaulted* to it with an escape, and whether the server should
*refuse* an out-of-account contact or just not offer one. The data says either
is safe today.

---

## The layout set: mechanisms, measured

### W2, the Opportunity type card

`ReferencePanel.tsx:223` is a card containing exactly one row:

```jsx
<Card title="Opportunity type" testId="ref-opptype">
  {row('oppType')}
</Card>
```

Terminus Details at `:172` opens with `ro('Terminus Reference')` then six rows.
W2's move is therefore one line each way. **One known consequence:** the R1c
test enumerates the card titles and names `'Opportunity type'`, so it moves
with the card - a re-point, not a weakening.

### W4, the Tax Adjustments card

Owner is `section36.tsx`. The DOM order measured live is:

```
1. "Tax Adjustments"      2. "Withholding Tax %"
3. "GST %"                4. "Gross up disabled"
```

The card's `fields` array is `['deal-whtPct', 'deal-gstPct']` and the gross-up
toggle renders **after both**, so the WHT pair is split by GST. **WHT is already
above GST**; what W4 asks for is the gross-up selector moved up beside it.
Both boxes measure **328px** for a 2-digit integer.

### W5, the installation fields

Measured **in the state that renders them** (per-unit install): **144px at
1440, 46px at 1240**, all left-aligned. The first run reported 0px because the
fixture was a lump-sum deal and the fields were not rendered at all - a hidden
element measures zero and reads exactly like a narrow one.

### W6-W9, the INSTALLATION milestone grid

```
HAS a <thead> with column labels: FALSE
col 1  <input>   143px (1440) / 96px (1240)   left-aligned
col 2  <select>  180px         / 121px        left-aligned
col 3  <input>   143px         / 96px         left-aligned
col 4  <input>   143px         / 96px         left-aligned
```

It is a bare `<table>` with no header row at all, and every column is the same
width regardless of what it holds. **This is exactly walk 4's O5/O6 shape**, and
the prototype's own answer is already in the repository: a four-column grid at
`44px 195px 44px 64px`, gap 4px, with `text-align:right` on the numeric columns.

### W10, the lump sum line

`"Lump sum contractor price, $250,000"` renders as **one text node**,
left-aligned, 704px wide at 1440 and 504px at 1240. The figure is inside the
sentence, so there is no money column for it to align to - W10 needs the line
split into a label and a figure before it can be aligned at all.

### W13, the payment-terms grid, measured in its own state (hybrid)

```
head:  Month 44px | Project milestone 195px | % 44px | USD 64px   all left-aligned
cells: 44px | 195px | 44px | 64px                                 all left-aligned
the hybrid group: grid-template-columns 453px 280px, gap 20px
  panel 1  left 319  right 772  width 453
  panel 2  left 792  right 1072 width 218-280
```

**The dead space is inside panel 1, not between the panels.** The grid uses
44+195+44+64 plus three 4px gaps = **359px of a 453px column**, so 94px sits
empty between the USD column and the hosting panel.

**AND A GAP IN MY OWN WALK-4 WORK:** the prototype gives `%` and `USD`
`text-align:right` in all three of its milestone rows. Walk 4 adopted the
columns and the gap and **not the alignment**, so every number in that grid is
left-aligned today. W13 asks for exactly that correction, and it is a
correction to work I did rather than a new request.

---

## Findings this phase raised that were not in the list

1. **The `milestones.ts` comment is false** - "the SAME COMPONENT with
   different bases" describes two different components. Architecture 9's stale
   claim; costs nothing to fix and will mislead the next reader.
2. **The customer milestone grid has never been used**, in any live
   opportunity. Worth knowing before spending a round on its ergonomics.
3. **My own Phase 0 made three measurement errors**, all caught and corrected
   here rather than reported: a capped 1000-row read quoted as a count; the
   wrong column read for a contact's account; and 0px reported for elements the
   fixture had hidden. Each is recorded because the corrected numbers are the
   ones above.

---

## What is ready to build, and what is not

**Ready on this report, no ruling needed:** W2, W4, W5, W6-W9, W10, W13.
All six are layout with measured mechanisms and no behaviour change.

**STOPPED, awaiting John:**

- **W1** - does not fit by 148px at 1440 and 222px at 1240. Needs a ruling on
  what gives way. **This is a scope change from "a layout tweak".**
- **W12** - the dropdown can be restored from the constant that already exists;
  the question is constant or vocabulary table.
- **W3** - safe to scope today, 0 rows affected; the question is filter versus
  default, and refuse versus not-offer.
