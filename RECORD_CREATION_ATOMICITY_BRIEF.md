# The record creation atomicity round: brief

Governing docs, read before anything: CLAUDE.md, the tms-round-method
skill, CONVERT_ATOMICITY_BRIEF.md (the pattern this round replicates)
and its close-out. Drafted from measurement of origin/main at c2bf261;
re-verify premises against the tree you are on before writing code.
Ruling numbers in this brief are its own R-series, independent of the
convert brief's; the two documents never share a range.

## Rulings of record (John, 2026-09-08)

R1. Scope: POST /records in src/routes/records.js, the third and
    last non-atomic creation path, carrying its own TODO M2 naming
    this exact fix. Nothing else. The two paths fixed by the convert
    round are settled ground.
R2. Audit semantics follow the convert round's ruling: inside the
    new transaction, a failed audit_log insert rolls the creation
    back. An unauditable record must not exist.
R3. Gate discipline addition, promoted from the convert round's
    close: a commit touching only markdown that no gate stage reads
    may ride on the immediately preceding green gate, named as such
    in the close. Everything else gets the final-act gate on the
    exact tree. Record this in CLAUDE.md's gate rules in its own
    commit during Phase 3.
R4. Product rulings of record, recorded here so the repo carries
    them; none is this round's scope, each is queued as its own
    future item:
    a. Reference code on soft delete: ruled NO release. A deleted
       Opportunity keeps its code forever; Milestone 5's carry
       stands. Residual consequence, recorded: if Opportunity
       soft-deletion is ever built, the convert path's "bed is
       free" count and the unique index will disagree (count says
       free, retry answers 409), and the refusal copy must be made
       honest in that round. Unreachable today; no route
       soft-deletes an Opportunity.
    b. Must-differ on a score reason: ruled IN as a product
       decision. When a scorer changes a level, the reasoning text
       must change. The Round 7 Phase 1b implementation, stripped
       in 2e as a behaviour change inside a swap, returns as its
       own small round.
    c. Unqualified to Parked: ruled REACHABLE. The stage
       configuration is corrected in its own small round so the
       transition is satisfiable, at which point the existing
       stage_gate_rules row (followUpDate) becomes live and must be
       proven to gate it.
R5. Method unchanged: investigation before drafting, phases stop
    for sign-off, data changes proposed before applied, nothing
    pushes without the word.

R6. SUPERSEDES R1. The round's scope is re-ruled from FIX to
    RETIRE, on Phase 0's measurement: POST /records and GET
    /records are both DELETED. Zero callers across the estate, two
    uses ever - both smoke tests, both hard-deleted - and a
    validation bypass with no utility. THE ATOMICITY CLASS IS
    CLOSED BY DELETION: no migration is written, and the TODO M2
    naming the fix dies with the route.

    R1's reasoning is left standing above rather than edited, per
    Verification 29: a premise failed and the decision was
    RE-TAKEN, not re-weighed, and a later reader should be able to
    tell which happened. R1 assumed the path was worth making
    atomic because it was a creation path. Phase 0 measured that
    nothing creates through it.
R7. Recorded for the future, and deliberately not built now: if a
    generic creation path is ever genuinely needed, it is built NEW
    at that time - atomic from birth via a SECURITY INVOKER
    function, and carrying a record_type allowlist so it cannot be
    the bypass this one was. The convert round's convert_test_bed
    and create_opportunity_from_contact are the precedent for its
    shape. NOTHING IS BUILT SPECULATIVELY NOW.

## The defect, as measured at c2bf261

POST /records performs three writes with no transaction: records,
record_revisions (revision 1, always), audit_log (unchecked, fire
and forget, 201 regardless). A failure after insert 1 leaves a
record with no revision. A failure at insert 3 creates silently
without a trail. The route accepts any record_type string and is
the generic creation path; which types actually flow through it is
not established and is Phase 0's first question.

## Phase 0: the census (read-only, no fixes)

1. Callers: every invocation of POST /records across the estate,
   comment-stripped — frontend, React tree, scripts, tests. For
   each: the record_type it sends, and whether it relies on the
   response shape.
2. Types: which record types the live database shows as created
   with a revision-number-1 row versus without, so the function
   preserves the measured semantics, not assumed ones. The document
   type's no-revision-by-design finding from the convert round's
   Phase 0 (F3) is the known case: establish whether documents ever
   arrive through THIS route.
3. Invariants: whether any cross-request invariant exists on this
   path (anything a concurrent double-submit could corrupt). The
   convert round needed an advisory lock because a count had to be
   true; if nothing here has that shape, the function needs no
   lock, and the position is taken by measurement, not by copying
   the convert function's shape.
4. Residue: the convert round's Phase 0 already measured and John
   dispositioned the estate-wide counts (P0.1, P0.2: leave). Only
   report anything NEW attributable to this route since c2bf261.
Stop for sign-off.

## Phase 1: the migration

One migration, one function, create_record: SECURITY INVOKER, the
three inserts in one transaction, audit failure raises per R2. No
self-recording schema_migrations insert (Architecture 10 as
corrected). Advisory lock only if Phase 0 measured an invariant
needing one; otherwise its absence is a documented position.
Parameters carry computed values; identity fields (owner_id,
created_by, actor_id) derive from auth.uid() inside the function,
never accepted from the caller, per the convert functions'
precedent.

Calibration in both directions per the skill, reusing the convert
round's instruments where they fit:
- RLS under INVOKER by the contrast construction (publishable key
  versus service key), both directions.
- Atomicity by injection at every reachable failure position;
  unreachable positions covered by the structural no-EXCEPTION
  claim, each named with its reason.
- Response parity: the function's return feeds the same 201 body
  the route sends today, proven against a captured baseline.
Migration applied by John via db push between Phase 1 and Phase 1b
if the sandbox cannot apply it; function-level proofs then run
unchanged as Phase 1b. Stop for sign-off at each.

## Phase 2: the route

Point POST /records at the function. Behaviour preserved exactly
except the ruled audit rollback: same validation, same 400, same
error mapping through sendWriteError (which now knows PT422 and
PT404), same 201 body. Tests derive from this brief's behaviour
statements and Phase 0's caller census, not from the replaced code.
Dead code stranded by the switch deleted with the two claims. Stop
for sign-off.

## Phase 3: gate and close

Final-act gate on the exact committed tree, R3 applying to any
docs-only trailing commit. Revert rehearsed on a branch, tree
byte-identical after, the migration's revertibility measured not
assumed. Reconcile by counting. Close-out states carried items and
what the close does not cover. Nothing pushes without the word.
