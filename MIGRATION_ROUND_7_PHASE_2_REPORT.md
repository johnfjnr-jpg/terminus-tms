# Round 7 Phase 2: the strip, and the swap that did not happen

**Precondition:** Phase 1b committed at `44415fb`, 21-stage gate green.

---

## WHAT IS NOT BUILT, first, per build-discipline rule 15

**THE SWAP DID NOT HAPPEN, and items 1 through 5 depend on it.** Every one is
carried:

| item | state |
|---|---|
| 0. the must-differ strip | **DONE**, committed at `1f6f585` |
| 1. the swap | **NOT TAKEN.** Measured below |
| 2. A12 implemented in the swap commit | **NOT IMPLEMENTED.** There is no swap commit |
| 3. the primary write path live | **NOT WALKED.** There is nothing live to walk |
| 4. re-navigation, visual comparison, identity adoption | **NOT DONE.** Same reason |
| 5. injections on this session's work | **DONE** for what this session built |

**The scope discovery IS the deliverable**, per rule 15's addendum: an item that
turns out to be much larger than the instruction assumed is reported and
measured, not quietly reshaped into a fifth of itself.

**And A12 specifically was held rather than forgotten.** The instruction ties it
to the swap commit, deliberately. It changes the shared field row across four
surfaces, **three of which are live**, so landing it on its own would be a live
behaviour change on Account, Contact and the Reference tab with no walk behind
it. It is one branch and it is ready; it needs a commit to belong to.

---

## Item 0: the must-differ strip, done

Committed at `1f6f585`.

The differs-from-recorded comparison is out of `scoreReason.ts`. **The
empty-reason refusal stays**, which is the vanilla's behaviour at both
`score-entry.js` sites (line 129 for a `reason_required` level, line 158 for a
revision).

**The R4 test inverted with the claim.** It now asserts that a repeated reason
is **accepted**, with the reasoning kept at the site rather than deleted so a
later reader can tell a superseded decision from a preference (Verification 29).
A companion asserts an empty reason is still refused, so the acceptance is not
true by absence (Verification 14).

**R4 re-recorded in `MIGRATION_TEST_BED_CAPABILITIES.md` as a queued
enhancement** pending a business ruling, with the argument intact: whether a
scorer may repeat a sentence on a revision is a product decision about what a
person is asked, not a migration decision.

**The strip has a detector.** The Phase 1b injection sweep now **reinstates**
must-differ as an injection, so the removal is a change something watches rather
than an absence nothing asserts. 12/12 detected, reverted run green, all four
files byte-identical.

---

## Item 1: THE SWAP IS NOT TAKEABLE

### The measurement

`scripts/round7/tb-swap-readiness.mjs`, reading the capability map and the
import walk from the same places the accounting gate reads them.

```
frontend/test-bed-detail.js: 3282 lines, 136 top-level names

RENDERED  (9 capabilities, 1433 vanilla lines)
     442  field-rows          293  view-lifecycle     256  cost-preview
     142  save-path           116  notes-history      109  buyer-roles
      38  site-details         19  commercials         18  date-bounds

LOGIC-ONLY  (5 capabilities, 1476 vanilla lines)
     742  scoring             318  units              237  exit-criteria
     143  sensor-counts        36  use-cases

ABSENT  (6 capabilities, 362 vanilla lines)
      96  installer            72  tech-team           69  validation
      59  customer-documents   34  install-section     32  revision-history

THE SWAP IS NOT TAKEABLE: it would take 1838 vanilla lines off a live screen.
```

### The finding: five capabilities are BUILT AND NOT RENDERED

**Phase 1b built scoring, units, exit criteria, sensor counts and use cases as
logic modules - with contract-derived tests, 33 injections and two verified
snapshot sweeps - and NOTHING IMPORTS THEM.** 1,476 vanilla lines, the largest
of the three buckets.

**Confirmed by a second instrument**, because the first one had already been
wrong once. A plain grep over `frontend-react/src` excluding `__tests__`:

| module | non-test importers | test importers |
|---|---|---|
| `scoring.ts` | **0** | 1 |
| `scoreReason.ts` | **0** | 1 |
| `unitQueue.ts` | **0** | 1 |
| `units.ts` | **0** | 1 |
| `useCases.ts` | **0** | 1 |
| `exitCriteria.ts` | **0** | 1 |

**And `main.tsx` does not reference the Test Bed at all**, so item 1's first
clause - "the bundle registers the Test Bed loader" - has nothing complete to
register.

**What is missing is the rendering surface, not the logic.** The React panel
renders the Reference-tab field surface. The Test Bed's **ten stage tabs**, with
their exit criteria, scoring and unit panes, are not in the React tree in any
form.

### Why nothing caught this until now

**The `migrated` flag I added in Phase 1b read MODULE EXISTENCE**, which is a
proxy for the question the swap actually asks: *does the React surface render
this?*

It was wrong **in both directions at once**:

- five capabilities whose modules exist and which nothing imports read
  **migrated**;
- `notes-history` read **unmigrated** while the shared Contact component
  renders it.

**Verification 19 exactly: "migrated" is a category name, and a category name is
a finding that needs a finding's evidence.** Phase 1b's own report called giving
that flag a reader one of its three surprises. The reader it got measured the
wrong thing.

**And it was one commit from being invisible.** The Phase 2 instruction opens
with the swap. Taken on the flag's word, the swap would have removed the entire
scoring, units and exit-criteria surface from a live screen - the same failure
Round 6 recorded, on the surface whose accounting instrument was built to
prevent it.

---

## The instrument, rebuilt and calibrated

**The flag is gone. The state is WALKED.**

`scripts/lib/react-reach.mjs` does a transitive import walk from
`TestBedHost.tsx`. The accounting test and the readiness report both use it, so
two walks of one graph cannot drift (Verification 20).

| state | meaning |
|---|---|
| `rendered` | the host reaches **every** module the capability declares |
| `logic-only` | a module exists and the host cannot reach it |
| `absent` | nothing is built |

**The unrendered set is asserted EXACTLY**, not as a count, so it fails when
something regresses **and** when something is built - which is what stops it
becoming a stale list nobody updates.

### EVERY, not SOME, and it came from a calibration rather than judgement

Written as `some`. The injection re-pointing the host's `NotesHistory` import at
a file that does not exist **came back SILENT with ZERO failures**, because
`contact/notes.ts` is imported separately and satisfied `some` on its own. The
capability would have gone on reading `rendered` with its component gone.

That is Verification 51's signature, and it is the second time in two phases
that a silent injection has been the thing worth keeping. `every` is also the
more honest rule: a module a capability declares and the host cannot reach is
either dead code or a missing piece, and both are findings.

### The calibration

`scripts/round7/inject-accounting.mjs`, verified-snapshot harness. **6/6
detected, reverted run GREEN, both files byte-identical.**

| injection | failures |
|---|---|
| a logic-only capability is claimed as rendered | 1 |
| a rendered capability is dropped from the host | 1 |
| the walk stops being transitive | 2 |
| the walk starts from a file that does not exist | 2 |
| a declared module is a typo, so the state reads absent | 2 |
| the swap gate is inverted while the debt list is non-empty | 1 |

**A harness fault, recorded because it read as six findings.** The first run
reported **0/6 detected** with `-1 failed` on five of six. The matcher parsed
`# fail (\d+)`; this runner prints `ℹ fail 0`. **A stage that reports nothing
looks exactly like a stage that found nothing** (Verification 12), and the
`-1` was the only thing separating them. One character of regex.

---

## What the swap needs before it can be taken

**Eleven capabilities, in two kinds of work:**

**Five need a RENDERING SURFACE for logic that already exists and is tested.**
The stage tabs are the shared structure under all of them: ten tabs, each
carrying exit criteria, scoring and unit panes. `scoring` alone is 742 vanilla
lines and 24 names.

**Six need building from nothing**, and four are small: installer (96),
tech-team (72), validation (69), customer-documents (59), install-section (34),
revision-history (32). **The panel already has a `controls` slot** for installer
and tech team; the host passes nothing to it.

**One of the six is a partial rather than an absence, and it is recorded as
absent deliberately.** `validation`: the React field-row layer HAS the keystroke
guard (`acceptsValue`, keyed on `inputMode`), and it does NOT have the vanilla's
refusal-with-message - `cannot be negative`, `must be a whole number`, and the
named feedback line. The React guard's `numeric` pattern `^-?\d*$` admits a
leading minus, so a negative can be typed and nothing refuses it. **Recorded as
absent because a half-built guard reading green is worse than one reading red.**

---

## Surprises

**1. The instrument built to prevent this failure had the failure in it.** The
accounting exists because Round 6 swapped a surface after censusing its fields
and took five working capabilities off a live screen. Phase 1b gave it a flag
that measured file existence, and the flag said the swap was nine capabilities
closer than it was.

**2. Thirty-three injections and two green sweeps say nothing about whether code
is on a screen.** Phase 1b's modules are genuinely well tested. Every claim in
that report is true. **None of them is about reachability**, and that is
Verification 33's shape: the measures were one question - *is the logic right?* -
asked many ways.

**3. The silent injection was the finding, again.** Two phases running, the
injection that came back quiet was worth more than the ones that fired.

**4. `notes-history` was the direction nobody looks.** A false *negative* in the
flag - a capability reported missing that was in fact rendered, by a component
borrowed from another surface. It is the reason the 828-line first measurement
was wrong and had to be retaken before anything could be reported.

---

## Gate

**All 21 stages passed** on the working tree carrying this phase. Pure 480/480,
database 94/94, react 681/681, all 0 fail, typecheck clean, 14 HTTP probes.
Every figure parsed from the run's own output.

The react suite is 681 rather than Phase 1b's 684: the strip removed six R4
tests and added three.

**Not pushed. The swap is not taken. Phase 3 does not follow from here** - what
follows is a decision about the eleven capabilities.
