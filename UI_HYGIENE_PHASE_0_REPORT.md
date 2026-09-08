# UI hygiene v2, Phase 0: report

Tree: two opening-act commits plus this. Nothing pushed. Read-only against
product code after the opening acts, as instructed.

## 1. Opening act 1: tearDown scoped by tag

`scripts/fixtures.mjs`. The defect: it swept **every live record owned by the
test account** and justified it in the file, in these words, as *"the complete
set by construction"*. Verification 19's shape exactly, a category name
asserting a property nobody measured. It is the complete set only while
nothing else owns live records, and during the previous round it destroyed
**66 evidence records in one bulk update** while the probe that triggered it
printed `2 soft-deleted`.

**The fix.** Owner becomes the CANDIDATE set; the TAG becomes the SELECTOR,
read from the record's own payload name where every fixture helper already
writes it. With no tag it **refuses** rather than falling back, because the
fallback is the defect. A unit carries no name so it is swept as a CHILD of a
record that does.

**All 60 call sites keep their no-argument form.** Threading a parameter
through 60 files is the multi-site change this estate has been burned by; the
tag is derivable instead. The file supplies the tag, the database supplies the
records, which is the distinction Verification 11 is actually about: its
objection to a file is that a file lists WHICH RECORDS a run meant to create
and goes stale on a retry. A tag is identity, not inventory.

**Calibration, both directions, 4/4:**

    FIRED   THE 66-RECORD DEFECT: sweep by owner again      fail=1  3313ms
    FIRED   the sweep stops matching its own tag            fail=1  2443ms
    FIRED   the no-tag refusal is removed                   fail=1  2831ms
    FIRED   the unnamed-child rule is removed               fail=1  2573ms
    PASS    the reverted tree passes                        fail=0  2971ms
    scripts/fixtures.mjs byte-identical to its snapshot: true

Harness discipline held: byte snapshots keyed by full path, existence asserted
before injecting, byte comparison after every injection, an in-flight marker
so a killed run cannot bless its own damage, and the final reverted run. No
`git checkout` as the restore.

**A departure, with the measurement.** The refusal injection came back
**SILENT** on its first attempt. Verification 51 says confirm the injection
fired before a silence names a missing detector, and it had not: the injection
edited a **different line of the error message** than the test matches, so the
throw still fired with a matching message. Rewritten to remove the guard
itself, it fires. The silence was the matcher, not a gap.

**A design position taken where the brief was silent.** The refusal is only
reachable when no tag can be found, and a fixture file almost always exists,
so `tearDown('')` could never reach it. An explicit empty **array** now means
"sweep nothing" and reaches the refusal. Without that the guard would be
untestable, which is Verification 9's own case.

Evidence: `test:db` **97/97** (94 before, 3 new), `probe-commercial-gate`
**11/11** end to end with its teardown reporting 2.

## 2. Opening act 2: the Verification 8 extension

Checked first whether an existing rule covers it. Verification 8 is the only
rule in the class, so this **extends it in place**. Rule 32: the count is
unchanged at **81** and nothing was reordered.

Superseded and left visible: *"a read whose error is unchecked is at least
visibly empty"*. The correction is that `?? []` turns an unchecked error into
a zero that reads as a measurement, with the audit-anomaly false finding as the
measured argument, and the note that this defeats Verification 12 and 13
specifically because the zero comes from a read that answered.

## 3. The door census

`scripts/ui-hygiene/census-door.mjs`. Two records, always: a census of only
the unowned record would report "everything is locked" against a build that
locks everything including your own deals.

**It does not read selectors.** The estate's existing door probe enumerates
from an allowlist (`input, textarea, select` plus four class names), and the
parked round's own finding is that the ring-radio "appears in no door
selector". An allowlist cannot report what it does not name. Four instruments
are unioned, and every control records which found it:

| | instrument | what it can see |
|---|---|---|
| **L** | `addEventListener` wrapped **before the document exists** | a direct activating handler, including on a bare div |
| **N** | native interactive tag | inputs, buttons, selects, links |
| **R** | ARIA role or focusable tabindex | custom widgets that declare themselves |
| **A** | inline `on*` attribute | handlers written into markup |

Reachability is a **hit test**, not a style read: `elementFromPoint` at the
control's centre, which is what `pointer-events` actually governs.

### The numbers, emitted by the run

    population                                 not mine   mine
    candidates enumerated                      718        464
      navigation (must stay alive)             97         94
      disclosure and help (must stay alive)    43         23
      of which visible write controls          166        79
    REACHABLE write controls                   65         75
      reachable by MOUSE                       19         38
      reachable by KEYBOARD                    46         58

Tabs censused: Reference, Commercials, Assessment, Qualification, Solution
Alignment, Proposal, Evaluation, Negotiating, Closed Won.

**The door is doing something**: mouse reachability falls 38 to 19. **65 write
controls remain reachable on a record the signed-in user does not own.**

### The inventory, by tab

| tab | reachable write controls |
|---|---|
| Assessment | **52** |
| Commercials | 8 |
| Solution Alignment | 5 |
| every other tab | 0 |

### The inventory, grouped

    n  mouse key  pe     how   tab | tag | id or class
     8      8   0  auto   A     Assessment | label | opp-assess-level
    30      0  30  none   NA    Assessment | input | opp-assess-lv-<6 criteria> x5 levels
     6      0   6  none   NA    Assessment | textarea | opp-assess-reason-<6 criteria>
     4      4   0  auto   A     Solution Alignment | div | tb-crit-row--tickable
     5      0   5  auto   R     Commercials | div | ring-radio (3 + 2 active)
     2      0   2  auto   N     Commercials | button | btn-text  (version Restore)
     2      2   0  auto   A     Assessment | span | opp-assess-name--asks
     2      2   0  auto   A     Assessment | div | opp-assess-levels
     2      2   0  auto   A     Assessment | label | opp-assess-level--recorded
     1      1   0  auto   L     Assessment | div | opp-assessment-mount-strip
     1      0   1  auto   R     Assessment | div | opp-assessment-mount-pane-commercial
     1      0   1  none   N     Solution Alignment | button | opp-next-stage-btn
     1      0   1  auto   N     Commercials | button | btn-toggle-detail

## 4. The interaction proof

`scripts/ui-hygiene/probe-door-interaction.mjs`. A stratified sample of seven,
**reloaded between every control** so readings are independent.

    control                            pe    idle  click  key   focus  changed  VERDICT
    structure picker (V1's finding)    auto     3    194   295  yes    no       RESPONDED
    a numeric deal input               none     3      1     3  no     no       inert
    version Restore                    auto     3      4     3  no     no       inert
    a score level radio                none     3     82     3  no     yes      RESPONDED
    a score reason box                 none     3      1    13  no     yes      RESPONDED
    an edit opener                     none     3      1     3  no     no       inert
    Request next stage                 none     2      1     3  no     no       inert

**3 of 7 responded** on a record the user does not own: the ring-radio
structure picker, a score level radio whose **checked state changed**, and a
score reason box whose **value changed**.

**The first version of this probe reported 7 of 7, and it was wrong.** The
page carries a live clock, so the mutation counter rises whether or not
anything is touched. An identical **idle window** is now measured first and
every verdict is judged against that floor of 3. The instrument discriminates:
194 against 1.

### The sharpest finding: the door blocks the input and leaves the label

The score inputs are `pointer-events: none` and **not** mouse-reachable by hit
test. Clicking at one's coordinates still **changed its checked state**,
because the click lands on `label.opp-assess-level`, which is
`pointer-events: auto` and mouse-reachable, and a label activates its input.

Eight labels are mouse-reachable while all thirty inputs are not. **The door
was applied to the control and not to the thing that operates it.**

## 5. Findings about the estate's own instruments

**(a) `probe-readonly-view.mjs`'s wait cannot be satisfied, and it proceeds
anyway.** It waits on
`getElementById('ref-display-name') || getElementById('detail-company')`.
`#ref-display-name` **exists on this view and is permanently empty**, so the
`||` returns the empty element and the condition is never true. It survives
only because the wait is followed by `.catch(() => {})`, which means that probe
measures **without waiting at all**. Recorded, not fixed: it is not this
phase's scope.

**(b) The loading veil clears 1.5 seconds after the data arrives**, and that
invalidates the obvious wait. Measured:

    + 2518ms  class="wrap is-loading is-not-mine"  input visibility=hidden  company="Willowglen"
    + 4026ms  class="wrap is-not-mine"             input visibility=visible company="Willowglen"

A census taken on "the company name is present" measures the veil, and reports
**every control invisible on both records** - a uniform, entirely plausible
zero. That is what my own first three runs did. The wait now requires
`is-loading` to be gone.

**(c) `is-not-mine` is applied correctly**, at +2518ms, and the class half of
the door works. The gap is in what the treatment reaches, not in whether it is
applied.

## 6. What surprised

That the door is not absent but **partial in a specific direction**: it
suppresses the mouse well (38 to 19) and barely touches the keyboard (58 to
46). Forty-six write controls are keyboard-reachable on somebody else's
record, which is the A12 precedent the V1 brief already cites, at a scale
nobody had measured.

And that the largest cluster is **Assessment, not Commercials** - 52 of 65.
Both briefs are written around the Commercials deal panel, which carries 8.

## 7. What this does NOT establish

- **Interaction was proven on 7 controls, not 65.** The other 58 are
  established as *reachable* by hit test and tab-order, which is a weaker
  claim than *responds*.
- **Nothing about the server.** No write was attempted; R2a says prove
  presentation, and enforcement is already proven by the closed rounds.
- **Delegated handlers bound to `document` or `body` tag no element**, so a
  control driven only by delegation is invisible to instrument L. It is still
  caught by N, R or A if it is a native tag, carries a role or tabindex, or has
  an inline `on*`. A control with none of those and only a delegated handler
  would be missed by this census, and I cannot bound how many exist.
- **One record, one viewport (1440x900).** Layout-dependent reachability at
  1240 and 3440 is not measured.
- **The Opportunity list, the stat strip and the notes** (R2b, c, d) are
  untouched. This phase is R2a's census only.
- The gate has not been run on this tree.

## 8. Departures from instruction

- The two untracked briefs (`UI_HYGIENE_BRIEF_V2.md`,
  `TEST_BED_CONVERGENCE_BRIEF.md`) were swept into the opening-act-1 commit by
  `git add -A` rather than committed separately. No content effect; recorded
  because R1 says one commit each.
- The interaction proof is a sample. Running all 65 with a reload each is
  roughly five minutes of browser time and belongs in Phase 1's calibration,
  where the claim is "zero interactive write controls" and every one must be
  exercised.
