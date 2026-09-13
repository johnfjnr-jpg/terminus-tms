# Gate race fix: Phase 0 report

Measured 2026-09-13 on `b3aa838`. Confirmed, reproduced, and one finding
that **changes how Phase 1 must be verified**.

---

## 1. THE FINDING THAT CHANGES PHASE 1: R3's "20 RUNS GREEN" IS WEAK EVIDENCE

The natural failure rate was measured before anything was fixed, because
**a green run count only means something against a base rate**:

```
8 runs of npm run test:db
0 of 8 runs had INVARIANT 2 red  (0%)
run 2 had SOME failure; runs 1,3,4,5,6,7,8 clean
```

**At an observed rate near zero, twenty green runs proves almost nothing.**
If the per-run failure probability were 5%, twenty consecutive green runs
happens **36% of the time with the bug still present** (`0.95^20 = 0.36`).
At 2% it is 67%. The run count cannot distinguish a fixed race from a lucky
afternoon.

> **So the determinism half of R3 must rest on the FORCED REPRODUCTION being
> unable to fail, not on N green runs.** The 20 runs are still worth doing -
> they would catch a fix that broke something outright - but they are the
> weaker instrument and the report must not present them as the proof.

This is Verification 13's shape at the level of a verification plan: a count
of zero from an instrument never shown reaching one.

---

## 2. THE MECHANISM, CONFIRMED

| claim | how it was established |
|---|---|
| `config-invariants` loads the whole table unfiltered | read: `before` hook, lines 37-40, no filter |
| `gates.test.mjs` excludes the fixture type | read: `.filter(r => r.record_type !== TYPE)`, `TYPE = harness_${runTag}` |
| the convention is declared in ONE file only | `gates.test.mjs:33`. **`verify-harness.mjs` does not mention `harness_` at all** |
| `verify-harness.mjs` inserts the rules | `verify-harness.mjs:217` |
| **`node --test` runs the files CONCURRENTLY** | **MEASURED**, not assumed: two files overlapped 1501ms of a 1502ms test, starting 0ms apart |
| only two files scan this table whole | grep across `scripts/tests/` |

---

## 3. REPRODUCED ON DEMAND - AND THE CLASS IS TWO INVARIANTS, NOT ONE

```
1. BASELINE, no fixture rows      INVARIANT 2 failed: false
                                  INVARIANT 4 failed: false
2. CREATE the two shapes the harness actually makes
     payload_field_required  +  document_status
3. WITH THE ROWS LIVE             INVARIANT 2 failed: TRUE
                                  INVARIANT 4 failed: TRUE
   cleanup: re-queried by tag, 0 rows remain
```

**Build-discipline 8: fix the class, not the instance the failure named.**
Seven invariants in that file read `rules`; **five do not filter by
record_type** - 2, 4, 5, 6, 8, plus the approval scope matrix and the
three-tracks check.

| invariant | harness shape | exposed? |
|---|---|---|
| **2** stage absent from `stage_definitions` | any | **YES, reproduced** |
| **4** `document_status` in `stage_reference_docs` | `{document:'NDA'}` | **YES, reproduced** - `stage_reference_docs` holds `test_bed` rows ONLY |
| 5 track absent from `approval_tracks` | `{track:'Senior'}` | no - `Senior` IS a real track |
| 6 duplicates | - | no |
| 8 criterion exists | `contact_role_linked` | not established |

**INVARIANT 4 was predicted from the data and then MEASURED** rather than
left as an inference (Verification 26: the clause after "so" is its own
claim). **A fix scoped to INVARIANT 2 would leave INVARIANT 4 racing**, and
its next red would read as a fresh defect.

---

## 4. THE FIX: RECOMMENDATION, with the two rejections reasoned

**NOT (b), serialise.** It fixes the timing and leaves the disagreement
standing: two readers still hold different definitions, any future parallel
writer reintroduces it, and the suite gets slower. **It makes the symptom
quiet, which R2 forbids.**

**NOT (c) as stated, "scope to real record types".** If *real* means *has
rows in `stage_definitions`*, then deleting every `stage_definitions` row
for `test_bed` would silence the orphan check for `test_bed` entirely.
**That is exactly the exclusion-that-hides-a-real-orphan R2 names.**

**RECOMMENDED: (a), applied at the LOADER rather than at INVARIANT 2, as ONE
SHARED PREDICATE, WITH A COVERAGE ASSERTION.** Three parts, and the third is
what makes it correct rather than quiet:

1. **One definition, imported.** A single exported `isFixtureRecordType()`
   in a shared module, used by BOTH files. This closes the Verification 20
   fault itself rather than its symptom - today the convention exists in
   `gates.test.mjs:33` and nowhere else, which is why the other file never
   knew about it.
2. **Applied in the `before` hook**, so all seven invariants inherit it and
   INVARIANT 4 is fixed by the same change. Build-discipline 8.
3. **A COVERAGE ASSERTION**: the suite asserts that the record types it DID
   examine include every product type - `contact`, `opportunity`,
   `smoke_test`, `test_bed`. **If the exclusion ever widens to swallow a
   real type, this goes red.** Verification 19's clause: where a list is
   unavoidable it asserts its own completeness.

**Why a name-based predicate is acceptable here, stated rather than
assumed.** `stage_gate_rules` has no column marking a fixture - the columns
are `id, record_type, variant, from_stage, to_stage, requirement_type,
requirement_detail, created_at` - so there is no declared property to key
on. Verification 19 prefers structure to a name; where only a name exists,
the remedy is one definition plus a completeness assertion, which is part 3.

---

## 5. AN INSTRUMENT FAULT OF MY OWN, IN THIS PHASE

The natural-rate script printed `any failure: YES` for run 2 **and
discarded the output**, so the causal line was gone before it could be read.
That is **Verification 16 - capture the run to a file, then search the file -
broken in an instrument written during a round about blind instruments**, by
the person who had just catalogued them.

Fixed: it now writes every run to its own file and NAMES what failed. The
consequence stands in the record rather than being quietly repaired - **run
2's failure is unidentified and will not be recovered**, and the INVARIANT 4
claim above rests on the forced reproduction instead, which is the stronger
evidence anyway.

---

## 6. What this phase does NOT establish

- **What failed in run 2.** Lost to the instrument fault above. It may have
  been INVARIANT 4 racing, which would be consistent - but that is a guess
  and is labelled one.
- **Whether INVARIANT 8 is exposed.** The `contact_role_linked` shape was
  not tested against it.
- **The natural rate to any precision.** 8 runs, 0 hits. The true rate is
  low and otherwise unknown, which is the whole of finding 1.
- **That these two files are the only racers.** Only the
  `stage_gate_rules` whole-table scans were enumerated. Other shared tables
  under parallel test files were not swept.
