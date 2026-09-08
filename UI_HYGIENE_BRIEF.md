# The UI hygiene round: brief

Governing docs, read before anything: CLAUDE.md, the tms-round-method
skill, and MIGRATION_CLOSE_OUT.md's door-model section. Drafted from
measurement of origin/main at 913554f; re-verify premises against the
tree you are on before writing code. This brief's R-series is its
own; no range is shared with any other document.

## Rulings of record (John, 2026-09-08)

R1. Scope, four items in priority order: (a) the door gap on the
    Commercials deal panel; (b) the Test Bed cost cell missing from
    the React stat strip; (c) a Reference code column on the
    Opportunity list; (d) the eight Structural Terms notes convert
    from visible text to the help-dot hover pattern. All display
    layer; no route, schema or policy changes.
R2. Process rulings promoted into CLAUDE.md this round, one commit,
    superseded reasoning left visible: (i) a commit touching only
    markdown that no gate stage reads may ride on the immediately
    preceding green gate, named as such in the close; (ii) the push
    waits for the gate RESULT to be stated, never runs in parallel
    with a gate on expectation of green — the red-on-origin window
    of 2026-09-08 is the measured argument.
R3. Method unchanged: investigation before drafting, phases stop
    for sign-off, the final-act gate on the exact tree, nothing
    pushes without the word, and the word follows the stated gate
    result.

## Item (a): the door gap, measured so far

The opportunity view receives is-not-mine correctly (the record
door works). The treatment's selectors do not reach the deal
panel's custom controls: the ring-radio structure picker (divs with
click and keyboard handlers) appears in no door selector and is
fully interactive on an unowned record; the button classes are
dimmed but keep pointer events, so section save buttons and the
main save button (which deliberately lives outside the React root)
still click. John confirmed live: the controls respond, the save
appears, and the server refuses the write. Root cause is the
recorded principle that a fix built for the pages that existed at
the time is not a fix for pages built after it — the door's five
rules and fifteen selectors were measured against the surfaces
that existed when it was ruled.

## Phase 0: the door census (read-only)

1. Enumerate every interactive control on the Commercials tab —
   inputs, selects, custom radios, switches, toggles, latches,
   section saves, the external save button, milestone and
   contractor grids, version panel actions. For each: covered by
   the door treatment or not, measured by interaction under
   is-not-mine, not by reading selectors.
2. Sweep the other React surfaces (Account, Contact, Test Bed,
   Reference, approval view) for custom controls outside the
   door's selector set — the ring-radio also renders in stage
   approvals, so the gap may not be one tab's.
3. Formalise the server-refusal proof: an attempted non-owner save
   over HTTP on each write path the tab exposes (record patch,
   version save, version issue, approval request), each refused,
   with the counterfactual (the same call as owner succeeds). If
   ANY non-owner write succeeds, STOP and report — that is a live
   defect, not hygiene, and it changes the round.
4. Keyboard reachability counts as interaction: the door is proven
   by click, Enter and Space per the estate's walk convention.
Stop for sign-off with the census and the proofs.

## Phase 1: the door fix

Extend the door treatment to the full measured control set. Follow
the shipped model: the door decides, presentation communicates.
Where a control is div-based, pointer-events alone is not enough if
it keeps keyboard handlers — the A12 precedent applies (a row the
door refuses drops its tab stop). Buttons that must stay clickable
on unowned records (Back, navigation, the approval view button)
are named explicitly with the reason, not left as accidents.
Calibrate both directions: controls dead under the door, alive
without it, on a real unowned record and an owned one. Live walk
of the Commercials tab on somebody else's record: 0 interactive
write controls, with the count of controls checked emitted by the
walk. Stop for sign-off.

## Phase 2: the three display items

(b) The stat strip: add the Test Bed cost cell to the React
    six-cell strip for converted opportunities, reading the same
    value the Deal Sheet row reads (one source, not a second
    derivation). Retire the dead write into the hidden vanilla
    strip (app.js:7227) and the false "stays OUTSIDE both" comment
    with it, per the two-claims discipline. Non-converted
    opportunities show no cell rather than an empty one — measure
    what the vanilla did before choosing, and record the position.
(c) The Opportunity list: a Reference column, first column,
    matching the Test Bed list's treatment (col-mono, '--' when
    absent). The field is already in the API response; no route
    change.
(d) The Structural Terms notes: the eight visible pg-item-note
    rows convert to the existing help-dot pattern (the "?" with
    title and aria-label, hover and keyboard focus), note text
    carried over unchanged. One field-help pattern across the
    whole deal form afterwards, verified by a sweep that finds
    zero visible note rows and eight help-dots.
Stop for sign-off.

## Phase 3: gate and close

R2's promotions land in CLAUDE.md. Final-act gate on the exact
committed tree; the push follows the stated result per R2(ii).
Revert rehearsed on a branch, byte-identical after. Reconcile by
counting. The close restates carried items and what it does not
cover. Nothing pushes without the word.
