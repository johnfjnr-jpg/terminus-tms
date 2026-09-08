# The convert atomicity round: close-out

Thirteen rulings, five phases, sixteen commits before this one. The round made
two creation paths atomic, closed a race that had never been measured, and
found four things nobody was looking for.

---

## 1. What the round did

**`POST /test-beds/:id/convert`** performed four writes with no transaction and
an unchecked `audit_log` batch. **`POST /contacts/:id/create-opportunity`**
performed five the same way. Both now call one `SECURITY INVOKER` plpgsql
function and commit all of it or none of it.

**The max-conversions check was read-then-write with no constraint behind it.**
Measured before: **4 of 4 concurrent converts committed against a limit of 1**.
Measured after, through the route: **1 of 4, the other three refused 422.**

**A failed audit insert now rolls the conversion back** (ruling 2), implemented
by construct: neither function has an `EXCEPTION` block, so nothing can commit
part of itself.

### The four things nobody was looking for

1. **The reference code strands on soft delete.** `deleting an opportunity
   frees its bed` is false for any Test Bed carrying a reference code, because
   `records_reference_code_record_type_key` is not partial on `deleted_at`. The
   count says free; the index says taken; the caller gets a 409 mentioning
   neither conversions nor Test Beds. **Carried** (ruling 8).
2. **A self-recording ledger row breaks `db push`.** 23505, deterministic, the
   whole migration rolled back. **Nineteen files carry the pattern.** Carried
   (rulings 9 and 10), and `CLAUDE.md` Architecture rule 10 is corrected.
3. **A probe in this repository manufactured the round's own defect shape.**
   `walk-tb-2e.mjs` hard-deleted `opportunity_details` in its teardown and
   produced eleven of the sixteen residue rows Phase 0 found. Fixed (ruling 6).
4. **No route soft-deletes an Opportunity.** The `deleted_at` exclusion the
   migration must preserve protects a state the application cannot create.

---

## 2. The revert rehearsal

Rehearsed on a branch, not written down as a procedure.

### The routes ARE independently revertible

`git revert bbe0fc5` on `rehearse-revert-routes`. All four touched files come
back **byte-identical** to their pre-switch state at `47b63c9`, a tree that had
already passed 21 of 21:

```
src/routes/test-beds.js         6df161b605c8 == 6df161b605c8   IDENTICAL
src/routes/contacts.js          30d54e1c07c2 == 30d54e1c07c2   IDENTICAL
src/lib/write-errors.js         ff57320cc838 == ff57320cc838   IDENTICAL
scripts/round7/walk-tb-2e.mjs   bd98cecac98f == bd98cecac98f   IDENTICAL
```

Pure suite on the reverted tree: **489/489**. The functions are simply left
present and unused.

**And the revert takes the evidence with it**, which is worth naming: the same
commit holds `probe-routes-preserved.mjs` and the four shared-error-path tests,
so reverting the switch also deletes the probe that proves the switch preserved
behaviour.

### The MIGRATION is NOT independently revertible. Measured, not assumed

This session has no DDL path, so the functions could not be dropped to try it.
The three facts that settle it are each measurable and were each measured:

| | measured |
|---|---|
| what PostgREST answers for a function that is not there | **PGRST202** |
| what the routes' own mapper does with that code | **500**, from both `sendWriteError` and `writeErrorStatus` |
| whether the routes call the function unconditionally | **yes**, one call each, neither inside a conditional |

So reverting the migration alone leaves both routes calling a name that does not
resolve, and **every conversion and every contact-created Opportunity answers
500**. The order is: revert the routes first, or not at all.

### The tree afterwards

```
HEAD                e93ad2fb9b43721785a1393d9e83bce1cddba146
uncommitted files   0
tree hash before    88e11ae7eda14c397b5a98e21c933d11c6f561b2
tree hash after     88e11ae7eda14c397b5a98e21c933d11c6f561b2
BYTE-IDENTICAL      YES
```

---

## 3. The round reconciled by counting

`scripts/convert-atomicity/reconcile-round.mjs`. Every number emitted by the run.

| | |
|---|---|
| numbered rulings in the brief | **13**, no gaps, no duplicates |
| commits in the round | **16** |
| ruling artefacts present | **16/16** - each ruling checked against the thing that exists because of it, not against the sentence recording it |
| carried items with a record in the brief | **3/3** |

### And the phase count does NOT reconcile against the brief, which is the point

```
phase headings in the brief:                  4
phases actually run and signed off:           5   (0, 1, 1b, 2, 3)
of which carry a heading in the brief:        4
reports on disk:                              4
```

**Four headings and four reports reads as agreement and is a coincidence.**
Phase 1b has no heading - it was created by ruling 7 in conversation, which is
the case build-discipline rule 7 names exactly - and Phase 3's report is this
document. Two errors cancelling.

That rule says the brief is not a reliable source for the count and searching it
is worse than not searching it. This round is the eighth consecutive instance,
and the first where the wrong number was **right**.

### One instrument fault inside the reconciliation itself

The ruling counter matched `20260815000006.` in the paragraph after the list and
reported a ruling numbered twenty billion, dying on an invalid array length.
Verification 19 arriving inside the instrument: a counter matching something
outside the category it counts. It failed loudly, which is the good case.

---

## 4. The instruments this round built, and what each is proved by

| instrument | proved by |
|---|---|
| the residue probe (P0.1, P0.2, P0.3) | withholding a real row from each anti-join; a bulk population for the P0.1 join; a duplicated row for the P0.3 threshold |
| the P0.B audit cross-check | withholding one bed from the details side |
| coverage on every paged read | an unpaged select returning 1,000 of 68,194 |
| `probe-conversion-limit` (ruling 5) | both discriminating directions on one constructed fixture; the non-discriminating step labelled as such in the probe |
| `probe-convert-race` | the mutual-overlap assertion, which refuses a verdict without overlap; fired at 905ms, 561ms and 178ms |
| `convert-atomicity.test.mjs` | 19 injections, both directions, on copies the harness cannot write to |
| the PT422 branch | each branch removed from **one mapper at a time** |
| the deleter census | a synthetic deleter, the same text in a comment, and a real file dropping 1 to 0 |
| `probe-convert-function` / `probe-contact-function` | the RLS contrast: RLS on stops at the read, RLS bypassed dies at the first insert |
| **the stale server** | **NOTHING. Ruling 13.** |

### The stale-server catch, recorded as ruling 13 asks

The API server had been started as `node --env-file=.env src/server.js` with
**no `--watch`**. After the route switch it was still serving the pre-switch
code, and **every Phase 2 probe would have measured the code that had just been
replaced** - and passed, because the old routes pass those tests too, except
the race.

It was caught by reading `ps`, not by any instrument. Build discipline 9 names
the hazard for browsers; **nothing in this repository detects it, for browsers
or for probes.** Named here rather than fixed: a check that the running server's
loaded source matches the tree is a real piece of work and belongs in a round
that scopes it.

---

## 5. Carried items

| item | ruling | state |
|---|---|---|
| the reference code strands a bed on soft delete | R8 | **carried**, needs a product ruling; the Milestone 5 dependency is named in the brief |
| nineteen migrations self-record their ledger row | R9, R10 | **carried** as one item for its own round; inert today, a rebuild from files collides on each |
| no route soft-deletes an Opportunity | - | **on the list**, found in Phase 1, out of scope |
| nothing detects a stale dev server | R13 | **on the list**, §4 above |
| P0.1's 585 and P0.2's 62 | R4 | **dispositioned: leave.** Nothing remediated, and no data-change commit exists in the round |

---

## 6. Rules

**Two corrections landed in `CLAUDE.md` in this round**, because the
Documentation section requires a correction to live in the file rather than only
in a brief. **The rule count is 81 before and 81 after**: both are extensions,
and rule 32 says a cited number is an identifier and never a position.

- **Architecture rule 10 is CORRECTED.** "Safe under both paths" is false, and a
  migration file must not write its own ledger row. The superseded reasoning is
  left above the correction so a reader can see a premise failed rather than a
  preference changing.
- **Verification 48 is EXTENDED** with ruling 13: the gate is the final act on
  the final committed tree, nothing else running.

**Two more are PROPOSED, not written, because they are John's to take:**

1. **A detector anchored on the defect it watches stops being calibrated the day
   the defect is fixed.** The deleter census was calibrated on
   `walk-tb-2e.mjs`'s hard delete; ruling 6 removed that line and the
   calibration silently began reporting `FIRED = false`. Nearest existing rule
   is Verification 9, which says inject and watch it fail; it does not say the
   anchor must outlive the fix.
2. **Build discipline 9's stale-server clause reaches probes, not only
   browsers.** Its instance is a browser served new frontend against old
   backend. The same server serves probes, and a probe cannot see the mismatch
   at all.

---

## 7. The exit gate

1. **Both routes are atomic and both are proven.** 28/28 over HTTP on the
   success path with every carried field the brief names; 21/21 and 15/15 at the
   functions; the race closed end to end at the route.
2. **The two ruled behaviour changes are the only behaviour changes.**
   `probe-conversion-limit` reads 17/17 at the route, identical to the
   pre-switch baseline, step for step.
3. **Every ruling has an artefact and every artefact was checked**, 16/16, by
   counting rather than reading.
4. **The revert is rehearsed, not written**, in both directions, with the tree
   proven byte-identical after.
5. **Every finding is recorded whether or not it was the expected answer**, and
   the four that nobody was looking for are in §1.

---

## 8. `CURRENT_STATE.md`, regenerated and its diff reconciled

Its own two-part staleness test passes: the recorded SHA is an ancestor of
`HEAD`, and no tracked configuration source has changed since it.

**Every line of the diff is accounted for by a phase, measured rather than
read:**

| change | accounted for by |
|---|---|
| `116 files in supabase/migrations/` -> **117** | the round's own migration, Phase 1 |
| commits-since-tag **298 -> 316**, delta **18** | 16 commits in this round + 2 between the last generation and the round's first commit. Both counted, not assumed |
| every other line: soft-deleted row counts rising | the fixtures Phases 1b and 2 created and tore down |

**And the line that matters most does not move at all:**

```
before   115 live, 42434 soft deleted, 42549 rows in total.
after    115 live, 43194 soft deleted, 43309 rows in total.
```

**115 live before, 115 live after.** The round created and soft-deleted 760
fixture records and left the live population untouched to the row - and every
per-type live count is identical too: account 4, contact 8 Qualified and 1
Unqualified, opportunity 6/7/8, test_bed 1, unit 3.

**No change is unaccounted for**, which is what `CURRENT_STATE.md` rule 6 asks
and the only reading under which its diff is evidence rather than noise.
