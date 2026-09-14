# Enforcement gaps: close-out

**CLOSED** on the gate at `2a43559`, **24 of 24**, exit 0, F6 quiet, no
skips. **PUSHED**; `ls-remote` confirms `origin/main` = local HEAD =
`a7167ef`.

**Boundary: test tooling, hooks and docs only.** `src` 0, `supabase` 0,
`frontend` 0, `frontend-react` 0. **No server restart, no database action,
no rebuild.** A revert is pure git plus deleting added files; rehearsed to a
byte-identical tree.

---

## WHAT THIS SESSION ACTUALLY WAS

**The gate was found lying three ways, and all three are fixed.**

1. **RACING INVARIANTS.** Two test files asserted one claim about
   `stage_gate_rules`; one excluded the harness's synthetic record type and
   the other had never heard of it, and `node --test` ran them concurrently.
   The invariant went red or green **by timing, with zero real orphans**.
   Fixed at root: one shared predicate, imported by both, applied at the
   loader so all seven invariants inherit it.
2. **THE `pagedSelect` TIMEOUT.** A teardown scan cancelled server-side at
   10,209ms. Measured: the scan is healthy at a flat 410ms median, and the
   accumulation it walks is HISTORICAL rather than a leak. A stall retry
   with recorded cause and a ceiling now covers the real case.
3. **THE ENFORCEMENT GAPS THEMSELVES.** `edit.mjs`'s journal DELETED itself
   on success and the hook passed on a missing journal, so a routed success
   and a never-routed edit were indistinguishable. **The guard failed open on
   the only case it existed to catch**, and the false-commit-message fault
   recurred twice inside that blind spot. Called a discipline failure for
   four rounds; it was a build defect.

**And the tail was substantially WRONG-SCALE TESTS built for a system TMS
isn't.** Two tests fired 40 and 50 genuinely concurrent writes to one record,
a third fired 25. Measured over 20 rounds: fourteen clean, then a cliff that
never recovered. **The test manufactured contention that exists nowhere in
the product, saturated the connection, and broke its NEIGHBOURS** - five
suite runs failing five different ways, read as an unhealthy connection for
most of a session. The scale principle is now recorded in
`DESIGN_PRINCIPLES.md`: an internal tool, small team up to five, ~5
simultaneous operations worst case, **and no test may assert a load beyond
what the product can produce.**

**The version-gate red was a transient blip made UNPLACEABLE by a missing
instrument.** Two mechanisms were proposed and both collapsed on arithmetic,
because the transcript carried durations and no wall-clock. It passed clean
on the next gate at half the time. **The timestamps are now in**, so a
recurrence is diagnosable where this one was not.

---

## The build

**The journal ACCUMULATES.** `scripts/hooks/journal-guard.mjs` refuses a
commit whose modified files have no landed entry, **fails closed** if it
cannot read the staged set, and exempts only creations, deletions and a
named generated list living in the guard.

**`check-state-fresh` and `check-browser-usable` are gate stages.** The
second asks whether the browser dependency LOADS, not whether a directory
exists - it was a directory with `lib` and `src` and no install.

**The meta-check**, `scripts/tests/enforcement.test.mjs`, calibrated three
ways including **FAIL CLOSED on an indeterminate case**, which is the one
that matters: a meta-check passing when unsure rebuilds the silent failure
mode one level up.

**And its boundary is asserted IN the test file** so a green gate cannot be
read as more than it is: **mechanical enforcement is gateable, judgement is
not.** Whether `INTERACTION_STANDARDS.md` is applied, whether a decision was
sound, whether a promoted rule is followed - named, and NOT covered.

## THE DOGFOOD CAUGHT ITS OWN AUTHOR, FOUR TIMES

`edit.mjs` refused four bad-anchor edits of mine across the session, each of
which would previously have been a silent no-op followed by a commit message
describing a change the file did not carry. **The fix demonstrated on the
exact fault it was built for, in the round that built it.**

## Promotions: four instances, no new numbers

- **Verification 12** gains the author's side of its own rule - *when you
  write the tool, make it raise* - and the sharpest form: **a control that
  deletes its own evidence of use cannot detect non-use.**
- **Verification 9** gains the ratchet clause: *a one-way control's refusal
  is information about your fix, not an obstacle in front of it.* The
  shrink-only allowlist refused a sound entry and the better fix was already
  in the estate.
- **The limit-of-promotion note** gains the line between what a rule can do
  and what a mechanism can do.

## Recorded plainly

**One `--no-verify`, disclosed**, for the bootstrap commit whose routing
records were destroyed by the journal-destruction bug it fixed. **Confirmed
one-time**: every later commit passed the guard. And the detector I first
used for that check was itself wrong - it grepped commit messages for
`no-verify` and flagged two that say *"Committed WITHOUT --no-verify"*.

**Instrument faults, self-caught**: a meta-check matching prose (V39), a
calibration harness misparsing its own runs (V16), a sweep resolving `const
N` to the file's first declaration and under-reporting an N of 25, a stale
output file read as a result, a gate run on an unchecked prior step, and
zsh's word-split (V44) biting again.

---

## Carried

- **P4** the 4 rotted assertions
- **P5 / P6** standing
- **MECHANICAL-FAULT HARDENING**: chain `commit && gate`, never read a run's
  output without confirming the run wrote it, and **apply the V44 word-split
  remedy at the recurring sites rather than re-recording it**
- **R1** the record-surface consolidation, P2 folds in
- the features, and the **Sections 6-11 walk**

**All now on a gate that means green.**
