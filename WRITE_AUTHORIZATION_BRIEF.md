# The write authorization round: brief

Governing docs, read before anything: CLAUDE.md, the tms-round-method
skill, UI_HYGIENE_BRIEF.md (whose Phase 0 stop condition created this
round). Drafted from measurement of origin/main at 913554f plus the
live probe results of 2026-09-08; re-verify premises against the tree
you are on. This brief's R-series is its own.

## Rulings of record (John, 2026-09-08)

R1. The UI hygiene round is PARKED, its brief left in the repo
    unexecuted, its stop condition having fired: a non-owner write
    succeeded. This round supersedes it. The cosmetic items and the
    door presentation work resume only after this round closes,
    because what the door must communicate depends on what the
    server actually enforces.
R2. The evidence row — version 5f1517b2 (V0.2, draft) on record
    29e98c46, created by john+test against walk65's opportunity —
    is KEPT UNTOUCHED through the round as the real-world positive
    control. The fixed policy must be shown refusing exactly this
    write. Its deletion is proposed at the close as a data change
    for John's ruling, never applied in passing.
R3. Enforcement lives at the database: RLS is the boundary, per the
    estate's own recorded principle. Route-level 403s are added for
    the readable refusal, matching the proven PATCH ownership
    pattern. Presentation communicates; it never enforces.
R4. The two process promotions owed to CLAUDE.md (markdown-only
    commits may ride the preceding green gate, named in the close;
    the push waits for the stated gate result) land in THIS round's
    close, one commit, superseded reasoning visible. They do not
    wait for the parked round.
R5. Method unchanged: phases stop for sign-off, data changes
    proposed before applied, final-act gate on the exact tree, the
    word follows the stated gate result, nothing pushes without it.

## The finding, as measured

POST /opportunities/:id/deal-sheet-versions answers 201 to a
non-owner. The insert policy is identity-shaped (auth.uid() =
created_by): it verifies you sign your own work, and never asks
whether the record is yours. The route adds no ownership check. In
the same run, PATCH /opportunities/:id correctly answers 403, which
is the pattern the fix follows. Wider, measured in source and
unproven live: the draft-update policy (auth.uid() is not null and
status = 'draft') lets any authenticated user update any draft
version, and issuing a version is implemented as exactly such an
update. The policy's own comment says the insert shape is shared
with approvals and audit_log, so the class may be a pattern.

## Phase 0: the census and the entitlement map (read-only except probes)

1. Every write policy in the schema (insert, update, delete, and
   any definer function that writes), classified by shape:
   ownership-scoped, identity-scoped, gate-scoped, open. From the
   migrations as authoritative source, cross-checked against the
   live database where readable.
2. Every write route, classified by what stands between a
   non-owner and the write: route check, RLS shape, workflow gate,
   or nothing. The convert round's two INVOKER functions are in
   scope as write paths.
3. Live proofs for the paths the stopped round left unproven:
   version ISSUE as a non-owner (construct a fixture that passes
   the pre-issue gates), approval REQUEST as a non-owner on a
   record that is genuinely ready (so the ownership question is
   reached, not masked by the 409 workflow gate). Any further
   probe writes that land are recorded with ids and kept as
   evidence under R2's rule, listed for disposition at the close.
4. The deliverable: an ENTITLEMENT MAP — for every writable table,
   who the business rules say may write it (owner only; owner plus
   approvers; any authenticated actor signing their own row;
   system function only), with the current policy beside it and a
   MATCH or GAP verdict. Approvals and audit are the named cases
   where identity-scoped is likely correct; the map must say so
   explicitly rather than assume owner-only everywhere.
Stop for sign-off. John rules on the map before any policy is
reshaped; the map is the product decision, the policies are its
implementation.

## Phase 1: the migration

One migration reshaping the GAP policies to match the ruled map,
plus route-level 403s per R3 on the routes whose tables changed.
No self-recording ledger insert. Calibration in both directions on
every changed policy, including: the evidence row's exact write
replayed and REFUSED; the owner's same write succeeding; every
legitimate flow the map preserves (approval by a non-owner
approver, audit self-signing) proven still working. The full
Phase 0 probe suite re-run reading all-refused where the map says
refused. Applied by John via db push if the sandbox cannot; proofs
then run as Phase 1b. Stop for sign-off at each.

## Phase 2: gate and close

Final-act gate on the exact tree. Revert rehearsed on a branch;
whether the policy migration is independently revertible is
measured, not assumed. Reconcile by counting. The close proposes
disposition of the evidence rows (R2), lands R4's promotions in
CLAUDE.md, restates carried items including the parked hygiene
round, and states what it does not cover. Nothing pushes without
the word, and the word follows the stated gate result.
