# Scanner window blind spot: Phase 0 report

Measured 2026-09-13 on `053cf76`. Read-only except a snapshotted, restored
reproduction.

---

## 1. THE GUARD IS BLIND TO TWO REAL UNBOUNDED SELECTS RIGHT NOW

Not a hypothetical. Measured across the 81 gate-run files by finding every
chain START independently of the window, then measuring how far its
terminator sits:

```
chain starts found (window-independent)        : 70
the scanner can SEE (terminator <= 400 chars)  : 66
** BLIND TODAY (terminator > 400)              : 4 **
   of those, genuinely UNBOUNDED               : 2
within 60-100% of the window (one comment away): 13
```

**The two it cannot see:**

| distance | file | table |
|---|---|---|
| 485 chars | `scripts/tests/config-invariants.test.mjs` | `base_cost_batches` |
| 484 chars | `scripts/tests/teardown-scoping.test.mjs` | `record_revisions` |

**Confirmed against the real scanner, not only my own instrument:** it
reports 40 unbounded selects in total and **zero** for `base_cost_batches`.
The select at `config-invariants.test.mjs:125` has no `.range`, no `.limit`,
no `.single`.

> **AND NEITHER IS IN THE ALLOWLIST - because the scanner never found them.
> The drift detector that caught the last instance CANNOT catch these.**

That is the silent failure mode with live instances: a guard reporting a
clean it has no basis for.

## 2. THE TRIGGER IS WIDER THAN COMMENTS

`base_cost_batches` is not blinded by a comment. Its terminator is 485
characters away because the code that follows is an ordinary multi-line
`.map()` returning an object literal - lines that begin with neither `const`
nor any other keyword the lookahead accepts:

```js
  const bc = await db.from('base_cost_batches')
    .select('id, product, batch_label, effective_from, unit_cost, ...')
  assert.equal(bc.error, null, `base_cost_batches query failed: ...`)
  baseCosts = bc.data.map(r => ({
    ...r,
    unit_cost: Number(r.unit_cost),
    ...
```

**Any code shape that delays the next statement keyword blinds the scanner.**
Comments are one trigger; ordinary multi-line expressions are another, and
they are already doing it.

## 3. REPRODUCED ON DEMAND, WITH NOTHING BUT A COMMENT

```
BEFORE  scanner total: 40   sees contact-links::contact_roles::0: true
        injected 6 lines of COMMENT after the select. No code changed.
AFTER   scanner total: 39   sees contact-links::contact_roles::0: false
        restored, byte-identical to the snapshot
```

**The total went DOWN, from 40 to 39.** A guard losing sight of a select
reports the same number as a round that removed one.

## 4. OPTION (c) IS ALREADY IMPLEMENTED AND CANNOT HELP

The brief flagged this as a premise to test rather than assume, and it does
not hold. `unbounded-selects.mjs` line 82 already calls `stripJs` before
matching.

**It does not help, and the reason is a CORRECT property of the stripper.**
Measured: `stripJs` replaces comment characters with **spaces**, preserving
line structure - 116 characters in, 116 out, 7 lines in, 7 lines out. It must
do that, because the scanner reports line numbers.

**So a comment still consumes its full character count inside the window.**
(c) cannot be the fix without breaking line-number reporting.

## 5. RECOMMENDATION: (a) DETECT-AND-FAIL

**(b) widening is rejected** by R2 and by the measurement: `base_cost_batches`
is at 485 and `teardown-scoping::record_revisions` at 1893. Any new number has
13 chains sitting at 60-100% of it, one comment from the new cliff.

**(c) is already in place** and cannot be strengthened without losing line
numbers.

**RECOMMENDED: (a), with the parse split in two.**

1. **Find chain STARTS with no window at all** - `.from('x').select(` is
   unambiguous and needs no terminator.
2. **Then look for the terminator to bound the chain body.** If none lies
   within the window, **RAISE** rather than silently not counting:
   *"found a select at `<file>:<line>` whose chain could not be bounded
   within N characters - the scanner cannot classify it."*

**This satisfies R3 - it fails loud only when it genuinely cannot parse.**
The 66 chains it already bounds are unaffected; only the 4 it currently drops
would raise, and 2 of those are real findings that must be fixed or
allowlisted rather than silenced.

**Consequence to expect in Phase 1, stated now so it is not a surprise: the
fix will make the gate RED**, because two genuinely unbounded selects become
visible for the first time. That is the guard working. Whether those two are
bounded or allowlisted is a Phase 1 decision with reasoning.

## 6. What this does NOT establish

- **That 70 is every chain in the tree.** It is every chain matching
  `.from('x').select(` in the 81 gate-run files. A differently-spelled chain
  - a builder, a variable holding the table name - is outside both my
  instrument and the scanner's.
- **That the other two blind chains are harmless.** They are `bounded` by my
  reading of their body text; the scanner has never classified them.
- **Anything about non-gate-run files**, which the scanner does not read.
