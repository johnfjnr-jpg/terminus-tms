# Teardown scan cost: brief

Governing docs: `CLAUDE.md`, the `tms-round-method` skill. Drafted
2026-09-14. **MEASUREMENT FIRST. No fix before the distribution and the
growth curve are on the table.**

**ENFORCEMENT GAPS' five commits and the door diagnosis stay LOCAL** until
its gate is green, which now requires this resolved.

## The finding

**F5 fixed the wrong statement.** It hardened the heaviest CHUNK - a single
`.range(0,999)` read, ~408ms with a ~126ms scan term, and genuinely healthy.
**`tearDown` uses `pagedSelect`, which pages ALL matched rows**, and one page
took **10,209ms against an 8,000ms statement timeout**.

**Not an F5 regression - a gap in F5's scope.** Verification 25's population
clause: the right measurement on the wrong population. F5's guard watches a
statement that is fine while the one that times out sits next to it,
unmeasured.

```
record_revisions        : 103,306 rows   (99,599 a few hours earlier)
tags the teardown sweeps: 33
rows those tags match   : 29,248
```

**And the root.** The estate's own test runs are the main source of that
growth - roughly 3,700 rows in hours, almost all from this session. **The
table under test is enlarged by testing it**, and teardown's scan is
O(table), so it grows every run. That is why timeout problems keep recurring
whatever is fixed.

## Rulings of record (John, 2026-09-14)

R1. **Both levels, because they are one problem at two.** Fixing A without B
    returns us here when the table grows - and the F5 detour is the
    cautionary tale: one query fixed, the adjacent one arrives.
R2. **Measure before touching any ceiling or chunk size.** Two samples so
    far with DIFFERENT contents - six concurrency failures, then one timeout
    - is not a diagnosis.
R3. Bring the distribution and the growth curve for sign-off **before any
    fix**.
R4. Nothing pushes.

## Phase 0: measure

**PROBLEM A - the symptom.** Does `pagedSelect`'s per-page cost cross the
timeout as a function of TABLE SIZE, or is it transient load? Measure the
**distribution** (many samples, not one draw - F5's own lesson) **and the
growth curve** against the population being scanned.

**PROBLEM B - the root.**
- How much does ONE suite run add to `record_revisions`?
- How much of the table is soft-deleted accumulation?
- **Can the scan be bounded so it is NOT O(table)?**

Deliverable: the distribution, the growth curve, and an answer on whether
the scan can be bounded. Stop for sign-off.
