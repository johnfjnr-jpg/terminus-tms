# Opportunity round: F-TOP, the hygiene items, and the push hook

Branch `opportunity-round`, off `main` at `1124917`, which was confirmed equal
to `origin/main` and to `git ls-remote origin main` before the branch was cut.

**NOTHING PUSHES.** Build discipline 18 governs this round from its first
commit, and as of Step 0 a mechanism enforces it as well as a sentence. Every
push-ready state ends in "ready for John's push" with the SHA.

---

## Step 0, done before this brief: the push hook

`.githooks/pre-push`, committed at `10b873e`. Build discipline 18's own text
named a pre-push as available and NOT built, because building a gate around the
business's instruction was theirs to call. John called it.

The measurement that shaped it, because the obvious answer was wrong: this
session runs as `USER=johnfryatt`, uid 501, **the same account as John's own
terminal**, so the "sandbox user" the instruction offered as a candidate does
not exist. Two signals do separate them, and the hook gates on both because
they fail in opposite directions. The full record is in rule 18 itself.

---

## Scope

Four items. Two are build, one is design-first, one is a census.

### 1. F-TOP part A: the Opportunity gains the shared top row

The Opportunity becomes the **THIRD CALLER** of components `ContactHost` and
`TestBedHost` already share. Measured before this brief was written, so the
claim is grounded rather than assumed: `TestBedHost` imports `FollowUpTask`,
`NotesHistory` and `notes` **from `../contact/`**. The sharing is real today,
and Contact is the owning module.

**Part A binds to EXISTING STORED DATA only.** Summary and notes read what the
Opportunity record already carries. Nothing in part A creates a column, a route
or a payload key.

**AND THE STRUCTURAL FACT PHASE 0 MUST SETTLE FIRST, named here because it
changes the shape of the work rather than its size.** There is **no
`opportunity/` module in the React tree**. The Opportunity detail is rendered by
vanilla `frontend/app.js`, which mentions it 176 times. A React component
therefore cannot simply be added to it the way a third caller is added to a
React host.

There is a precedent in the estate - `deal/` is a React island mounted into that
same vanilla surface - and Phase 0 reports whether the top row follows it.
**Phase 0 measures the route; it does not pick it.** The answer may be that part
A is larger than "a third caller", and if so that finding is the deliverable for
this item rather than a fifth of the build.

### 2. F-TOP part B: the follow-up task, DESIGN FIRST

**Nothing is built for part B until Phase 0 has reported and John has ruled.**

The follow-up task is not a rendering change. It needs data and routes: **zero
of 23 opportunities carry one**. Phase 0 reports three things and stops:

- how Contact STORES a follow-up (the payload keys, the column, the write path);
- which ROUTES read and write it;
- whether that shape **lifts to the Opportunity as one mechanism**, or whether
  the two want separate storage.

The third is the question that decides the build, and it is the one with a
standing rule attached: a second reader of one value always drifts, so "the same
shape twice" and "one mechanism with two callers" are different answers with
different costs, and the report states which it is recommending and why.

### 3. The `--red` hygiene item

Same method as the `--attention` sweep that closed the walk 3 round: **census
first, then guard, then adopt.**

**AND THE LESSON FROM THAT SWEEP IS PART OF THE INSTRUCTION, not a footnote.**
The amber census was nearly taken from a WORD LIST, which would have counted
what somebody had named "amber" rather than what renders amber. **The `--red`
census is derived from a SCAN**: every hardcoded red in the estate, by file and
by count, found by matching what a red VALUE looks like, never by grepping for
the word "red". A site named `danger`, `alert`, `error` or nothing at all is
still a site.

The census reports the population. The guard and the adoption follow it.

### 4. `Record scores` wears the estate's button treatment

Carried from the V9 close-out's section 6, where it was named and deliberately
left: it is a **white browser default**, it predates that round, and it sat
outside F-COM's Commercials scope.

Phase 0 reports which class it lacks. This is the cosmetic tier under build
discipline 17 M2: a red-first guard, its affected suite, and a screenshot that
is opened and read. No live injection harness, because no handler and no write
is touched.

---

## The rider clause

Under build discipline 48(a), a commit whose diff is **markdown that no gate
stage reads** rides the preceding green gate rather than re-proving a tree that
differs by prose. Every commit that rides is **named as such at the close**,
because the naming is the control and a close that quietly skips is not
auditable.

The limit is exact and is not "documentation": the estate's source scans read
`scripts/`, so a commit adding a probe script re-gates even when a report ships
beside it.

---

## Phases

| Phase | What it does | Ends with |
|---|---|---|
| **0** | Measure. Builds nothing. | A report per M6, and a **STOP for John's rulings** |
| 1+ | Set by those rulings | Sign-off each |

**Phase 0 answers four questions and nothing else:**

1. **The Opportunity's current top region.** What renders there now, and what a
   three-card row would displace or join. Measured on the live screen at the
   widths Verification 10 names, not read off the source.
2. **Contact's follow-up task.** Storage shape, routes, write path, and the
   lift-to-Opportunity answer with a recommendation.
3. **The `--red` census.** Every hardcoded red, by file and count, **derived
   from a scan**, with the scan calibrated in both directions before its
   numbers are quoted.
4. **`Record scores`.** Which class it lacks.

---

## Standing method for this round

- Every number describing a run is emitted by that run.
- Every new check calibrated both directions and scored on **which named
  assertion** failed, never on the exit code alone.
- Fixtures captured from routes by a committed script, never hand-shaped.
- A claim of absence names the instrument that could have seen the thing, and
  the scan is calibrated on a known-present case before its silence is read.
- Screenshots are opened and read. The assertions state a **relationship
  between two elements**, never a CSS property one of them happens to use.
- Findings are reported and queued. A defect this round's own change creates is
  part of the change; everything else goes on the list.

## Exit gate

Answered point by point at the close, with evidence: every ruling built or
recorded, rulings appended at the phase that launched them, every new guard
calibrated both ways, live proof at both widths, read back from the database,
screenshots opened, superseded callers dispositioned, fixtures torn down and
re-queried by tag, `CURRENT_STATE.md` regenerated and reconciled, the full gate
run as the final act on the final committed tree with nothing else running, and
**merged or pushed: no**.
