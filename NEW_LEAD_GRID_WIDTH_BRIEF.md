# The New Lead grid width round: brief

Governing docs, read before anything: `CLAUDE.md`, the `tms-round-method`
skill, `INTERACTION_STANDARDS.md`. The panel conformance gate applies.
Drafted 2026-09-13 against `origin/main` at `6d9ae7a`; re-verify every
premise against the tree you are on. This brief's R-series is its own.

## Rulings of record (John, 2026-09-13)

R1. **WIDEN THE MODAL TO NEAR-FULL-WIDTH** (95vw or equivalent), so most or
    all of the 15 columns are visible at once without scrolling on a normal
    screen. Today the modal floats narrow in a wide page.
R2. **A REAL, VISIBLE, DRAGGABLE HORIZONTAL SCROLL BAR** when content still
    overflows - a small window, or 15 columns that do not all fit even at
    95vw. **NOT tab-only navigation.** John must be able to SEE and DRAG a
    scroll bar. Tab-only is the bug.
R3. Method unchanged: Phase 0 then Phase 1, stop for sign-off at each,
    nothing pushes without the word, rulings appended at the phase they
    launch.

## THE HONEST PROBLEM, AND IT IS A VERIFICATION FAULT AS MUCH AS A LAYOUT ONE

Round A (LEADS CARD CLEANUP) R2 claimed to fix this grid - *"scrolls
horizontally at 3500px min-width"* - **and its probe passed.**

John then walked it. The modal is **narrow, floating in a wide page**,
showing only a middle slice of columns: it **starts at MOBILE**, with Name,
Company, Job Title, Industry and Email scrolled off-screen to the LEFT. And
there is **no visible scroll bar** - the only way to reach the hidden columns
is **tabbing through fields**.

> **Round A's probe asserted the content was SCROLLABLE - a property - and
> called it done. It never asked whether the modal was WIDE, or whether a
> scroll bar was VISIBLE AND USABLE, which is the outcome.**

This is the assert-a-property-not-an-outcome fault: Verification 4's clause
that **a CSS mechanism is not a layout outcome**, and build-discipline 3's
that the reassuring verdict is the one that gets the proxy. It is the exact
class the last three rounds have been watching, and the close of Round B
concluded it is **not fully rule-preventable and the walk is the backstop**.
The walk is what found this.

**So the fix must correct BOTH the grid and the verification.** A round that
fixes the layout and leaves the old style of assertion behind has fixed
half of it.

## What the claims ARE

Stated as outcomes, before any number is measured, so no threshold can be
read off the result (Verification 47's remedy):

**(a) NEAR-FULL-WIDTH AND COLUMNS VISIBLE.** At 1920 and 3440 the modal is
near-full-width, and the number of columns **whose full width lies inside
the scroll container's viewport** is most or all of 15. Assert the COUNT of
fully-visible columns. **Not** that a scroll container exists.

**(b) A VISIBLE SCROLL BAR THAT MOVES THE COLUMNS.** When content overflows
- at a narrow width such as 1240, or a deliberately shrunk container - a
horizontal scroll bar is **VISIBLE**, measured by its rendered height rather
than by `overflow-x: auto` appearing in the stylesheet, and **scrolling it
moves the columns**.

**(c) THE FIRST COLUMN IS REACHABLE.** NAME is visible at near-full-width,
or reachable by the visible scroll bar. Today it is off-screen left on open.

**Screenshot every state, at 1240, 1920 and 3440.** Verification 4: Round A's
fault was a property that passed while the screen was wrong, and the
screenshot is the instrument that catches exactly that.

## Phase 0: measure, change nothing

1. **The modal's width against the viewport** at all three widths, and the
   rule that decides it. `.modal-panel` is `width: 90%; max-width: 420px`
   and `.modal-panel-batch` raises the cap to `min(1480px, 96vw)`; the
   consequence at each width is to be measured, not computed here.
2. **Why the scroll bar is not visible.** The candidates are distinct and
   the answer changes the fix: `overflow` hidden somewhere in the chain, a
   scrollbar styled to zero height, a platform OVERLAY scrollbar that has no
   layout height at all, or a container too narrow to trigger one.
   `.modal-panel` carries `::-webkit-scrollbar` rules; `.new-lead-scroll`
   does not. Measure which applies.
3. **Why it opens scrolled.** `NewLeadGrid` resets `scrollTop` on open and
   **not `scrollLeft`**. Whether that is the cause of the mobile-first slice
   is a measurement, not an inference (Verification 26: the clause after
   "so" is a separate claim).
4. **What R1's width change touches.** `.modal-panel` is shared by eleven
   surfaces and `.modal-panel-batch` by one. Establish which rule may move
   and what else reads it, and whether the panel conformance gate governs
   any of it.
Deliverable: the current behaviour of (a), (b) and (c) as numbers, and the
mechanism behind each. Stop for sign-off.

## Phase 1: the fix

R1 and R2 built, and **(a), (b) and (c) proven by live DOM and screenshot at
1240, 1920 and 3440**, including a width narrow enough to force overflow so
the scroll bar is shown present AND working.

**Do not assert "scrollable" and call it done.** Assert columns-visible, and
scrollbar-present-and-moves. Every new assertion is calibrated in both
directions before it counts as evidence. Stop for sign-off.

## After this round

John walks it: near-full-width, most columns visible, and a real scroll bar
he can drag when the window is small.


## Rulings appended at Phase 1 (John, 2026-09-13)

R4. **PROMOTE AT THE CLOSE**, offered in Phase 0 rather than minted there:
    *a measure can be correct, calibrated AND non-vacuous and still be aimed
    at the WRONG AXIS of a multi-dimensional property.* A new shape - not
    the threshold proxy, not attribute-versus-visibility. Check existing
    coverage; mint or extend the nearest. **This is the root cause of Round
    A's failure and belongs recorded.**
R5. **R1's blast radius is fixed by ruling:** `.modal-panel`, shared by
    eleven surfaces, MUST NOT MOVE. Only `.modal-panel-batch`.
R6. **CLAIM (b) IS MEASURED HEADED OR NOT AT ALL.** Headless is blind to
    scrollbars, proven this round in both directions. A headless
    scrollbar-present check would repeat Round A's blindness exactly, and
    is forbidden here rather than merely discouraged.
