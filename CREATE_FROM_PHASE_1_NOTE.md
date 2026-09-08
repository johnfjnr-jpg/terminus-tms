# Create-from, Phase 1: R6 complete, the fix NOT started

**Reporting what is not built first**, per build discipline 15.

---

## R6's read is done, and its result is: nothing new

Read across all 45 files of `src/lib` and `src/routes`, from the opposite
direction to the failed classifier: find every function that inserts a `records`
row, then find which routes call it.

Three flagged, **two verified false positives** by reading them:
`suggestTestBedName` only SELECTs from `records` for a name suffix, and
`appendPayloadSeriesEntry` writes `record_revisions`. Both were caught by a body
bound that ran past the function's end into following code.

**The genuine helper-creator is `deriveMissingUnitSlots` alone, already on the
fix list.** Its second caller, `PATCH /test-beds/:id`, was proven to refuse a
non-owner in the probe round.

**So the fix list stays at six.** R6 required the result be stated either way,
and this is it: the read was done, nothing new joined, nothing outside the shape
was found. The bound is recorded in the script — it sees a function whose own
body inserts into `records`, and cannot see a create through a *second* helper.

---

## The fix is NOT started, and one attempt was reverted

**What happened, recorded because it nearly shipped.** The first attempt
inserted the ownership guard by anchoring on a comment line; the anchor spanned
a blank line into the following comment block and **split it in half**, breaking
the file's syntax. Caught by `node --check`.

**The second attempt was worse and passed the syntax check.** Anchoring on the
bed-404 line inserted the guard into **six** routes rather than two — including
**two GET routes**, `document-requirements` and `lifecycle-documents`, which
would have broken team-wide read. And the bed `select`s do not fetch `owner_id`,
so `bed.owner_id` was `undefined` and the comparison would have **refused every
caller including the owner** on all six.

**It parsed. The pure suite would very likely have passed** — no test opens
those routes. It would have been found by a person.

Restored with `git checkout HEAD -- <path>`, the explicit-ref form this estate
promoted two rounds ago, and the tree verified clean.

**Two lessons, both already in `CLAUDE.md` and both mine to have applied:**
Verification 33's cause — slicing code by pattern without reading what the slice
carries — and the rule that a guard must be shown to refuse the right callers
*and admit the right ones*, which a blanket insertion cannot be.

---

## What Phase 1 still needs

| path | mechanism |
|---|---|
| `convert`, `create-opportunity` | **inside the INVOKER functions** — a migration, stopping written-and-unapplied |
| `create-test-bed`, `customer-documents`, `complete-document`, `units/derive` | **at the route**, per-route, each anchored deliberately and each with the bed/contact `select` widened to fetch `owner_id` |

**Each route needs its own edit**, not a pattern. The two GET routes above are
the proof of why: they share the anchor and must keep working.

---

## What this note does NOT cover

- Any of the fix. Nothing is applied.
- The migration is not written.
- No calibration has run.
