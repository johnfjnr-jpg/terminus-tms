# Ruling 15: the live walk

**STOPPED. NOT PUSHED.** One check failed and it is a real defect on the
screen, not an artefact of the walk. Ruling 15 says stop and report, so this
does.

**The defect is not this round's.** It predates the convert work and is a
migration-era regression on the Opportunity view. The convert path itself
behaved correctly at every step.

---

## The walk: 15 of 16

| | step | result |
|---|---|---|
| 0 | the server was started after the last change to `src/` | **PASS** (see §4) |
| 1 | the Test Bed view renders | PASS |
| 2 | the convert trigger is on the screen | PASS |
| 3 | the name box holds what was typed | PASS, real keyboard events |
| 4 | the conversion succeeds and says so | PASS, `"Opportunity created. VIEW IT"` |
| 5 | the screen OFFERS the Opportunity rather than jumping | PASS |
| 6 | the Opportunity name renders | PASS `walk-r15 Converted Deal` |
| 6 | the company, carried from `client_organisation` | PASS `walk-r15 Client Organisation` |
| 6 | the Account, carried from the bed | PASS `walk-r15 Account Ltd` |
| 6 | the reference code, carried unchanged | PASS `TT-SG-AIRPRT-489` |
| **7** | **the Test Bed cost renders** | **FAIL** |
| 8 | the second conversion is refused, in words | PASS |
| 9 | the refusal is the conversion message, not a server error | PASS *"This Test Bed has already been converted to an Opportunity"* |
| 10 | the refusal wrote nothing: still exactly one conversion | PASS |
| 11 | no page errors and no 5xx across the whole walk | PASS, none |
| 12 | teardown leaves nothing live | PASS, 0 |

Fixture built the way the system builds one: an Account, a Test Bed with an
industry and a country so it is issued a reference code, a
`client_organisation`, and `accumulated_cost: 12345.67` set at creation
(`PATCH` refuses that field; creation accepts it).

---

## THE FINDING: the carried Test Bed cost is on nobody's screen

**The value is stored correctly.** `opportunity_details.test_bed_cost =
12345.67` for the walk's conversion, read straight from the database.

**The element exists and holds the right text.** Measured in the browser on the
Opportunity's Reference tab, which is the tab that was active:

```
#detail-testbed-cost   exists: true
                       textContent: "USD 12,345.67"
                       bounding box: 0 x 0
ancestor chain, nearest first:
  #detail-testbed-cost   .stat-value    display block
  (div)                                 display block
  .stats-grid                           display grid
  #ref-vanilla           class="hidden" display NONE   <-- here
  #opp-tab-reference     .detail-tab-panel
  #view-opportunity-detail
```

**The whole four-cell strip is hidden, not just the cost:**

```
detail-probability   "10%"            0 x 0
detail-close-date    "--"             0 x 0
detail-testbed-cost  "USD 12,345.67"  0 x 0
detail-age           "Today"          0 x 0
```

**And the strip that IS visible does not have that cell.** From the screenshot:
the Opportunity shows a six-cell React strip - **Total contract value,
Probability, Weighted amount, Est. close date, Age, Proposal version** - and
**Test bed cost is not among them.**

So the migration replaced a four-cell vanilla strip with a six-cell React one
and **dropped the Test Bed cost.** `app.js:7227` still computes and writes the
value into the hidden node on every load.

**Verification 7 exactly: a change that MOVES something is two claims, and the
second one almost never gets an assertion.** The new strip appeared. Nobody
asserted what the old one had been showing.

**And a comment says the opposite of what is true.** `frontend/index.html`
carries, four lines above the strip:

> *"The stats strip stays OUTSIDE both, because app.js writes it directly
> (#detail-probability and its four siblings) and it is not part of the surface
> being migrated."*

Measured, the strip is **inside `#ref-vanilla`**, which is the element the
migration hides. Architecture rule 9's fourth variant: a sentence typed into
markup is not derived from anything, so nothing can falsify it.

### What I did NOT establish

**Whether the Deal Sheet on the Commercials tab shows the cost.**
`frontend-react/src/deal/rows.ts:98` renders a row labelled *"Test Bed cost,
carried from conversion"*, so the value probably does surface there. **Two
attempts to click through to Commercials failed** - the first read the result in
the same synchronous evaluation as the click and measured the previous frame,
the second and third threw `Node is either not clickable` even after scrolling
it into view, which suggests the marker landed on a control that is not the
visible one.

**So the severity is bounded but not settled.** Either the cost is absent from
the Opportunity entirely, or it is absent from the Reference strip and present
in the Deal Sheet. Both are worth fixing and they are not the same size.

---

## What the walk proves about this round's own work

Everything the round changed behaved correctly through a browser:

- the conversion committed and said so;
- **the second conversion was refused with the conversion message**, in words,
  where a person reads it - not a raw 409, not a 500, not silence;
- the refusal wrote nothing: exactly one conversion row after it;
- the `FROM TEST BED` origin badge renders, so the conversion is surfaced;
- name, company, account and reference code all carried and all render;
- **no page errors and no 5xx anywhere in the walk.**

---

## Two faults in the walk's own instruments, recorded

**The stale-server check fired on a no-op.** The clause promoted into build
discipline 9 an hour earlier stopped the walk: the newest `src/` mtime was
10:27:37 and the server had started at 10:12:39. The cause was the **revert
rehearsal** - checking a branch out and back rewrote those files with
byte-identical content, proven by the tree hash being unchanged at `88e11ae7`.

**mtime cannot tell a content change from a no-op checkout**, and no snapshot of
what the process actually loaded exists. The remedy costs three seconds, so a
conservative proxy is the right design here: it fails towards a restart, never
towards a stale measurement. Content was compared against `bbe0fc5` (identical
on all three files) and the server was restarted anyway.

**A click read in its own evaluation measured the previous frame.** The first
Commercials attempt clicked and asserted inside one `page.evaluate` and reported
the tab had not changed. Verification 6's clause, committed by the person who
had just cited it.

---

## Disposition

**Nothing is pushed.** The finding is recorded and not fixed: it is outside this
round's scope, it is not destroying data, and build-discipline rule 10 puts it
on the list rather than into this round. It is also **not a finding this round
created**, so rule 10's limit does not pull it in.

Two things for the disposition:

1. **Settle the Commercials question first.** It decides whether this is a
   missing cell or a missing value.
2. **The fix is a stats-strip question, not a convert question.** Whatever is
   decided, the carried cost should be visible on a deal that was converted, and
   `app.js:7227` is currently writing it into a hidden node on every load.
