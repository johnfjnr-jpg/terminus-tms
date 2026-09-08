# The convert atomicity round: brief

Governing docs, read before anything: CLAUDE.md, the tms-round-method
skill (.claude/skills/tms-round-method/), MIGRATION_CLOSE_OUT.md
(carried item 1). This brief was drafted from an investigation of
origin/main at f8a9c48; re-verify its premises by measurement against
the tree you are on before writing any code (the Round 2 Phase 0
model). Line numbers in this brief are navigation aids, not claims.

## Rulings of record (John, 2026-09-08)

1. Scope: POST /test-beds/:id/convert AND its sibling, the contact
   qualification create-opportunity path in src/routes/contacts.js.
   The generic POST /records (which carries its own TODO M2 for this
   fix) is OUT of scope; it gets its own brief.
2. Audit semantics change: inside the new transaction, a failed
   audit_log insert rolls the conversion back. An unauditable
   conversion must not exist. This is a deliberate behaviour change
   from today's fire-and-forget.
3. Phase 0 runs and is dispositioned before any fix is drafted.
   Data changes are proposed, never applied in passing.

4. Phase 0 dispositions, signed off: leave the 62 revision-less
   document records, which are revision-less by design; leave the five
   historical orphans including bed 52bf73df untouched. The six-way
   conversion is KEPT AS EVIDENCE. Nothing to remediate.
5. Phase 1 calibration gains one named proof, from Phase 0 finding F1:
   a constructed fixture with one LIVE and one SOFT-DELETED conversion
   of the same bed, shown counting the live one and excluding the dead
   one, calibrated in both directions. Required because zero live
   conversions exist in the database to exercise the deleted_at rule,
   so P0.3's zero could not distinguish a rule that holds from a rule
   with nothing to hold against.
6. Phase 2 scope gains one named small item: the teardown of
   scripts/round7/walk-tb-2e.mjs stops hard-deleting
   opportunity_details in a way that manufactures the residue shape
   (soft-delete, or delete parent-first), so it cannot false-alarm the
   audit-witness detector that ruling 2 creates.

7. Phase 1 is signed off as delivered. The migration has been applied
   by John via db:push, so Phase 1b runs the four pending
   function-level proofs unchanged: RLS under INVOKER in both
   directions, atomicity at each insert position, the race
   after-proof against the before baseline, and the limit refusal
   mapping to 422. Verify first that public.convert_test_bed and
   public.create_opportunity_from_contact resolve, via
   probe-convert-function.mjs.
8. CARRIED ITEM, for a product ruling outside this round: the
   reference code finding. Soft-deleting a converted Opportunity
   STRANDS the Test Bed's reference code, because
   records_reference_code_record_type_key UNIQUE (reference_code,
   record_type) is not partial on deleted_at. The conversion count
   says the bed is free and the unique index says the code is taken,
   so a second conversion is refused 409 by a message that mentions
   neither conversions nor Test Beds. THE MILESTONE 5 DEPENDENCY IS
   NAMED: 20260815000007 dropped the plain unique on reference_code
   specifically so a Test Bed's code could be carried onto its
   Opportunity, and 20260815000008 restored it as the compound
   (reference_code, record_type). Any fix either makes that index
   partial on deleted_at or stops carrying the code onto a
   replacement conversion, and the second reverses a deliberate
   Milestone 5 decision. Not this round's to take.
9. DEPLOYMENT FINDING, measured during apply. A migration file that
   writes its own supabase_migrations.schema_migrations row COLLIDES
   with the CLI's own bookkeeping insert under db push: 23505, whole
   migration rolled back, deterministic. Hit live on 20260829000007
   and on 20260908000001. Architecture rule 10's "safe under both
   paths" claim is FALSE in the CLI direction: the CLI's insert
   carries no conflict clause, so the file's own `on conflict do
   nothing` protects the file's statement and can do nothing about
   the CLI's.

   Resolved by migration repair for the August file and by removing
   the insert from the convert migration (commit 72418b1).

   CARRIED LEARNING: migration files must not write their own
   schema_migrations rows.

   Census 2026-09-08, comment-stripped and calibrated in both
   directions: eighteen further migrations, 20260830000001 through
   20260903000002, carry the same insert. All were applied by hand
   through the dashboard and are inert, but A REBUILD FROM FILES
   WOULD COLLIDE ON EACH. Recorded under the same learning.

10. 20260829000007 KEEPS ITS LEDGER INSERT ON DISK. Editing an
    applied migration rewrites history, so the file is not touched.
    The nineteen-file rebuild-collision exposure is ONE CARRIED ITEM
    for its own future round: nineteen migration files write their
    own supabase_migrations.schema_migrations row, all applied by
    hand and inert today, and a rebuild from files would collide on
    each. Not this round's, and not to be fixed piecemeal.
11. PHASE 2 SCOPE, confirmed:
    (a) both routes point at their functions, behaviour preserved
        except the two ruled changes (atomicity, and audit failure
        rolling the conversion back);
    (b) the PT422 branch added to sendWriteError AND
        writeErrorStatus, calibrated both ways, because it touches
        the shared error path and that file's own note says a mapper
        that knows a code and a twin that does not is worse than
        neither;
    (c) ruling 6's item: the scripts/round7/walk-tb-2e.mjs teardown
        stops hard-deleting opportunity_details;
    (d) dead code stranded by the switch deleted, with the two
        claims: it is gone, and what replaced it is proven.
    Route tests derive from THIS BRIEF's behaviour statements, never
    from the code being replaced.

Considered and set aside, not to be re-litigated: a partial unique
index on opportunity_details.converted_from_test_bed_id. It would
hard-code a limit of 1 against the data-driven ruling in migration
20260815000006. The limit stays in conversion_criteria.condition.

## The defect, as measured

The convert route performs four writes in sequence with no
transaction: records, record_revisions, opportunity_details,
audit_log (a batch of 2, currently unchecked). A failure after
insert 1 leaves a ghost opportunity with no revision and no details.
A failure after insert 2 leaves a usable-looking opportunity with no
details row: the max-conversions check reads
opportunity_details.converted_from_test_bed_id, so the conversion
does not count and a second is permitted; the close-date PATCH
refuses the owner through the zero-rows path; the probability
trigger UPDATEs zero rows silently at every transition;
test_bed_cost is lost to the Deal Sheet. A failure at insert 4
converts with no audit trail and still returns 201.

Separately: the max-conversions check is read-then-write with no
constraint behind it. Two concurrent converts of one bed both read
zero and both commit, even if each request were internally atomic.

The contact sibling has the same unguarded shape (records, revision,
details, linkContact, audit) minus the conversion counter.

## Phase 0: the residue probe (investigation, read-only, no fixes)

Produce three counts against the live database, every number emitted
by the run, captured to a file and read from the file:

- P0.1 Opportunity records with no opportunity_details row.
- P0.2 Records (any type) with no record_revisions row.
- P0.3 Test Beds with more than one LIVE conversion:
  opportunity_details rows grouped by converted_from_test_bed_id,
  counting only rows whose opportunity record has deleted_at null,
  listing any bed with count > 1.

For every row found: record id, type, created_at, owner, and what
state it is in. Propose a disposition per row; apply nothing. A
measured zero on all three is a finding, stated as such with the
query that could have seen a nonzero. STOP and report for sign-off.

## Phase 1: the migration

One migration creating two plpgsql functions, following the
insert_deal_sheet_version pattern (20260829000002):

- convert_test_bed: SECURITY INVOKER. Takes
  pg_advisory_xact_lock(hashtextextended(bed_id::text, 0)). Inside
  the lock, re-runs the live-conversion count (preserving the
  deleted_at exclusion: soft-deleted opportunities do not count,
  deleting an opportunity frees its bed). Raises a mapped SQLSTATE
  on limit hit so the route keeps its 422; choose a code that cannot
  collide with PT409's meaning and document the mapping. Then all
  four inserts in the function's transaction. Audit failure raises,
  per ruling 2.
- create_opportunity_from_contact: SECURITY INVOKER. records,
  revision, details, the record_contacts link, audit, one
  transaction, same audit ruling. Keep it narrow; two small
  functions, not one generic.

Both functions take computed values as parameters. Reads that are
not correctness-critical (bed payload, criteria row, probability
default, system defaults, reference number issuance) stay in the
routes. The only read that moves inside is the conversion count,
because the lock is what makes it true.

Calibration in both directions per the skill, plus these named
proofs:

- RLS under INVOKER: shown passing for an ordinary caller on all
  four inserts, and shown REFUSING where policy says it must.
  Precedent is not proof.
- Atomicity: an injected failure at each insert position leaves
  zero rows across all touched tables, measured, not asserted.
- The race: two genuinely concurrent converts of one bed produce
  exactly one conversion and one refusal. Note the atomicity-flake
  tell from the close-out (item 6): a concurrency proof that
  finishes implausibly fast did not run.
- The limit refusal maps to the route's 422, not a 500.

STOP and report for sign-off.

## Phase 2: the routes

Point both routes at their functions. Behaviour preserved exactly
except the two ruled changes (atomicity, audit rollback): same
status codes, same error shapes, same response bodies, same
carried fields (account_id, reference_code, test_bed_cost,
customerLead mapping, defaults at creation per Round 41 item 1).
Derive route tests from this brief's behaviour statements, not from
the code being replaced. The dead code the functions strand (the
route-level prior-conversions query, if fully superseded) is
deleted in this phase with the two claims: gone, and what replaced
it proven. STOP and report for sign-off.

## Phase 3: gate and close

Full gate on the exact tree, committed first. Revert rehearsed on a
branch per the skill; record what the rehearsal finds, including
whether the migration is revertible independently of the route
changes (expectation: it is not, once routes call the functions;
measure rather than assume). Reconcile the close against this brief
by counting. Nothing pushes without the word.
