# UI hygiene v2, Phase 1: report

Tree at `31292dd`. Nothing pushed.

## 1. WHAT IS NOT BUILT, AND THE BLOCKER

**THE SESSION IS DEAD AND CANNOT BE RECOVERED FROM THIS SESSION.**

    refresh failed: Invalid Refresh Token: Refresh Token Not Found
    status: 400

Recovery needs `node --env-file=.env scripts/sign-in.js <email> <password>`,
and a password is the one thing an agent session does not hold. This is
Verification 25's corollary arriving for real: the recovery path exists, is
correct, and its prerequisite is exactly what the failure destroyed.

Everything below that needs a browser or the database is therefore stopped,
not deferred by choice:

| item | state |
|---|---|
| **R10's server-side write probe** | **NOT BUILT.** Not started. It needs a real non-owner JWT, which needs a live session |
| The interaction proof's idle fix | **COMMITTED BUT UNVERIFIED.** It has never run to completion |
| **R9's gate stage** | **NOT LANDED.** Its condition is stable AND enumeration repaired, and the widget fix has not been calibrated both ways |
| The widget fix's injection calibration | **NOT RUN.** One direction measured, the falsifying direction not |

**R10 was cleared to run and did not run.** The clearance arrived, the
constraints were recorded, and the session died before the probe was written.
It is the first item of the next phase, unstarted.

## 2. R8, and the layered sequence, as measured

Three defects in `probe-readonly-view.mjs`, and the order matters because the
first reading was correct and still could not see the third.

**Defect one: the wait could not be satisfied.**
`getElementById('ref-display-name') || getElementById('detail-company')`
returns the first element that EXISTS, not the first with text.
`#ref-display-name` is present, visible, in a tab that is not hidden, and was
measured **empty for a continuous 20 seconds** on the unowned record.

**Defect two: the `.catch(() => {})` swallowed the timeout.** My Phase 0 report
said this meant it measured "without waiting at all", and **that was wrong**.
It waited the full 25s on all six combinations, about 150s of a 173s run, and
measured a settled page **by accident**.

**Defect three: the enumeration is blind to non-input widgets. Refuted by the
baseline, convicted after the treatment, and both readings stand.**

- **The baseline could not have seen it.** It reported `152 typeable` and named
  `opp-assess-lv-assessCommBudgetConfirmed-1` first, agreeing with the census.
  On that evidence the enumeration was reaching the controls that mattered, and
  reporting a false pass was not available to it. **Declining to name a third
  defect there was correct on the evidence at the time.**
- **The treatment unmasked it.** With the input-shaped findings gone the probe
  said `0 typeable, PASS` while the census said **28 still reachable** and the
  interaction proof said the ring-radio **still RESPONDED**. The probe's
  `controls` set is `input, textarea, select` plus four class names; a
  `div.ring-radio` is in none of them.
- **This is Verification 18's shape**: one green reading with more than one
  cause, where fixing the first is what makes the second visible.

Defects one and two are fixed. **Defect three is fixed in the PRODUCT and not
in the PROBE**: `app.js` now neutralises widgets, so the probe's blindness no
longer hides a live gap, but its enumeration is still an allowlist.

## 3. The treatment

**A one-shot sweep, re-run.** `applyReadOnlyControls` ran inside a render and
covered what existed at that instant:

    +3540ms  is-loading clears   144 controls    0 typeable   swept, correct
    +4045ms  later content       296 controls  152 typeable   never swept

**116 of the 152 were vanilla and 36 were React.** Calling this a React problem
would have fixed a third of it. The CSS half reaches late content for free,
because descendant CSS does not care when a node arrived; the JS half is what
runs once.

A `MutationObserver`, gated on added **element** nodes and coalesced to one
sweep per frame, re-applies it. **A disabled input closes both R6 gaps at
once**: a label does not activate a disabled input, and a disabled control
leaves the tab order. No new control was named to achieve it.

**Widgets that are not control elements.** 28 survivors, none an input. Found
now by what they ARE - an interactive role, membership of the tab order, or an
inline handler - minus the existing navigation and decision exceptions, reusing
`is-inert-action` which already carries the CSS. The prior tabindex is recorded
in `data-door-ti` so the restore cannot invent one.

## 4. Evidence, and what each line does NOT prove

| claim | check | result |
|---|---|---|
| inputs closed on an unowned record | `probe-readonly-view` | 296 controls, **152 to 0 typeable**, PASS both widths |
| the door does not over-reach | same, own record | **190/190 typeable**, unchanged |
| an approver can still decide | same, approver record | **2/2 usable** |
| Mark Closed Lost blocked | same | false to **true** |
| reachable write controls | census, independent enumeration | **65 to 4**, mouse **19 to 0** |
| controls do not respond | interaction proof | **0 of 7**, was 3 of 7 |

**THE PROBE'S PASS PROVES INPUTS CLOSED, NOT THE DOOR CLOSED.** Its
enumeration cannot see a `div` with a handler, so `296/0 PASS` is silent about
exactly the class of control that survived the first treatment. The census's
65 to 4 and the interaction proof's 0 of 7 carry that half, and they are
separate instruments with separate blind spots rather than confirmation.

**The remaining 4** are keyboard-reachable, mouse 0. They are not proven inert;
they are proven unreachable by mouse and reachable by tab.

## 5. Corrections to my own work

- **"Measures without waiting at all"** (Phase 0) was wrong. It waits the full
  timeout. Smaller defect, different shape.
- **"A mutation storm caused by my observer"** was wrong. Measured directly,
  the door observer costs **one class mutation per three seconds**, and an
  unowned record idles at the same rate as an owned one (4 vs 3 mutations in
  3000ms). The floor rose because the interaction probe samples its idle window
  moments after a tab click, catching the render tail. **The instrument was at
  fault, not the change.**
- That correction has teeth: at idle 1025 the verdict rule demanded **4100**
  mutations where a live control had scored **1364**, so the mutation half of
  the interaction proof was dead and its verdicts rested on the state signals
  alone. Those signals are sound, which is why `0 of 7` still stands, but it
  stands on three legs rather than four.
- **A timeout read as a product defect** was the environment: the session had
  expired two minutes before that run. Verification 48, caught by checking
  before opening the failure.

## 6. What this phase does NOT establish

- **Nothing about the server.** No write was attempted. R10 is unbuilt, so the
  claim "a non-owner write is rejected" remains argued from the closed security
  rounds and unproven for this phase.
- The widget fix has **one direction only**. Nothing has been shown failing
  when it is removed.
- The interaction proof's repaired idle window has never executed.
- One viewport for the census (1440x900); the probe covers 1240 and 1920.
- R2b, c and d are untouched.
- The gate has not been run.

## 7. Recovery, and what it needs from John

    node --env-file=.env scripts/sign-in.js <email> <password>

Every stopped item resumes immediately after that. Nothing else is blocked.
