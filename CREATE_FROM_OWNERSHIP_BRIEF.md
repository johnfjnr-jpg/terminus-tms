# The create-from ownership round: brief

Governing docs: CLAUDE.md, the tms-round-method skill,
SIBLING_SURFACES_PROBE_BRIEF.md and its close-out,
WRITE_AUTHORIZATION_BRIEF.md. Drafted after the probe round's close;
re-verify premises against the tree you are on. This brief's
R-series is its own.

## Rulings of record (John, 2026-09-08)

R1. Scope: enforce R5 of the probe round — create-from paths
    require ownership of the SOURCE record. The three proven
    instances (convert, create-test-bed, create-opportunity) are
    in scope, plus any further instance of the same shape that
    Phase 0 confirms among the unexercised write routes. The
    shape, not just the three paths, is what closes.
R2. Enforcement follows the estate's settled pattern: the check
    lives where the write executes. For the two INVOKER functions,
    the ownership check goes inside the function, derived from the
    record rather than accepted from the caller (Architecture 12).
    For plain routes, the route asks the ownership question
    directly and refuses with the established ownership-shaped
    refusal; 42501 stays reserved for RLS-raised refusals per the
    write authorization round's one-path rule.
R3. Calibration anchors: the three landed writes of the probe
    round, replayed exactly and REFUSED ownership-shaped, with the
    owner's same calls succeeding. The evidence footprint kept
    under the probe round's R7 (records 69947943, 745cd214,
    ee047aca and the audit rows on the three source records) is
    the positive control; its deletion is proposed at this round's
    close as a counted data change.
R4. Method unchanged: rulings appended at the phase they launch,
    data changes proposed before applied, final-act gate on the
    exact tree, the word follows the stated gate result, nothing
    pushes without it.

## The defect, as ruled

A non-owner can call convert, create-test-bed or create-opportunity
against a source record they can see but do not own. The resulting
record is honestly theirs, so every insert policy passes; what is
taken is the source's: its audit history gains a row, its single
conversion allowance is spent (the owner's own attempt then
refuses), and its reference code transfers permanently. Approvers
endorse, owners execute; consuming an allowance and an identity is
execution. Colleague-initiated conversion, if ever wanted, arrives
as an explicit reassignment or roles feature in its own round.

## Phase 0: the shape sweep (read-only except probes)

1. From the route census's 40, identify every write route with the
   create-from shape: takes a source record id, creates or
   materially changes something, and is reachable by a non-owner
   of that source. The probe round's close itemises the 22
   unexercised routes; Opportunity's own create-from paths are the
   named suspects.
2. Probe each identified instance as a non-owner with an owner
   counterfactual, refusal reason asserted, fixtures built the way
   the system produces the state. Landings are findings recorded
   with ids and kept as evidence; the stop rule applies only to
   any landing OUTSIDE the create-from shape, which would be a
   different defect.
3. Deliverable: the complete list of in-scope paths for Phase 1,
   each with its measured current behaviour.
Stop for sign-off; John rules the final fix list.

## Phase 1: the fix

Ownership checks per R2 on every path John rules in, one commit
per mechanism (function changes may need a migration; route
changes do not). If a migration is needed it carries no
self-recording ledger insert and stops written-and-unapplied for
John's db push, proofs then running as Phase 1b. Calibration in
both directions on every changed path: the R3 replays refused, the
owner succeeding, and the flows that must survive (the owner's own
convert consuming the allowance exactly as before, qualification
by the contact's owner) proven unchanged. Route tests derive from
this brief, not the replaced code. Stop for sign-off.

## Phase 2: gate and close

Final-act gate on the exact committed tree. Revert rehearsed from
an explicit ref with the tree hash verified. Reconcile by
counting. The close proposes the evidence teardown per R3, updates
the non-owner coverage number (routes exercised out of 40), and
states what remains. Nothing pushes without the word, and the word
follows the stated gate result.
