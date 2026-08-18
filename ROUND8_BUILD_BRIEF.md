# Round 8 build brief: Commercials fixes, Notes repositioning, Accounts layout

Source of truth: `PROTOTYPE_SPECIFICATION.md`, `DESIGN_PRINCIPLES.md`,
`INTERACTION_STANDARDS.md`, `ROUND7_BUILD_BRIEF.md`. Read all four before
starting.

Work through phases in order. Stop after each, report real test evidence,
wait for sign-off before starting the next.

---

## Phase 1: Commercials field, can't type without a second click

**Confirmed real bug, via screenshot.** A field on the Commercials tab
shows a focused state (visible highlight/border) but doesn't accept
typed input in that state, a second click is needed before it actually
becomes editable.

Investigate first, report before fixing:

1. Reproduce live, confirm exactly what state the field is actually in
   when it shows the highlight, genuine keyboard focus with the input
   not yet in edit mode, or something else (a focus ring rendering
   independently of the actual click-to-edit toggle state).
2. Check whether this is specific to Commercials' newer fields (Hosting
   Cost Rates, Unit Counts, added in Rounds 5 and 6), or whether it
   exists on the same click-to-edit mechanism elsewhere in the app too.
   Don't assume it's isolated.

**Test evidence required:** whichever the cause, fix it and confirm a
single click on the field both focuses and immediately accepts typed
input, no second click required, on the specific field reported and on
at least one other Commercials field using the same mechanism.

---

## Phase 2: Commercials spinner arrows, investigate the gap

**Confirmed real gap, via screenshot**, contradicting an earlier fix.
Numeric fields on Commercials (at minimum, Hosting Cost Rates) still
show up/down spinner arrows, despite spinner-arrow removal being built
and confirmed elsewhere in this app previously.

Investigate first: was Commercials' Hosting Cost Rates panel, and any
other numeric field added during Rounds 5/6 (Unit Counts, itemized cost
inputs), ever actually covered by the original spinner-removal fix, or
did that fix predate these fields existing and simply never get
reapplied? Same pattern already found once this build (Test Bed's own
Duration field missing Opportunity's equivalent fix in Round 5). Don't
assume broad coverage, check directly.

**Test evidence required:** confirm which specific fields currently
have spinner arrows, fix all of them, not just the one reported, and
confirm via screenshot that no numeric field anywhere on the Commercials
tab shows spinner arrows afterward.

---

## Phase 3: Commercials itemized cost layout

Hardware, Installation, and Hosting cost panels arranged side by side,
not stacked vertically. Find a sensible position for the Total Cost
figure, use judgement on placement, not a literal mockup for this one.

**Test evidence required:** screenshot at the tested widths (1240px,
1920px, 3440px), confirm the three panels sit in a genuine row where
space allows, and confirm reasonable, non-cramped behaviour at the
narrowest width, same wrap-gracefully standard used elsewhere in this
build.

---

## Phase 4: Remove disabled Next Stage explanatory text

"Open the Qualification tab to progress" (or equivalent per-stage
wording), currently shown next to the disabled Next Stage button
(Round 5 Phase 8), removed. The button's own disabled state is
sufficient, no separate explanatory text needed alongside it.

**Test evidence required:** confirm the text no longer renders anywhere
the button appears in its disabled state, and confirm the button itself
is unaffected, still correctly disabled/enabled based on real gate
status.

---

## Phase 5: Test Bed Notes and Summary repositioning

1. Move the Notes field closer to the Test Bed name (left side of the
   layout), with Summary positioned above it.
2. Widen both fields, currently cramped.
3. Notes displays the 2 most recent entries by default, with a way to
   expand and see the full history, confirmed, not a permanent
   truncation, the full record must remain reachable from this view.

**Also an acceptance criterion of this phase, carried forward from Phase
3:** re-verify Total Cost's visibility on the Commercials tab at
1920x1080 against a **real monitor viewport (~950px usable after browser
chrome), not the flat headless 1080 figure**. Phase 3 got it to y=1054,
still ~21px clipped headless and fully below the fold on a real screen,
and identified this header block as the single largest consumer of
vertical space at 336px. If this phase's rework happens to recover
enough, confirm it explicitly; **if it does not, the gap returns to Phase
3's own finding rather than being silently dropped.** Do not assume it
was fixed as an incidental side effect.

**Test evidence required:** screenshot before/after showing the
repositioned, widened layout. Confirm exactly 2 notes show by default
on a Test Bed with more than 2 real notes, confirm expanding reveals
the genuine full history (verified against a direct query, not just
visual count), and confirm collapsing returns to the 2-note default.

---

## Phase 6: Accounts detail, 3-panel horizontal layout

Account Details, Billing Address, and Shipping Address arranged as 3
panels side by side, matching the row-based layout pattern already used
elsewhere in this build (Test Bed and Opportunity's own Reference tabs).

**Test evidence required:** screenshot at the tested widths, confirm
the three panels sit in a row where space allows and degrade gracefully
at narrower widths, same standard as every other multi-panel layout
this build has verified.

---

## Documentation discipline

Same as every prior round: update `DESIGN_PRINCIPLES.md` the moment a
decision in this brief changes during the build. Phase 1 and Phase 2's
investigation findings are worth recording precisely regardless of
outcome, given this build's history of both "genuine regression" and
"never actually covered" turning out to be the answer in different
cases.
