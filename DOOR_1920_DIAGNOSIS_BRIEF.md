# Door at 1920: diagnosis brief

Governing docs: `CLAUDE.md`, the `tms-round-method` skill. Drafted
2026-09-14. **MEASUREMENT FIRST - the scope depends on what it finds.**

**ENFORCEMENT GAPS does NOT close.** Its own work is sound - the bypass
dogfood confirmed, both new stages green, F6 quiet - but a round does not
close on a red gate, and this red is on the highest-stakes stage in the
estate. Its five commits stay LOCAL.

## The finding to resolve

`HTTP readonly-view probe` failed at **1920 only**; 1240 passed in the same
run.

```
width  record     is-not-mine  controls  typeable  closeLost blocked
1240   not mine   true         602       0         true
1920   not mine   FALSE         74       0         false
```

```
FAILED  1920: another user's record does not carry is-not-mine
FAILED  1920: a non-owner can click Mark Closed Lost
FAILED  1920: the reason is not stated on the unowned record
FAILED  1920 not mine: the view never settled, so every reading below
        is of an unrendered page
```

**The fourth line changes what the first three mean.** 74 controls at 1920
against 602 at 1240 is the signature of a page that had not finished
rendering. And **no `src/`, `frontend/` or `frontend-react/` file changed in
ENFORCEMENT GAPS at all**, which argues probe rather than door.

> **BUT THIS STAGE GUARDS NON-OWNER WRITE AUTHORISATION, AND "PROBABLY THE
> PROBE" IS THE EXACT READING THAT SHIPS A SECURITY HOLE. MEASURE, DO NOT
> INFER.**

## Rulings of record (John, 2026-09-14)

R1. **Do NOT retry the gate to see whether it passes.** That destroys the
    flake-versus-defect evidence, which this estate has recorded losing
    before. The captures in `.verify/readonly/` are evidence; read them.
R2. Phase 0 measures and does not conclude. Two outcomes, **both real**:
    - **(a) SETTLE CONDITION STALE** - the view settles given proper time and
      the door IS present once settled. A probe fault. Fix the 1920 settle
      condition, re-gate ENFORCEMENT GAPS, close it.
    - **(b) DOOR GENUINELY ABSENT AT 1920** - it settles and the door still
      is not there. **A real write-authorisation defect at one viewport.
      This OUTRANKS everything: stop, report, its own priority round.** And
      it is a probe finding too - the stage passed before by winning a
      render-timing race rather than deterministically.
R3. Bring the measurement and the outcome for sign-off **before any fix**.
R4. Nothing pushes. ENFORCEMENT GAPS' five commits stay local until its gate
    is green.

## Phase 0: measure

1. **At 1920, does the unowned record's view actually SETTLE given proper
   time?** The probe says it did not. Is that a too-short wait, or does it
   genuinely never settle at that width?
2. **ONCE SETTLED, is the door present at 1920** - `is-not-mine` applied,
   Mark Closed Lost blocked, controls not typeable - as it is at 1240?
   **Measure the settled state, not the unsettled one.**
3. Read the captures already on disk before driving anything new.

Deliverable: the measurement, and outcome (a) or (b), with the evidence for
whichever it is. Stop for sign-off.
