# Migration Round 5, Phase 3b: the deal-form retirement — STOPPED

Session of 2026-09-06. **The retirement was attempted, measured, and reverted.
Nothing is pushed.**

The instruction's stop condition is met on both of its clauses, and this
report is what it asked for instead.

---

## The verdict, first

**`frontend/opportunity-deal.js` is NOT retired, and should not be retired by
applying the standing template.** Doing it properly is a build, not a
retirement, and it needs its own brief.

The tree is byte-identical to `2e70829` plus this report. `npm test` is
470/470. The three deleted files were restored and each verified
byte-identical against a full-path-keyed snapshot.

---

## What the attempt measured

### 1. The blast radius is 31 failures across 8 files, not 16 in one

Phase 0 counted **mentions**. It did not measure what deleting the file
**breaks**, and those are different numbers:

| file | tests failing |
|---|---|
| `commercials-wiring.test.mjs` | **17** |
| `transition-requests.test.mjs` | 4 |
| `latches.test.mjs` | 3 |
| `milestone-schedule.test.mjs` | 3 |
| `rate-resolution.test.mjs` | 2 |
| `opportunity-headline.test.mjs` | 1 |
| `strip-comments.test.mjs` | 1 |
| **total** | **31** |

The brief anticipated "the 16 commercials-wiring judgements". The real figure
is 17 there and **14 more in six other files that the mention-count never
surfaced as judgements**.

### 2. A "re-point" is not available, because the assertions have no equivalent form

This is the decisive finding, and it is a measurement rather than an
impression.

The standing template is *re-point, premise re-measured, both sides
individually*. A re-point requires an equivalent assertion to exist on the new
side. **Measured on the margin-override test's four assertions, against the
whole `frontend-react/src/deal/` corpus:**

| the vanilla assertion | matches the React source? |
|---|---|
| ``numOrUndefined(`deal-margin-${key}`)`` | **no** |
| `if (v !== undefined) marginOverrides[key] = v` | yes (incidental) |
| ``setVal(`deal-margin-`` | **no** |
| `function readPayload()` | **no** |

Three of four have no equivalent. These are **vanilla-idiom source shapes** —
`setVal`, `numOrUndefined`, a named `function` declaration — and the React
implementation expresses the same behaviour in a different language with a
different structure.

**So each is not a re-point but a NEW ASSERTION derived from the behaviour.**
And by Verification 47 a test derived from the implementation tests the
implementation, so each would have to be derived from the contract or the
behaviour list instead. **That is designing ~31 tests, which is a build.**

### 3. A second file's staleness surfaced, which nobody was looking for

`opportunity-headline.test.mjs` asserts *"the stale-write message is one
sentence, on both surfaces"* by reading `app.js`, `opportunity-deal.js` **and
`opportunity-reference.js`**.

`opportunity-reference.js` was unloaded by **this round's own swap**. So that
test already reads **two** files the browser does not load, and only one of
them was on any work list. Retiring the deal form would have left the second
half silently asserting against a surface nobody sees — the exact shape the
retirement policy exists to prevent.

---

## What the attempt confirmed, and is worth keeping

Two judgements resolved cleanly by template, and they are recorded so the next
session does not re-derive them.

**`strip-comments.test.mjs` — clean deletion of an entry.**
`opportunity-deal.js` is one of fourteen JS corpora proving the stripper keeps
real code. The claim is about the **stripper**, not about the file. Removing
one entry leaves thirteen and the claim untouched.

**`commercials-wiring.test.mjs:834` — a clean re-point, premise re-measured.**
The `.ds-row` assertion carries its own disposition in its own comment:

> *"When the last vanilla consumer goes, THIS LINE FAILS, and that failure is
> the instruction to delete it rather than a defect."*

**Measured: `app.js` still uses `.ds-row`.** So `opportunity-deal.js` is NOT
the last vanilla consumer, the instruction does not fire, and the correct
action is to drop one entry from the list and let `app.js` carry the
assertion. The premise was re-measured rather than assumed, which is the
template working exactly as written.

---

## Why this is a stop rather than a slower push

The instruction said to stop if **any** judgement fell outside the template or
**anything** surprised. Both happened, and either alone would be enough:

- **Outside the template:** three of four measured assertions have no
  equivalent form, so the work is deriving new tests, not re-pointing existing
  ones.
- **Surprised:** 31 failures across 8 files against an anticipated 16 in one,
  plus a second unloaded file found inside an unrelated test.

**The tempting alternative was to grind through all 31.** That would have
produced ~31 new assertions written at the end of a long session, derived from
the implementation they test, on a suite that guards the most-migrated surface
in the estate. The Round 5 close-out already records what happens when a fix is
written faster than it is understood.

---

## What the next session needs

1. **The work list is 31 failing tests, not 44 mentions.** The mention count
   was the wrong instrument for sizing this; the failure list is the right
   one and is reproduced above.
2. **Each judgement is: does the claim survive, and if so what asserts it on
   the React side?** Derived from the contract or the behaviour list, never
   from `frontend-react/src/deal/`.
3. **`opportunity-reference.js` is entangled with it** through
   `opportunity-headline.test.mjs`, and falls due at Round 6's close anyway.
   Retiring both together may be cheaper than either alone.
4. **`deal-feedback.js` retires with the deal form** — its only remaining code
   mention is from inside it.

---

## Gate and push

**Not run, and NOT pushed — deliberately.**

The gate is green on `2e70829`, measured at the Round 5 close, and the tree is
that plus this report. Running it again would prove only that a reverted
experiment reverted, and the conditional push was gated on the retirement
landing. It did not land.

**23 commits remain unpushed**, unchanged from the Round 5 close.
