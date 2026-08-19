# Round 11A fix brief: the score save fault

Source of truth: `CLAUDE.md`, `CURRENT_STATE.md`, `DESIGN_PRINCIPLES.md`,
`ROUND11_BUILD_BRIEF.md`.

**Written up after the fact.** The phases were instructed in session rather
than from a document, and this file is the record of them, created so rule 7
has a phase list to check against and so the next session has something to
read. That gap is itself worth noting: a round without a brief file cannot be
phase-counted, and the rule assumes one exists.

One regression on `main`, found by the business in use within minutes of the
Round 11 merge. Frontend only. No gate rules, no schema, no endpoints.

---

## Phase 1: the `.find()` to `.filter()` fault

`saveTbFields` intercepted scores with `dirtyEntries.find(...)`, took **one**,
and passed every other dirty entry to `saveTbDirtyEntries`, which PATCHes them
as ordinary payload fields. The score keys are deliberately absent from
`TEST_BED_WRITABLE_KEYS` - that absence is what makes the series append-only -
so the PATCH was rejected with "payload contains fields that cannot be set
from this endpoint", **and it took any unrelated dirty field down with it.**

All dirty score keys must be recorded through `POST /scores`, not one.

**Partial failure needs a stated behaviour** rather than whatever falls out,
across N scores plus M fields: whether the earlier ones stand, whether the
remaining fields save, and what the user is told.

**Test evidence required:** the case Phase 8 never ran - score all five, press
Save once, confirm five entries recorded server-side. Then the same with an
unrelated field dirty in the same save, and confirm the field lands too.

---

## Phase 2: the cross-tab leak

A dirty score key from the Reference tab rode into a save pressed on
Commercials and took `safesightCameras` down with it. Report whether that is
now harmless once Phase 1 lands, or whether a dirty edit crossing tabs is a
problem in its own right. Do not fix it if Phase 1 makes it moot, but say
which.

---

## Phase 3: recover the business's lost work if it is recoverable

Four scores were entered and never stored. `record_revisions` is append-only,
so if the drafts never reached the server they are gone. Say plainly whether
they are recoverable, and if not, the business re-enters them.

---

## Round 11A outcome

All 3 phases delivered and signed off: 1, 2, 3. Checked with
`grep -n "^## Phase\|^### Phase"` per rule 7, which returns 3 headings and no
sub-phases.

**Stated plainly because it is exactly the undercount rule 7 exists to
prevent: the sign-off referred to "both phases" and there were three.** Phase
3 changed no code, which is presumably why it read as not counting, but it
produced the most consequential output of the round. A phase that ships no
diff is still a phase.

| Phase | Delivered | Beyond the brief |
|---|---|---|
| 1. `.find()` to `.filter()` | Every dirty score recorded through its own endpoint | **Partial failure specified rather than emergent**, because it cannot be atomic: each score is its own append and `record_revisions` is immutable, so there is no rollback. A recorded score stands; the first failure stops everything including the ordinary fields; everything unrecorded stays dirty; the message names what was recorded by criterion name |
| 2. The cross-tab leak | Reported, correctly not fixed | Moot for scores after Phase 1, and **a real problem in its own right with three named faults**, six rounds older than the thing that exposed it |
| 3. Recoverability | Answered from the record's own history | **Corrected the damage estimate from four scores lost to one.** The reproduction was exact and its consequence was not the user's |

### Three things worth keeping

**1. A reproduction reproduces the fault, not the user's session.** Same click
sequence, same rejected keys, same error string - and the consequence was the
opposite way round, because the reproduction pressed Save once and the
business pressed it five times over eleven minutes. **Only the revision
timestamps showed it**, one append per minute, which is what a person retrying
looks like. The current payload alone is equally consistent with the user
having entered four scores rather than five. **A reproduction establishes the
mechanism and says nothing about the blast radius.**

**2. The driver was written by the person who wrote the interception**, in the
same round, hours apart. It therefore exercised the shape the code was built
for: `recordTbScore` took one score, so the driver recorded one at a time, and
the code and its test agreed with each other while both disagreed with how
anyone uses a panel with five controls and one Save button. **A walkthrough
proves the path it walks**, and is least likely to find another when its author
knows the implementation. **This is the second consecutive round where the
business's first few minutes of real use found a fault that passed every
check** - Round 10 shipped a duplicate Summary and a stale wrapper, Round 11
shipped this. Two rounds is a pattern: the checks are sound and the usage model
behind them is narrower than reality.

**3. Configuration is byte-identical across all 13 sections**, which is the
required result for a frontend-only fix round rather than a pleasing one.

### Open, carried forward

Round 11's fifteen stand. One added:

16. **The whole-batch cross-tab save.** A field dirtied on one tab is saved by
    a Save pressed on another, and on failure: the message names a raw payload
    key rather than a label; the field it names is not on screen and nothing
    in the message reaches it; and a valid edit is refused because of an
    invalid one the user cannot see. **The whole-batch PATCH dates to
    `7ae8a13` (Milestone 4) and fields were spread across tabs by `b5aa346`
    (Rounds 5 and 6)**, so the two halves have coexisted for six rounds.
    Scoring exposed it rather than caused it. **The remedy is a design
    decision**: per-tab save bars, so a save only carries what the user can
    see, or a save that names and links its failures, so a page-level save
    stays page-level but every error is reachable.
