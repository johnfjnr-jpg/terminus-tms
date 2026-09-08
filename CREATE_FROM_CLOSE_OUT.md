# The create-from ownership round: close-out

Closed 2026-09-08 on John's word. `origin/main` verified by `ls-remote` at
**`323e34a6eea3a39deca09e4908169f8eb5bf6814`**, matching local HEAD.

## 1. What the round did

Six create-from paths, ruled owner-only under R5, now require ownership of the
SOURCE record. Four enforced at the route, two inside the `SECURITY INVOKER`
functions by migration `20260908000003`, applied by John via `db push`.

| path | mechanism | rationale under R5 |
|---|---|---|
| `POST /contacts/:id/create-test-bed` | route | CONSUMES the contact's identity |
| `POST /test-beds/:id/customer-documents` | route | CONSUMES the bed's history |
| `POST /test-beds/:id/units/derive` | route | **INJECTS** into the bed |
| `POST /test-beds/:id/complete-document` | route | CONSUMES the bed's history |
| `POST /test-beds/:id/convert` | function | CONSUMES the allowance and the code |
| `POST /contacts/:id/create-opportunity` | function | CONSUMES the contact's identity |

`transition-requests/:id/approvals` is **exempt by name** under R7, and a test
now fails if any sweep guards it.

## 2. THE PUBLISHED CORRECTION

**The Phase 1 report's audit-anomaly finding is false, and the Phase 1b report
correcting it is now published at `323e34a`.**

Phase 1 reported zero `audit_log` rows on the other-owned source records,
against the brief's statement that a non-owner conversion makes the source's
audit history gain a row, and queued it as a carried item. The query selected
`audit_log.created_at`, **which is not a column**. PostgREST returned an error,
`data` came back `null`, and a `?? []` turned the null into an empty array.
The zero was the error, not a measurement.

Measured with the error checked: **18 rows**, including exactly one
`converted_to_opportunity` and one `created_opportunity` - the two Phase 1
landings, recorded on the sources they took from. **The brief was correct
throughout.**

For a period the published record on `origin/main` stated a defect that does
not exist. Both reports are now published, and this close names the
correction so a reader of the earlier one is not left with the false finding.

Verification 8, in my own probe. The lesson worth carrying is narrower than
the existing rule: **an unchecked read is at least visibly empty, unless a
`?? []` dresses the null as a measurement.**

## 3. Evidence teardown, executed as a counted change

Approved by John, scoped to the `cf1b-*` tag. Ids listed before, one result
per id, residue re-queried rather than assumed.

    BEFORE: 78 cf1b-* records, 12 live, 66 already soft-deleted
    open transition requests blocking the delete: 0
    PER-ID RESULT: 12 SOFT-DELETED, 0 failed
    RESIDUE RE-COUNT, re-queried:
      cf1b-* records live anywhere: 0
      soft-deleted this run:        12 of 12
      counters touched:             0

Soft delete only; no `reference_number_counters` row touched.

## 4. PROPOSED, NOT APPLIED: 38 live records the approved change did not cover

`CURRENT_STATE.md` moved from 115 to 153 live records. Reconciled rather than
noted: **all 38 are owned by `ownership-other@terminus-probe.invalid`**, which
is not a person, and none carries the `cf1b-*` tag the approved teardown was
scoped to.

| tag | count | origin |
|---|---|---|
| `sib-r0`, `sib2-r0` … `sib2-r3` | 32 | the sibling surfaces round |
| `cf-r0` | 3 | this round's Phase 0 probe |
| no name in payload | 3 | the `units/derive` units |

**32 of these are the set the sibling round's own close deferred to this
round**, in its words: *"the rest are a counted change proposed for the fix
round's close."* That is now. The remaining 6 are this round's.

**PROPOSED: soft-delete all 38, by owner rather than by tag**, since the tag
is exactly what failed to cover them. Not applied - the word covered the 12.

## 5. FINDING, carried and ruled: `tearDown()` is scoped by owner, not by tag

`scripts/fixtures.mjs:246` enumerates **every live record owned by the test
account**, not the fixtures its caller created:

    .eq('owner_id', TEST_USER_ID).is('deleted_at', null)

Its own comment calls this a "complete set by construction" - a category name
asserting a property nobody measured (Verification 19). It is complete only
while nothing else owns live records.

**Measured: 66 of this round's evidence records were soft-deleted in one bulk
update at a single timestamp**, by a gate probe, while `probe-commercial-gate`
printed `2 soft-deleted`. The estate's method is that data changes are
proposed before applied; this one applies on every gate run, unproposed and
unreported.

**RULED: fixed as the first act of the next session, scoped by tag, and
calibrated both ways.**

## 6. Coverage: 21 of 40, and a disagreement recorded not resolved

`SIBLING_SURFACES_CLOSE_OUT.md` records **18 of 40** write routes exercised as
a non-owner. This round adds three: `customer-documents`, `complete-document`
and `units/derive`. The other three of the six were already in the 18.

**The disagreement, recorded per CLAUDE.md's opening rule rather than resolved
quietly:** that close lists `complete-document` as **proven (R9 last round)**,
while this round's Phase 0 measured it as **new**. Both are defensible and
they are about different things - R9 proved the `document_details` **table** in
both directions; this round exercised the **route** as a non-owner for the
first time. The close's table conflated the two.

Counting routes, which is what the figure claims: **21 of 40, 19 remaining.**

## 7. Evidence

| claim | check | result |
|---|---|---|
| six paths refuse a non-owner | `probe-source-owned.mjs` | **6/6**, ownership-shaped |
| six paths admit the owner | same probe, owner column | **6/6** |
| the migration is what changed the two | same binary before and after the push | 4/6 → **6/6** |
| the allowance is still spent once | `probe-flows-unchanged.mjs` | `PT422`, not ownership-shaped |
| owner flows unchanged | same | **7/7** |
| write-auth flows unchanged | `probe-pricing-approval`, `probe-commercial-gate` | 15/15, 11/11 |
| the guards are where they should be | `create-from-ownership.test.mjs` | 5 tests, in the suite |
| each claim can fail | `calibrate-guards.mjs` | **6/6**, both directions |
| the harness touched no source | sha256 of `src/routes` | unchanged |
| merge gate | `npm run verify` on `323e34a` | **21/21** |

## 8. Revert rehearsal

From an explicit ref, tree hash verified rather than `git status` read:
`a156577e…` before and after, **byte-identical**. The reverted tree carries no
migration file, no test file and zero guards.

**What a file revert cannot undo, measured rather than assumed:**
`convert_test_bed` remains in the database with its guard. A real revert of
this round needs a follow-up migration restoring the prior function bodies.

## 9. Carried items

| item | note |
|---|---|
| **`tearDown()` scoped by owner, not by tag** | RULED: first act of the next session, scoped by tag, calibrated both ways |
| **19 write routes still unexercised as a non-owner** | 21 of 40 now covered |
| **Concurrency on the six paths is untested** | not measured, not claimed |
| **The `complete-document` coverage disagreement** | recorded in §6, not resolved |
| **38 live probe-account records** | proposed in §4, not applied |
| **Unit ownership** | the sibling round's R9, unchanged |
| **The parked UI hygiene round** | still parked, still unblocked |
| **Nineteen migrations carrying a self-recording ledger insert** | the convert round's carried item, unchanged |

## 10. Proposed for the next round's opening, not landed here

No promotion was ruled this round, so nothing was written into `CLAUDE.md`.
One candidate, offered rather than taken:

**An extension to Verification 8** - a null from an unchecked read, passed
through `?? []`, becomes a zero that reads as a measurement. The existing rule
says a read whose error is unchecked is "at least visibly empty"; this round
is the case where it was not, and the false zero reached a signed-off and
published report.

## 11. What this close does NOT cover

- The 19 unexercised routes, and anything about them.
- Concurrency on any of the six paths.
- Whether the migration is revertible in practice; only that the file revert
  is not sufficient, which is measured in §8.
- The 38 residue records, which remain live pending the word.
- Two orphaned `probe-scrollable.mjs` processes from another session, sleeping
  at 0.0% CPU for 58 hours. Not this round's, not killed, flagged only.

---

## 12. R8 executed: the 38 probe-account records, scoped by owner

Ruled by John 2026-09-08 after the close gate. Scoped **by owner**, because
the tag is exactly what failed to cover them.

    owner scope: ownership-other@terminus-probe.invalid
                 ff836462-4bab-4c39-a703-b215eb804102

    BEFORE: 38 live records owned by the probe account
    open transition requests blocking the delete: 0
    PER-ID RESULT: 38 SOFT-DELETED, 0 failed

    RESIDUE RE-COUNT, re-queried rather than assumed:
      live records for the probe account: 0
      soft-deleted this run:              38 of 38

All 38 ids are listed in the run's own output: 32 from the sibling surfaces
round (`sib-r0`, `sib2-r0` … `sib2-r3`), 3 from this round's Phase 0
(`cf-r0`), and 3 `unit` records carrying no name in their payload - the
`units/derive` units, which is why a tag-scoped sweep could never have reached
them.

Soft delete only. **No `reference_number_counters` row is touched, and that is
a structural claim rather than a measurement**: the script issues no write to
that table at all.

**A caution recorded against my own output.** The run printed
`reference_number_counters rows: 1000 (untouched)`. That 1000 is **PostgREST's
default page cap, not a count** - the true figure, asked for as an exact count,
is **3687**. The number was inert here because nothing was written, but it is
precisely the species Verification 17 records (1000 of 8237 rows read, residue
reported as zero), and it appeared in a close-out run by the person who had
just cited that rule.

**Estate-wide reconciliation, which is the real proof the teardown is
complete:**

    LIVE records estate-wide: 115
       109  john@terminustechnologies.io
         6  terminus.walk65@gmail.com

115 live at the start of the day and 115 now, with **no live record owned by
anything other than a real person**. That is Verification 11's residue test in
its proper form, and the estate passes it.

## 13. The round is fully closed

`origin/main` verified at `890da4f337367ccfffb3cd0c435cbef59a5abb23`. Gate
21/21 on that tree. Both approved data changes executed and counted. This
section and §12 are markdown-only and ride that stated green gate under the
promoted rule.

**Two items land in the next session's opening commit, together:**

1. the ruled `tearDown()` fix - scoped by tag, calibrated both ways;
2. R9, the accepted Verification 8 extension - a null from an unchecked read,
   passed through `?? []`, becomes a zero that reads as a measurement.
