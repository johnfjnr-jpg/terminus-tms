# The enforcement gaps round: brief

Governing docs, read before anything: `CLAUDE.md`, the `tms-round-method`
skill. Drafted 2026-09-14 on `febf32b`; re-verify every premise against the
tree you are on. This brief's R-series is its own.

## THE PATTERN THIS ROUND EXISTS TO CLOSE

**The estate keeps building correct controls and then not enforcing that work
routes through them.**

Three known instances, each the same shape:

1. **`INTERACTION_STANDARDS.md`** - maintained carefully through Round 29,
   then abandoned. The Leads React surfaces never received Sections 4 and 5
   at all: focus trap 0 of 6, dirty-state 1 of 3.
2. **`scripts/check-state-fresh.mjs`** - exists, and is wired to **no gate
   stage**. The `CURRENT_STATE.md` staleness check the method requires at
   every close is enforced by nobody.
3. **`scripts/edit.mjs` and the journal hook** - built at the Round 39 close
   specifically to prevent a commit message describing an edit the file does
   not carry. **Bypassed by ad-hoc heredoc edits, and the fault it was built
   to prevent recurred TWICE in four rounds.**

> **THE CONTROL EXISTS AND WORKS. USING IT IS LEFT TO MEMORY. MEMORY FAILS.**

**Closing the three by hand does not fix the class.** The fourth unenforced
control simply appears later, and is found by tripping over it. **This round
closes the three AND builds the meta-check that catches the class.**

## Rulings of record (John, 2026-09-14)

R1. The three known instances are a STARTING SET, not the population. Phase 0
    finds the others.
R2. **The meta-check is the deliverable.** A gate stage that FAILS when a
    control the estate depends on is not enforced, so a built-but-unrouted
    control goes RED instead of being discovered by accident.
R3. **Scope the meta-check to what is MECHANICALLY CHECKABLE** - whether a
    guard is a gate stage is checkable; whether a document is maintained is
    harder. **Measure what is in scope and be honest about what is not.**
R4. **Calibrate the meta-check THREE WAYS.** It must fail on a deliberately
    unwired control, pass when all known mechanically-checkable controls are
    wired, and **FAIL CLOSED on an indeterminate case**. **A meta-check that
    cannot fail is the exact fault it is built to catch.**
R7. **IT MUST FAIL CLOSED.** If it cannot determine whether a control is
    enforced, it goes RED and demands an explicit answer. **It never passes
    on "could not tell"** - a check that passes when unsure is the
    silent-failure-mode guard the SCANNER WINDOW round just killed, rebuilt
    one level up.

## THE HONEST BOUNDARY, AND WHY IT IS A RULING AND NOT A CAVEAT

**Overclaiming coverage is the `edit.mjs` fault itself.** That guard's comment
says *"a broken edit cannot reach a message describing a change the file does
not carry"* - a property of ROUTED edits, stated as a property of the
repository. The gap between those two sentences is how the fault recurred
twice.

So this round states its own boundary in the same breath as its deliverable:

| the meta-check CAN enforce | it CANNOT enforce |
|---|---|
| is a guard a gate stage - yes/no | is a document maintained |
| did an edit route through the journal - yes/no | was a decision sound |
| is a test named by a suite - yes/no | is a standard still being applied |

**Every control is therefore classified into THREE buckets, not two:**
ENFORCED, REMEMBERED, and **UNENFORCEABLE-BY-GATE (judgment)**. The third is
not a failure to be fixed later; it is the honest edge of the mechanism, and
naming it is what stops this round claiming a "never again" it cannot deliver.

**A meta-check claiming completeness it lacks is the exact fault recurring
one level up.**
R5. **DOGFOOD: route this round's own edits through `scripts/edit.mjs`.** If
    the false-commit-message fault can happen this round, the fix did not
    work.
R6. Method unchanged: phases stop for sign-off, nothing pushes without the
    word.

## Phase 0: measurement

1. **ENUMERATE EVERY CONTROL and classify it ENFORCED or REMEMBERED.** A
   control is anything the process trusts to catch a fault: gate stages,
   hooks, `edit.mjs`, `check-state-fresh`, the conformance gate, the
   unbounded-select scanner, the staleness check, the edit journal. For each:
   **does something FORCE its use, or is it used by habit?**
2. **`edit.mjs` ROUTING - can it be mechanically enforced, or only
   remembered?** A hook flagging a commit that touches files with no journal
   entry is possible and may be noisy, since legitimate edits happen outside
   the tool. **MEASURE THE NOISE: how many recent legitimate commits touched
   un-journaled files?** That number decides whether enforcement is feasible
   or whether amend-before-push is the acknowledged backstop. **Bring the
   answer with the number.**
3. **`check-state-fresh`** - what wiring it into a gate stage takes, and
   **whether it currently passes**. A check that has been unrun may have
   rotted, so run it first.
4. **The `edit.mjs` guard's OVERBROAD CLAIM.** Its comment says *"a broken
   edit cannot reach a message describing a change the file does not carry"* -
   true only of ROUTED edits. Verification 19: a claim asserting a property
   nobody enforces.

Stop for sign-off.

## Phase 1: the fix, and the class fix

- Route edits through `edit.mjs` where enforceable; **correct the overbroad
  claim**; wire `check-state-fresh` into a gate stage.
- **THE META-CHECK.** A gate stage that fails if a control the estate depends
  on is not enforced - a list of guards that must be wired, checked
  structurally. **This is the thing that stops the fourth instance.**
- **Prove it fails on a deliberately unwired control and passes when all
  known controls are wired** (R4).

Stop for sign-off.

## Phase 2: gate and close

Gate with `PUPPETEER_PATH` set and the precondition checked BEFORE launch, F6
quiet. **This round's own edits routed through `edit.mjs`** (R5).
Reconciliation by counting, revert rehearsed with the boundary stated,
`CURRENT_STATE` staleness both halves. **Promotion: the enforcement-gap CLASS**
- a built control that nothing routes through is not a control - checked for
coverage, instance-not-number per the discipline. Nothing pushes without the
word.
