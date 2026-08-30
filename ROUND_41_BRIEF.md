# Round 41 build brief: the Commercials screen, finished

**Written 2026-08-30, before any build work, because everything in it had been
decided and none of it was in the repository.**

This file carries **scope, order and the stopping condition**. It deliberately
does not carry the reasoning: judgements and their justification are in
`DESIGN_PRINCIPLES.md`, permanent rules are numbered in `CLAUDE.md`, and
generated facts stay generated. Same split as the tag note, and for the same
reason: a brief is a record of one round, and those two files are what the next
session reads.

---

## Where the content went

| what | where | why |
|---|---|---|
| A default is an initial value, not a fallback | `CLAUDE.md` Architecture 11 | a permanent rule, cited by later rounds |
| The stopping condition | `DESIGN_PRINCIPLES.md` | outlives this round and governs the tag |
| The walk pass criterion | `DESIGN_PRINCIPLES.md` | governs the tag, recorded beside the stopping condition |
| Admin defaults, no backfill, version freeze, validation | `DESIGN_PRINCIPLES.md` | decisions with reasoning |
| Recovery period state table and the sub-12 exposure | `DESIGN_PRINCIPLES.md` | a decision, and the wording matters |
| Refused: the Deal Summary does not move up | `DESIGN_PRINCIPLES.md` | recorded so it does not come back |
| Parked: Opportunities screen items | `DESIGN_PRINCIPLES.md` | not this screen |
| Scope, order, stopping condition | this file | one round's plan |

---

## The stopping condition

**The Commercials screen is done when the three task walks run clean with no
hesitation:** price a new deal from cold; re-price and version; read someone
else's deal without pricing it.

**Not when it looks right. Not when the gate is green.** Recorded in full in
`DESIGN_PRINCIPLES.md`, together with the pass criterion. Round 40 stays
untagged until the walks pass, and Round 41 does not acquire a tag on
completion of its code either.

---

## Order of work

**Items 1 and 2 report and change nothing.** No code until the business rules on
each.

### 1. The hybrid discrepancy. REPORT ONLY.

The business's model is that recovery period applies only to two-phase. The
calculator reads `structure === 'single' ? months : (recoveryMonths || 0)`, so
**hybrid uses it too**. Either the model of the product or the code is wrong, and
it has been sitting in a pricing calculator.

**Deliverable:** the code path, the arithmetic under both readings (recovery
period applied and not applied to hybrid), and a query listing any existing
hybrid deal sheets with the dollar difference each would show under the two
readings. **No ruling on which model is correct. The ruling is the business's,
made on the report.** Existing hybrid deals are test data; the query is for
information, not remediation.

### 2. The numeric input enumeration. REPORT ONLY.

Every numeric input in the module ruled in or out of `ZERO_IS_NOT_A_VALUE`
against the business's test: **is zero a value a person would deliberately enter
for this field?**

**Deliverable:** the answer per input, **including the ones ruled OUT and why**.
The exclusions are the part to be reviewed, because an exclusion is a claim that
zero is meaningful and nobody has checked those.

**Fields carrying defaults are in scope.** A field with a default can still be
cleared, and cleared is what this is about.

### 3. Finding 1 in full

The defaults architecture, the state table, the validation, the version freeze,
all as recorded in `DESIGN_PRINCIPLES.md`. Plus:

**Closing cash position joins the top strip beside achieved margin.** Finance
cost reads `$0` and earns its place less. Finance cost stays in the strip. The
demotion is in weight, not membership. **Layout of the strip is mine.**

The commercial reason, in the business's words: margin and cash recovery are two
different questions, and the screen answers the first loudly and the second in a
footnote.

### 4. The merge: Deal Sheet Summary and Result become one panel

One panel showing the P&L, with **SHOW DETAIL expanding the breakdown inside
that panel** rather than beside it. The Result panel goes.

**Verified duplication:** revenue `$724,302`, total cost `$507,000` and margin
`$217,302` each appear twice, forty rows apart.

**The condition is not negotiable.** The Result block carries lines the summary
does not: PO factoring interest, withholding tax absorbed by Terminus, test bed
cost carried from conversion, invoice reconciliation from revenue, net receipt
after WHT, and the not-recorded disclosures.

> **Enumerate every distinct fact displayed by the two blocks today. Enumerate
> every fact displayed by the merged panel. Name individually any fact that
> disappears, with its reason. Both lists in the report.**
>
> **The census is taken from the code, not from a rendered screen.** Several
> Result lines are conditional: factoring interest, WHT absorbed, test bed cost
> carried. A census of one loaded deal enumerates that deal's facts and can
> pass a merge that drops a fact another deal state would show. Enumerate every
> fact each block can render under any condition, with its condition named.

**Row count proves nothing**, because the merge changes rows deliberately. This
is a fact census, and it is the same instrument as Round 40's control census
applied to a different type of thing, which is `CLAUDE.md` rule 33 used on
purpose rather than learned again.

### 5. Layout

- **Units Required** as a four-row box on the left, integer fields narrowed to
  four figures. **Installation** on the right.
- **Factoring selection** onto the Payment Terms line.
- **Cash flow** below, on the left.

**Measure at 1240 as well as 1920.** The installation text is three paragraphs
and two narrow columns will crowd it.

### 6. The screen-read findings, 3 to 6

- the 1240 invoiced-fee collision, three year figures overlapping
- the 1240 cash flow clipping, cumulative cash position cut mid-number
- **SAVE VERSION sits above SAVE CHANGES**, against the decided save-then-version
  order. The screen should express that order.
- **achieved margin rendered twice**, and the weaker rendering is on the more
  important instance: the top strip carries the same weight and colour as the
  three figures beside it while the Margin and Warranty instance is larger and
  green.

Finding 2, the summary going full-bleed when the detail panel is closed, is
absorbed into item 4: **constrain the summary to the width it has when the panel
is open, and let the panel occupy the space it vacates** rather than the table
stretching into it. The default state currently reads worse than the expanded
one, which inverts the point of the panel.

### 7. The latches. LAST, because the merge changes what the panels are.

**Session only, in memory, gone on reload.** They are a working instrument for
reaching a defensible commercial position, not a display preference, which is
why they are **in scope for the walks** rather than decoration on top.

Four rules:

1. **On load everything is visible.** Latching is a subtraction the user makes
   and never a state they inherit.
2. **The top strip is never latchable.**
3. **A latched-off panel holding any missing or overridden input must be
   signalled on its own latch button.** Panel level, not input-to-number
   tracing: on this screen nearly every input feeds a visible number, so the
   panel-level rule gives the same protection without a dependency map that
   would outlive the feature's session-only scope. Otherwise the screen hides
   the cause of a number it still shows, **which is finding 1 with the user's
   hand on the switch.**
4. **Show/Hide All returns to everything visible**, not to a remembered set.

---

## What worked, recorded as such

From the business's finished-screen read, and worth keeping because a record
that only carries defects misrepresents the work:

five sections, no sub-tabs, one scroll; target margin defaulting into every
detail line; achieved margin visible at zero scroll. **The decided layout is
there.**

---

## Standing constraints for this round

- **Report before building on items 1 and 2.** Both are questions about what is
  true, and one of them is about a pricing calculator.
- **Commit at every phase boundary**, `CLAUDE.md` build discipline 9.
- **Push documentation and rules without asking** when the gate is green,
  build discipline 12. Ask for schema, calculator, or anything a user sees.
- **No tag on completion of code.** The walks are the measure.
