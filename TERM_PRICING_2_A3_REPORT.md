# TERM_PRICING_2, A3 report: why the guard missed both overprints (STOP)

**Nothing is built. A3's stop condition fired, and this report is the deliverable for it.** The
structural detector itself is small and is proven below on both defects. **Making it cover every
routed screen is not small**, so per A3 I have stopped before any code, any spec change and any
fix. Parts A1, A2 and B1 to B5 are all unstarted.

Branch `term-pricing-2` from `328da3a` (ls-remote matched). Commits so far: `a1c3e18` (the brief,
verbatim) and this report.

## 1. Why the guard missed both

The ink/overlap guard is the W2 check in `scripts/adjacency/probe-gaps.mjs:897-950`. **It
enumerates by NAME, at two levels.**

1. **One screen, named.** The probe opens one opportunity's Commercials tab and roots every walk at
   `#view-opportunity-detail` (lines 88, 245, 666, 869, 975). It never navigates to Term Pricing,
   so no state of that screen has ever been measured by it.
2. **Six parts, named, on that screen.** W2 compares only these, pairwise:
   `#deal-invoicing-toggle`, the year heading, the schedule slot, `.po-row label`,
   `#deal-factoring-method-toggle`, `#deal-factoring-toggle` (lines 932-938).

   **The OPEX-card overprint (OPEX_RESET Q1) is between the fee table's "Contract Total" column and
   the invoicing column's year rows.** Neither is in the list, so W2 was correct about the six
   things it looks at and blind to the collision. This is Verification 19's second clause exactly:
   a guard enumerating by name fails silently on the unrecorded instance.

**And Term Pricing's own probe never reached the defective state.** `scripts/term-pricing/
probe-screen.mjs` expands Settings only in its `--flow` run, at 1240 (lines 116-121). At 1240 the
Settings grid is ONE column, which is healthy. The two-column state starts at 1600 and was never
measured or photographed.

## 2. The cause of A1 (read, not yet changed)

`frontend/style.css:9314` and `:9320-9321`:

    .tp-settings-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
    @media (max-width: 1599px) { .tp-settings-grid { grid-template-columns: minmax(0, 1fr); } }

- **`minmax(0, 1fr)` lets each track shrink below its content.** The left table holds a 330px
  TERMS input (`.tp-set-wide`), so its content is wider than its half-track, and it paints into the
  right column.
- **The switch to two columns is a VIEWPORT query, not the container width.** A1 asks for the
  measured container. The query also ignores the sidebar's share of the viewport.

## 3. The defect, measured with a STRUCTURAL detector

A scratch probe (not committed) built the detector A3 asks for, with **no named parts**:

- **Ink atoms**: every visible non-blank text node's client rects, plus every visible `input`,
  `select`, `textarea` and `button` box, inside the view's root.
- **An overprint**: two atoms intersecting by more than 1px on both axes, where neither element
  contains the other.

**Term Pricing, Settings expanded, non-admin, every 40px from 1240 to 1920:**

| width | OPEX | CAPEX |
|---|---|---|
| 1240 to 1560 (10 widths) | 0 overlaps (228 to 231 atoms) | 0 overlaps (250 to 254 atoms) |
| 1600 to 1720 | 7 overlaps | 7 overlaps |
| 1760 to 1920 | 9 overlaps | 9 overlaps |

Sample hits at 1600, matching John's screenshot (inputs under the margin block, headers
colliding):

    "Value" x "Short-term margin %"                         37x14
    <input TERMS> x <input ANCHOR_MARGIN.safesight>        72x28
    <input TERMS> x <input SHORT_TERM_MARGIN.safesight>    45x28
    "Costs are read from Base..." x <input PROFIT_STEP>   120x15

**The same detector on the deal form, OPEX** (one fixture, tag `a3q1`, the OPEX_RESET payload):

| width | atoms | overlaps |
|---|---|---|
| 1240 | 893 | **3**: "Contract Total" x "Invoiced fee, monthly", "$1,020,056" x "Year 1", "$111,389" x "Year 2" |
| 1440, 1600, 1920 | 892 to 893 | 0 |

**What this establishes:**

- The structural detector goes **red on both defects**: A1 and the queued OPEX-card overprint.
- It reads **zero on every healthy state measured**: 20 Term Pricing states and 3 deal-form states,
  over 228 to 893 atoms each, with no false positive to exclude.

**What it does NOT establish:**

- Silence on the other eleven routed views. Their sticky headers, dropdowns, badges and modals may
  produce intended overlaps that need a rule.
- Anything about admin Settings. It was measured as the non-admin, so the inputs were disabled.
  The geometry should be the same, but it is unmeasured.

Teardown re-queried from the database: `a3q1` 2 records, 0 live. The same query reaches 206
`adjgap` records, so the zero is not vacuous. The scratch script was deleted, and the tree is
clean.

## 4. Why "every routed screen" is more than a small change

`ALL_VIEWS` (`frontend/app.js:71`) holds 13 routed views, plus `view-auth`.

- **Reached with no record (8):** leads, leads-legacy, contacts, accounts, test-beds,
  opportunities, approvals, term-pricing.
- **Need a fixture record (5):** contact-detail, account-detail, test-bed-detail,
  opportunity-detail (3 tabs: assessment, commercial, reference), opportunity-approval (needs a
  version under approval).
- **States inside those:** OPEX, CAPEX and hybrid; disclosures; Settings expanded; admin and
  non-admin; and, after B4, split WHT on and off.

At A2's 18 widths, that is several hundred captured states. Each new screen needs:

- a fixture built the way the system builds it (Verification 47);
- a navigation and wait-on-real-state (Verification 6 and 7);
- a teardown;
- triage of whatever intended overlaps it has.

The existing guard took 1,337 lines to cover ONE surface. **A structural detector over every view
is a probe of its own, and wiring it as a gate stage is a further decision**, because every
browser probe in this estate is currently unwired.

## 5. Options (John's ruling needed)

| | what | cost | leaves open |
|---|---|---|---|
| **R1 (recommended)** | Land the structural detector as a shared module. Cover **Term Pricing in every A2 state**, and **the deal form's OPEX card** (the two defects A3 names), calibrated red on each before its fix and green after. Queue "every routed screen" as its own round. | small: one module, two call sites | 11 views uncovered, named in the queue |
| R2 | Build the every-routed-screen sweep in this round, before Part B. | a round's worth: fixtures for 5 detail views, state enumeration, triage | Part B waits behind it |
| R3 | Fix A1 only, with the detector on Term Pricing alone, and queue the guard entirely. | smallest | Q1 stays unfixed and unguarded |

**Under R1, a question the brief does not answer:** does fixing the OPEX-card overprint (Q1)
belong in this round? A3 asks only for the guard to be calibrated red on it. Calibrating red
requires the defect present; calibrating green after requires the fix. **My position: fix Q1 in
this round, because a guard calibrated red on a defect left in place is red on main.** It is a
cosmetic-tier change on the deal form, so per Rule 12 it needs your word before push either way.

## 6. Findings recorded, not acted on

1. **Two API server processes:**
   - PID 38155, `--watch`, started 28 Sep, is NOT listening on :3000;
   - PID 58852, started 2 Oct 22:45 with NO `--watch`, owns :3000. It started after the last
     `src/` change on main, so today's measurements read current code.

   **Before any probe of a `src/` change in this round, that server must be restarted**
   (build discipline 9's stale-server clause).
2. **`CLAUDE.md` build discipline 10 carries its "AND THE LIMIT OF THIS RULE" paragraph twice,
   verbatim.** Documentation only; queued.
