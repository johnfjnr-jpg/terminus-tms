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

**Carried-forward Total Cost criterion: RESOLVED AS FAILED, and the gap
returns to Phase 3's finding.** This phase was asked to re-verify Total
Cost's visibility at 1920 against a real ~950px viewport. Measured after
the build: the header went from 191px to **346px** and Total Cost moved
from y=1054 to **y=1210**, so the shortfall grew from 151px to **306px**.
**The arrangement was not compromised to protect the criterion**, which
was an addition rather than part of this phase's brief. The header was
never the lever: it costs 191px side by side and stacking is inherently
more expensive. Recovering the 306px means the 145px navigation band, the
96px tab row and the 379px input-rate panels, and is **separate,
dedicated scope, not owed by this phase or by any phase that happens to
touch the header next.**

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

---

## Round 8 outcome

All 6 phases built. Assembled from the entries written at the time, not
from memory.

| Phase | Delivered | Beyond the original brief |
|---|---|---|
| 1. Commercials click-to-type | Open edits preserved across an in-app reload: captured before `tbEdits` is reset, restored after `wireTbFieldInputs`, with `orig` re-read from the fresh payload so dirty state is computed against what the server now holds | **The reported symptom was never reproduced.** Under settled conditions every field on both tabs accepted typing on the first click. What was found instead is a real defect on its own terms: `initTestBedDetailPanel` rebuilt all four panels and wiped `tbEdits`, and six call sites re-enter it mid-session, so a field opened during the reload's GET was destroyed - input replaced, focus dropped to `BODY`, typing discarded. Fixed because it is genuinely serious, **not** because it was confirmed to be the screenshot. Proven both ways: reverted, all three probe fields fail; restored, all three survive |
| 2. Spinner arrows | A second blanket rule scoped `#tb-tab-commercials`, mirroring Round 3 Phase 4's `#opp-tab-commercial` precedent | Reported as one panel; it was **nine fields across three panels**, the complete set confirmed by sweeping every tab. Ruled out two wrong fixes explicitly: widening the existing selector (would silently change Opportunity to fix Test Bed) and adding `integer: true` (would force whole-number money). A computed-style probe was caught **proving nothing** - identical readings for the known-good Opportunity tab and the known-bad Test Bed one - and discarded in favour of hover screenshots |
| 3. Itemized cost layout | Hardware, Installation and Hosting side by side in `.ref-cards`; Total Cost and the term line moved above them | The brief describes "panels" but the page has two sets - the input rate cards were already side by side and were never broken; the **itemized breakdown** was the stacked one. Breakdown height 745px → 368px. Total Cost visible at 3440, still short at 1920 and structurally unreachable at 1240×900, where the input panels alone end past the fold |
| 4. Next Stage text | The hint alongside the disabled button removed - markup, logic and style | The brief credits the text to Round 5 Phase 8; that phase added the **button**. The hint came from Round 7 Phase 6, whose brief required a "readable reason", so this phase **reverses half of a decision taken one round earlier** - recorded as deliberate. The distinction survives, because it was never carried by the hint: the button's own label still reads "Final stage" versus a disabled "Next Stage" |
| 5. Notes and Summary | Moved beneath the name, Summary above Notes, widened from a capped 520px (280px at 1240) to the full column - 1180px at 1920 and 3440. 2 notes by default with expand to full history | Built **without compromising the arrangement** to protect the carried Total Cost criterion, which was an addition rather than part of this phase's brief. That criterion **failed and got worse**: header 191px → 346px, Total Cost y=1054 → y=1210, shortfall 151px → 306px. Reported as this phase's own evidence and corrected in both documents, including this entry's own earlier speculation that Phase 5 would recover it |
| 6. Accounts layout | `#view-account-detail` given the `max-width: none` override the other three detail views already had | The panels, the grid and the 280-420px cap were **all already correct**. Account detail was the only detail view still inheriting `.wrap`'s 1240px cap, so its grid measured 1017px at every viewport size and could never fit three 420px cards. Found only by measuring the **container** - the cards themselves reported healthy 420px widths and zero overflow at every width, before and after |

**Cross-cutting, recorded in `DESIGN_PRINCIPLES.md` as it happened:** a new
standing entry naming the repeated shape behind Phases 2 and 6 - a fix
built for the pages that existed at the time is not a fix for the pages
built after it, now at three confirmed instances across Rounds 5, 8 and 8;
the page-density limit, corrected twice to record the real outcome rather
than the hoped-for one; and the header measured at 191px, not the 336px
first logged.

**Carried forward, owed by no phase:** the 306px needed to bring Total
Cost above the fold at 1920. The levers are the 145px navigation band, the
96px tab row and the 379px input-rate panels - **separate, dedicated
scope**. Attaching it to whatever phase happened to be nearby is exactly
how it reached Phase 5 and failed there.
