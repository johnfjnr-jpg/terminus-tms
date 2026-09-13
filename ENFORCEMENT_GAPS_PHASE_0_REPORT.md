# Enforcement gaps: Phase 0 report

Measured 2026-09-14 on the brief commit. Read-only.

---

## 1. THE SHARPEST FINDING: THE JOURNAL GUARD FAILS OPEN, BY DESIGN

The `edit.mjs` journal cannot distinguish a routed edit from an unrouted one,
**so a hook can never verify routing with it.**

```
scripts/lib/edit.mjs:68   if (existsSync(JOURNAL)) unlinkSync(JOURNAL)
.githooks/pre-commit:29   [ -f "$JOURNAL" ] || exit 0
```

The journal is **deleted on success**, and the hook **passes immediately when
there is no journal**. So:

| case | journal | hook |
|---|---|---|
| routed edit, landed | deleted | **passes** |
| routed edit, FAILED | failed entry | **refuses** |
| **NOT ROUTED AT ALL** | **never written** | **passes** |

**The third row is the fault that recurred twice**, and the guard is
structurally blind to it. It is the SCANNER WINDOW shape - a guard that
reports clean when it cannot see - **inside the guard built to prevent this
class.**

That is why "using edit.mjs" has been remembered rather than enforced: **there
was never anything enforcing it.**

## 2. IS ROUTING MECHANICALLY ENFORCEABLE? YES, AND HERE IS THE NUMBER

Measured across the last 40 commits:

```
files touched total   : 117
ADDED (creation)      :  59   - no anchor, cannot fail the way an edit does
GENERATED             :  11   - CURRENT_STATE, dist, .json; never hand-edited
MODIFIED (real edits) :  47   <- the population a routing check would police

per commit: 2.9 files, of which 1.2 are edits
```

**1.2 edited files per commit is a small enough population to police**, and
the two noise sources are mechanically identifiable rather than judgement:
creations are `A` in `--name-status`, generated files are a named list.

**But it cannot be built on the journal as it stands.** The journal would
have to **accumulate landed edits** rather than delete itself, so the hook can
compare staged `M` files against a record of what was routed.

**So the answer to the feasibility question is: enforceable, but only after a
change to what the journal records.** Not "noisy, therefore
amend-before-push". The noise is low; the mechanism is absent.

## 3. THE CONTROL CENSUS: THREE BUCKETS

Scoped to what is mechanically decidable, with the third bucket named rather
than omitted.

### A. Test files - is each named by a suite?

```
scripts/tests/*.test.mjs   : 59
ENFORCED (named by a suite): 59
REMEMBERED / UNRUN         :  0
```

**Clean.** Worth stating plainly since it was the expected gap: every test
file the estate has is in a suite.

### B. Standing checks

| control | verdict |
|---|---|
| `check-dist-fresh.mjs` | ENFORCED (verify-all) |
| `check-reachable.mjs` | ENFORCED (verify-all) |
| `check-session.mjs` | ENFORCED (verify-all) |
| **`check-state-fresh.mjs`** | **REMEMBERED** |
| `verify-all.mjs` | ENFORCED (package.json) |
| `verify-harness.mjs` | **naming false positive** - a library, imported by wired tests, not a standing check |

### C. Guard modules - imported by something wired?

Ten of eleven ENFORCED. The exception: **`scripts/lib/react-reach.mjs`** -
REMEMBERED.

### D. UNENFORCEABLE-BY-GATE (judgement)

**Named, not fixed, and not counted as covered:**

- **Is `INTERACTION_STANDARDS.md` being applied?** Instance 1 of the whole
  pattern, and nothing mechanical can see it. The staleness test watches
  identifiers; it cannot watch upkeep.
- **Was a decision sound?** Out of scope by definition.
- **Is a promoted rule being followed?** The estate has measured twice that
  promotion makes a fault fast to diagnose, not rare.

**This bucket is the honest edge of the mechanism.** A meta-check that
implied otherwise would be this round's own fault, one level up.

## 4. `check-state-fresh` RUNS CLEAN, so wiring is safe

```
PASS  CURRENT_STATE.md is current at 4a7f66a, 5 sources watched
```

**Run before recommending it be wired**, because an unrun check may have
rotted and wiring a rotted check turns the gate red for the wrong reason. It
did not. Wiring it is adding a stage that invokes it and asserts exit 0.

## 5. THE OVERBROAD CLAIM, CONFIRMED

`scripts/edit.mjs` states:

> *"a broken edit cannot reach a message describing a change the file does not
> carry"*

**True only of ROUTED edits.** Stated as a property of the repository, it is
false, and the gap between those two readings is how the fault recurred twice.
Verification 19: a claim asserting a property nobody enforces.

## 6. A FOURTH INSTANCE, FOUND BY ACCIDENT: A CONTROL THAT SILENTLY SELF-DISABLES

The pure suite read **539 tests, 538 pass, 0 fail, 1 SKIPPED**. It had been
539 passing earlier in the session. Nothing failed; **a control stopped
checking.**

```
﹣ the path the failure message prints is the path the loader accepts
  # puppeteer is not scratch-installed
```

A conditional skip on an environment precondition. The `/tmp` sweep at the
day boundary had left `/tmp/tms-probe/node_modules/puppeteer` as a directory
containing only `lib` and `src` - **no install, no `package.json`.**

**This is the pattern in a third form.** Instances 1-3 are controls nothing
routes through. **This is a control that runs, finds its precondition absent,
and quietly checks nothing** - reporting as a pass in every summary that
counts passes rather than skips.

**AND IT WAS ABOUT TO COST THE CLOSE.** The gate's browser stage uses the
same install. Left alone, that stage would have SKIPPED and **F6 would have
fired at the round close** - the fourth time this session a precondition was
checked before launch rather than discovered by a red gate. Reinstalled, and
`loadPuppeteer` now launches.

**IT IS ALSO MECHANICALLY CHECKABLE, so it belongs in Phase 1's meta-check
scope**: a suite reporting a non-zero skip count is a control that did not
run, and the gate can assert that number is zero or that every skip is
declared.

### TWO CLAIMS OF MY OWN, WRONG, CORRECTED BY MEASUREMENT

Recorded because the round's whole subject is checking the real thing rather
than a proxy, and I used a proxy twice in five minutes:

1. **"Puppeteer IS present"** - from the DIRECTORY existing. It was not
   installed. **Directory presence is not installation.**
2. **"The skip message is broader than its condition"** - I read `SCRATCH` as
   the scratch root when it is the puppeteer directory itself. The message
   *"puppeteer is not scratch-installed"* was **accurate**, and the
   Verification 19 criticism I attached to it was unfounded. **Withdrawn.**

Both were settled by loading puppeteer and launching it, which is the only
instrument that answers the question actually being asked.

## 7. AN INSTRUMENT FAULT: I PIPED A COMMIT THROUGH `tail -2`

The first attempt to commit this report was **refused by the pre-commit
hook**, and I piped its output through `tail -2`, so **which suite was red
was never captured.** On re-run all three suites were green and the commit
landed.

**That is Verification 16 - never pipe a run whose result is not yet known
through a filter - committed in a round about enforcement gaps.** The cause
is unrecoverable and is recorded as unknown rather than guessed at.

## 8. What this phase does NOT establish

- **That the three buckets are the whole population.** They are what is
  mechanically decidable from `package.json`, `verify-all.mjs` and the hooks.
  A control enforced by convention elsewhere would not appear.
- **That 1.2 edits per commit stays low.** It is a 40-commit window during a
  documentation-heavy sequence.
- **Anything about whether past edits were routed.** The journal keeps no
  history, so the question is unanswerable retrospectively - which is finding
  1 restated.
