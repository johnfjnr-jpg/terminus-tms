# Scanner window blind spot: Phase 1 report

## The fix, and a better parse than the brief asked for

**Step 1 as ruled: find chain STARTS with no window.** `.from('x').select(`
is unambiguous and needs no terminator to be recognised.

**Step 2 went further than "seek the terminator".** The terminator lookahead
was a heuristic about the code AROUND the chain - which keyword begins the
next statement - and it is what four chains fell foul of. Replaced by a
property of the thing being parsed: **a PostgREST chain continues only via
`.method(`, so it ends at the first non-blank line that does not start with a
dot.**

**That removed all four unparseable chains without editing one of them.**
Blank lines are skipped rather than ending the chain, because `stripJs` turns
a comment between two chained calls into exactly that, and stopping there
would drop a `.range()` on the far side and report a bounded chain as
unbounded.

**Step 3: the window survives as a backstop at 2000 characters.** If a body
somehow runs past it the chain is UNPARSEABLE and is **raised by name** -
never dropped.

## The dispositions: measured, and NOT the same answer

### `teardown-scoping.test.mjs::record_revisions::7` - the DECLARED EXEMPTION

The query asserts `firstPage.length === 1000`. **It must stay unranged: that
assertion is what proves the 1000-row cap is real, and bounding it destroys
the evidence.**

So it is wrapped in `unrangedForCalibration`, the exemption the estate
already built for exactly this - a CALL defined in the guard's own module -
rather than allowlisted. The sibling case lower in the same file records the
reasoning: *a deliberate unranged read is a different thing from an
overlooked one, and the code should say which it is.*

**AND THE FIRST ATTEMPT SILENTLY VOIDED IT.** I imported it as
`unrangedForCalibration: unranged`. The exemption is recognised by the
literal name appearing before the `.from(`, so **the alias defeated it** -
and the guard caught that by continuing to flag the select. Verification 19's
own warning about name-based enumeration, arriving inside the remedy. Noted
at the site.

### `config-invariants.test.mjs::base_cost_batches::0` - BOUNDED, and the ratchet is why

**First disposition, superseded and left visible**: allowlist it, on the
measurement that `base_cost_batches` holds **3 rows** - 3 products across 1
`effective_from` date - growing by one row per product per price change.
INVARIANT 13 must read the whole catalog, so bounding looked wrong.

**The reasoning was sound and the answer was still wrong.** The allowlist
carries a **SHRINK-ONLY ratchet**, and the entry raised it from 40 to 41:

```
✖ SHRINK-ONLY: the allowlist has not grown
  the allowlist holds 41 entries against a ceiling of 40.
  The ceiling may only ever be lowered.
```

**The ratchet pushed back and the better answer was already in the estate.**
`pagedSelect` reads EVERY row whatever the count, so INVARIANT 13 still sees
the whole catalog, **the list does not grow**, and the caveat the allowlist
entry needed - *safe only because the table is tiny* - disappears entirely.

**A control doing its job produced a better fix than the one I brought to
it**, which is worth more than the entry it refused.

## All three claims proven

```
2. THE POPULATION IS UNCHANGED
   nothing unparseable in the clean tree          0
   scanner finds exactly the allowlisted set      40 vs 40
   no NEW flags / no STALE entries                0 / 0
   the shrink-only ratchet holds                  40 / 40

1. THE PHASE 0 BLINDING NO LONGER WORKS
   six comment lines no longer hide the select    seen before true, after true
   and the total does not silently drop           40 -> 40
   restored, byte-identical

3. AN UNPARSEABLE CHAIN RAISES BY NAME
   the chain is reported UNPARSEABLE              1
   findUnboundedSelects RAISES, not a short list
   and NAMES the select it could not parse
   restored, byte-identical
```

**Claim 3 matters most.** The round is about a guard that failed silently,
and an unproved raise would be the same fault in a new place.

**Ordinals did not shift**: every one of the 40 existing allowlist keys still
resolves, so nothing had to be re-pointed.

## An environment reading, not a finding

The database suite failed once at `GET /industries -> 401` in **9.15ms**
against a stage that normally runs 25-40 seconds. **Verification 48: a stage
that fails faster than it could do its work has not run.** The session had
expired five minutes earlier. Refreshed - before PROBES, never before the
gate, since the gate extends the session itself and a refresh token is single
use - and the suite read 102/102.

## What this does NOT establish

- **That 70 chain starts is every chain in the tree.** It is every chain
  matching `.from('x').select(`. A builder, or a variable holding the table
  name, is outside both the scanner and my instrument.
- **That the 2000-character backstop is right.** It is proven capable of
  firing; no real chain approaches it.
- **Anything about non-gate-run files**, which the scanner does not read.
