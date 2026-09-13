# Gate race fix: close-out

**CLOSED** on three gates - 22/22, 21/22, 22/22 - with **zero invariants red
in any of them**. The one red was F5, unrelated, and it became its own round
rather than being retried away. **PUSHED** at `26e9dd3`.

**Test-tooling only: a revert is pure git.** No `src/`, no `supabase/`, no
`frontend/`; no server restart, no database action, no rebuild.

## The defect

`config-invariants.test.mjs` scanned `stage_gate_rules` whole-table without
the fixture-type exclusion `gates.test.mjs` carried, and `node --test` runs
the ten `test:db` files concurrently - **measured**, two files overlapping
1501ms of a 1502ms test. So one file read the other's live fixtures and the
invariant went red or green **by timing, with zero real orphans**.

**Verification 20 inside the gate**, where the consequence is that every
green is partly chance.

## The fix, and both halves of the proof

**One shared predicate**, imported by both files - `gates.test.mjs` no longer
OWNS the convention, which is the V20 fault closed at root rather than
patched. **Applied at the loader**, so all seven invariants reading `rules`
inherit it and INVARIANT 4 was fixed by the same change. INVARIANT 5 is safe
today only because `Senior` is a real track, which the ruling says is not
safe.

- **Race closed**: the forced reproduction that made INVARIANT 2 and 4 red on
  demand cannot fire.
- **Invariant not blinded**: a real orphan on the configured type `test_bed`
  still turns INVARIANT 2 red; widening the prefix to swallow `test_bed`
  turns the **coverage assertion** red.

The second half is the point. A probe that cannot reproduce might be fixed or
might be broken, and the two read identically.

## Recorded plainly

**A defect this change created and fixed under build-discipline 10's limit**:
explanatory comments placed BELOW two selects pushed the next statement
keyword past the 400-character window `unbounded-selects.mjs` scans - 653 and
882 characters - and **the guard stopped seeing those selects entirely**. A
long careful comment blinds it better than a short careless one. Caught only
because the drop shifted allowlist entries and tripped the drift detector.
**Carried as R10.**

**A false commit message, amended.** The promotions commit landed with
neither promotion in it while claiming both - a trailing comma made the
buffer a tuple. Amended, never pushed, and the amended message says so.

**Promotions: instances, no numbers.** V20 gained the two-test-files case
with the tell that *an intermittent whole-table assertion is a two-readers
symptom*; the collapsed null-reading rule gained the base-rate arithmetic
(`0.95^20 = 0.36`).
