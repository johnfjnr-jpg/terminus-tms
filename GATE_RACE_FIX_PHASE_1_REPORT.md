# Gate race fix: Phase 1 report

Built and proven 2026-09-13.

## The fix

**One shared predicate**, `scripts/lib/fixture-record-types.mjs`, imported
by both files. `gates.test.mjs` no longer OWNS the convention - it builds
its `TYPE` from the shared prefix. **That is the Verification 20 fault
closed at root rather than patched**: the convention used to be spelled in
`gates.test.mjs:33` and nowhere else, which is precisely why the other file
never knew it existed.

**Applied at the LOADER**, so all seven invariants reading `rules` inherit
it and INVARIANT 4 is fixed by the same change, along with the three that
were not exploitable today. Build-discipline 8, and R6.

**INVARIANT 5, as asked:** it does **NOT** filter. It is safe today only
because `Senior` happens to be a real track - exactly the
"not-exploitable-today" case R6 rules out - so it now inherits the loader
filter with the rest.

**One departure, stated plainly.** `recs`, the unfiltered live-records load,
is filtered too. `verify-harness` writes `approvals`, `record_contacts`,
`records` and `stage_gate_rules`; this file reads `records` unfiltered. No
invariant is exploitable through it by today's fixtures, which by R6 is not
a reason to leave it. Same predicate, one line.

## Both halves of R3

### Race closed

The same reproduction script, unchanged, that reported `REPRODUCED`:

```
INVARIANT 2: false -> false  not reproduced
INVARIANT 4: false -> false  not reproduced
```

### AND the invariant not blinded - which is the half that matters

A probe that cannot reproduce might be fixed or might be broken, and the two
read identically.

```
A. SENSITIVITY: a REAL orphan on the CONFIGURED type test_bed
   clean: INVARIANT 2 quiet                      PASS
   "Qualification -> A Stage That Does Not Exist"
   REAL orphan present: INVARIANT 2 RED          PASS
   cleanup re-queried by id, 0 remain
   orphan removed: quiet again                   PASS

B. THE GUARD ON THE GUARD: widen the prefix to "test",
   which swallows the configured type test_bed
   the COVERAGE ASSERTION goes RED               PASS
   restored, byte-identical to the snapshot
   reverted: everything quiet                    PASS
```

**B is what stops this fix becoming the failure it was built to avoid.** The
coverage assertion derives the configured types from the database, so a new
record type is covered the day it is configured - there is no list to
forget.

## The 20 runs, and what they are worth

```
0 of 20 runs had INVARIANT 2 red (0%)
0 runs had a failure of any kind
20 per-run captures written to disk
```

**Not offered as the proof.** Phase 0 measured the natural rate at 0 of 8,
so twenty green runs is consistent with the bug still being present
(`0.95^20 = 0.36` at a 5% rate). The proof is the forced reproduction being
unable to fire. The 20 runs are here because they would have caught a fix
that broke something outright, and that is all they establish.

**They did establish one thing the earlier sweep could not**: every run was
captured to its own file, so a failure would have been identifiable rather
than a boolean. Phase 0's rate script discarded its output and lost run 2's
cause permanently.

## A DEFECT THIS CHANGE CREATED, AND IT BLINDED A SECURITY-SHAPED GUARD

**The commit was refused by the pre-commit hook**, on a suite unrelated to
anything this round is about:

```
✖ the allowlist does not drift from the tree: no stale entries
  + 'scripts/tests/config-invariants.test.mjs::records::1'
  + 'scripts/tests/config-invariants.test.mjs::stage_gate_rules::5'
```

**The scanner had stopped SEEING two unbounded selects**, which reads as
"two fewer unbounded selects" and is the opposite: the guard went blind.

**The cause, measured rather than inferred.** `unbounded-selects.mjs`
matches a chain with `[\s\S]{0,400}?` and a lookahead for the next line
beginning `const|let|var|if|for|return|await|}`. **My explanatory comments,
placed BELOW the selects, pushed that keyword past the 400-character
window**: 653 characters for `records`, 882 for `stage_gate_rules`. Past the
cap the whole chain fails to match, so the select is not counted at all.

> **A COMMENT CAN BLIND A GUARD, and a long careful comment blinds it
> better than a short careless one.**

Fixed by moving both comments ABOVE their selects and introducing a `const`
that terminates the lookahead early. The scanner now finds **16 of 16 with
zero stale entries**, the same population it saw before this round touched
the file.

**Build-discipline 10's limit: a defect the change created is part of the
change.** It is recorded rather than quietly repaired because the mechanism
generalises - every file in this estate that carries a heavily-commented
query is one comment away from the same blindness, and nothing detects it
except the allowlist happening to drift.

**Both proofs were re-run on the restructured code**, not inherited from
before it: the forced reproduction still cannot fire, and both calibration
halves still pass.

## What this does NOT establish

- **Whether INVARIANT 8 was exposed.** The `contact_role_linked` shape was
  never tested against it. It is now filtered regardless.
- **That these two files were the only racers in the suite.** Only the
  `stage_gate_rules` and `records` whole-table reads were swept. Other shared
  tables under parallel test files were not.
- **What failed in Phase 0's run 2.** Lost to the instrument fault recorded
  there.
