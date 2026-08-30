# Round 41 item 7: the panel set the latches bind to

**REPORT ONLY. No switches exist and none is being built.** The latch rules bind
to this list and the walks exercise it, so the list is ruled before the switches
exist.

---

## Method, both directions

**From the screen**, because the panel set is what a person sees, not what the
markup nests: the Commercials tab was driven to a loaded, priced deal with the
detail panel opened, and every `input`, `select`, `textarea` and `button` inside
each panel was enumerated with its visibility.

**From the source**, for what "missing or overridden" can mean, because that is a
property of the model rather than of the screen: `ZERO_IS_NOT_A_VALUE` (ten keys)
for what can be missing, and `OVERRIDABLE_RATE_KEYS` plus `MARGIN_KEYS` for what
can be overridden.

---

## The finished panel set

| # | panel | latchable | inputs it holds |
|---|---|---|---|
| — | **Top strip** | **NO, rule 2** | none. Five figures. |
| 1 | **Units Required** | yes | 4 unit counts. Plus 6 hidden read-only catalog rate holders. |
| 2 | **Installation** | yes | responsibility select; 4 install rates; 4 line margins; lump sum cost and 5 contractor milestone rows, conditional |
| 3 | **Structural Terms** | yes | target margin, warranty %, contract duration, bid and proposal currency, FX contingency, WHT %, GST %, gross-up toggle |
| 4 | **Deal Sheet Summary** | yes, and **one question below** | the merged panel holds none; `Show detail` opens the detail panel, which holds 7 line margins |
| 5 | **Payment Terms** | yes | structure, invoicing, recovery period (conditional), factoring on/off, factoring rate, factoring term, repayment method, 5 customer milestone rows (conditional) |
| 6 | **Cash flow** | yes | none. A grid and a closing figure. |

**Eight panels, seven latchable**, if the merged panel and its detail count as
one (question 1 below).

---

## What drives the rule 3 signal, per panel

> **Rule 3: a latched-off panel holding any missing or overridden input must be
> signalled on its own latch button.**

**MISSING** means a key in `ZERO_IS_NOT_A_VALUE` that `isSet()` reports unset AND
that `appliesToDeal()` says applies. Both halves, because the applicability work
exists so a field that cannot apply is not reported as a gap.

**OVERRIDDEN** means a blank-is-the-default control carrying a value: the eleven
line margins, where blank prices at target, and the four installation rates,
where blank takes the catalog figure.

| panel | can be MISSING | can be OVERRIDDEN | rule 3 can fire |
|---|---|---|---|
| 1 Units Required | **nothing** | **nothing** | **NO** |
| 2 Installation | `lumpSumCost`, when responsibility is Lump Sum | `inSsExisting`, `inSsNew`, `inAqm`, `inHemir`; margins `inSsEx`, `inSsNew`, `inAqm`, `inHemir` | yes |
| 3 Structural Terms | `targetMargin`, `warrantyPct`, `duration`, `whtPct`, `gstPct`, `fxContingency` | nothing | yes |
| 4 Deal Sheet Summary | nothing in the merged panel | margins `hwSs`, `hwAqm`, `hwHemir`, `hwWarranty`, `hoSs`, `hoAqm`, `hoHemir` | yes, **via the detail panel only** |
| 5 Payment Terms | `recoveryMonths` when structure is two-phase; `factoringRatePct` and `factoringTermMonths` when factoring is on | nothing | yes |
| 6 Cash flow | **nothing** | **nothing** | **NO** |

**Six of the ten missing-capable keys sit in Structural Terms**, which makes it
the panel whose latch signal will fire most often, and the one most worth
latching away once a deal is settled. That is the rule working rather than a
problem.

### Two panels on which rule 3 can never fire

**Units Required and Cash flow.** Named because a latch button that can never
carry a signal is not a defect but it IS a claim: whoever reads the four buttons
will infer that a silent one is clean, and on these two it is silent by
construction.

**Unit counts are deliberately not in `ZERO_IS_NOT_A_VALUE`**, and the Phase 1
report reasoned each one individually: a blank count means nobody has said how
many, a zero means somebody said none, and `hemir` is the sharpest case because
zero is the usual answer. **They can be blank and that is not "missing" by this
model's definition.** Whether a blank unit count should nonetheless raise the
signal is question 3.

---

## Three questions the rules do not settle

### 1. Is the Deal Sheet Summary one panel or two?

The merged panel and the detail panel are **one section with two buttons**:
`Show detail` already opens the detail beside the summary. Adding a latch gives
the section two independent hide mechanisms.

**The rule 3 consequence is concrete:** every override the section can hold is in
the DETAIL panel, which is closed by default. If the section is one latchable
panel, its latch must signal an override that lives inside a sub-panel the user
has not opened. If it is two, `Show detail` and the latch mean overlapping things.

### 2. Rule 2 exempts the top strip. It does not exempt the output

**Latching the Deal Sheet Summary hides the P&L**, leaving the strip's five
figures as the only numbers on screen. That is coherent with rule 2's reasoning,
the strip being the always-visible read, and it is also the single latch most
likely to be pressed by accident and least likely to be noticed.

**Reported rather than decided.** The rules as written make it latchable.

### 3. Does an absent CATALOG rate raise the signal, and where?

Six read-only rate holders sit in Units Required, hidden, carrying the catalog
figures. A product with no current batch prices at zero cost, which
`renderCatalogNotice` already reports **in the detail panel**.

So an absent catalog rate is a missing input to the price that belongs to no
latchable panel's own controls: it is displayed in section 4's detail and held in
section 1. **Under the rules as written it raises no signal anywhere**, and the
notice that does report it is inside a panel that can be latched away.

---

## What this list is for

The four rules as amended, against this set:

1. **On load everything is visible.** Eight panels, all shown, latching is a
   subtraction the user makes.
2. **The top strip is never latchable.** Seven latch buttons.
3. **A latched-off panel holding a missing or overridden input is signalled on
   its own latch button.** Fires on four of the seven; never on Units Required or
   Cash flow; and on Deal Sheet Summary only through its detail sub-panel.
4. **Show/Hide All returns to everything visible.**

**Session only, in memory, gone on reload**, per the brief.
