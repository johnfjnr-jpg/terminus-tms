# CLAUDE.md

Standing instructions for every session in this repository. Read this
first, every time.

This file is deliberately short. It carries the rules that apply to every
round, not the reasoning behind them. Reasoning lives in
`DESIGN_PRINCIPLES.md`. If this file grows past roughly two pages it stops
being read properly and stops working.

---

## Read before doing anything

| Document | What it answers |
|---|---|
| `DESIGN_PRINCIPLES.md` | Why a decision was taken, and what it supersedes |
| `PROTOTYPE_SPECIFICATION.md` | What the prototype actually does, cited by line |
| `INTERACTION_STANDARDS.md` | What correct interaction behaviour means |
| `CURRENT_STATE.md` | What is configured and built right now. Generated |
| The current round's build brief | This round's scope |
| The previous round's build brief | What was just changed and what it left open |

Where `CURRENT_STATE.md` and a hand-written document disagree, the
generated file is right about what exists and the hand-written one is right
about what was intended. **The disagreement is a finding.** Report it, do
not resolve it quietly.

---

## Build discipline

1. **Work through phases in order. Stop after each. Report real test
   evidence. Wait for sign-off before starting the next.** Never run two
   phases together because they look related.

2. **Confirmed is not verified.** A phase is complete when a specific claim
   has been checked against real evidence, not when the work feels done.
   Real evidence means a browser test, a direct database query, or
   server-side confirmation. Not inspection, not reasoning about what the
   code should do.

3. **Verify the thing being claimed, not a proxy for it.** Two separate
   rounds recorded checks that measured something technically true and
   materially different from the claim. If a check could pass while the
   claim is false, it is not evidence.

4. **Rule 8: never build against a section marked with a yellow status
   marker in `PROTOTYPE_SPECIFICATION.md` without first doing a line-cited
   extraction pass.** "Use the prototype as reference" without line numbers
   has produced wrong builds repeatedly.

5. **Investigate before fixing, when a brief says to.** Both "genuine
   regression" and "never actually covered" have been the real answer in
   different cases. Report the finding before building either way.

6. **A fix built for the pages that existed at the time is not a fix for
   the pages built after it.** Confirmed three times across separate
   rounds. When applying an established fix, sweep for every instance
   rather than assuming coverage.

7. **Before declaring a round complete, check the phase count against the
   brief's own list** with `grep -n "^## Phase\|^### Phase"`. Two rounds
   recorded a premature completion claim caught only by doing exactly
   that. **The pattern must include `###`.** It originally matched `##`
   only, and Round 10 split Phase 5 into `### Phase 5A` and `### Phase
   5B`: the narrow pattern returns 11 headings against that brief where
   the real count is 13, so it would have missed two signed-off phases,
   which is exactly the undercount this rule exists to prevent. Count
   headings, then confirm each one has an explicit sign-off; a heading
   that is shared context rather than a phase is stated as such.

---

## Architecture

1. **Extend the generic records engine. Never fork it.** New modules use
   the existing records, revisions and payload pattern rather than parallel
   structures.

2. **Data-driven, not hardcoded.** Stage gates, approval routing and
   conversion criteria are database rows. Computed values are computed, not
   stored. Approved snapshots are immutable.

3. **One computation path per concern.** Where a shared evaluator exists,
   extend it. A second path that agrees today will disagree later.

4. **A migration that changes seeded data must reconcile the seed file in
   the same change.** Seeds re-run and win.

5. **Guards involving `jsonb` compare `jsonb` to `jsonb`, never via a
   `::text` cast.** That fault once duplicated rows on every seed run.

6. **Display renames stay display renames.** A label change must not become
   a schema, endpoint or payload change.

7. **Every migration is written idempotently**, whatever the migration
   ledger is expected to guarantee. Guard data writes with `WHERE NOT
   EXISTS`, and DDL with `IF NOT EXISTS`. The ledger has been observed
   drifting from the schema silently, so a migration already applied can
   be replayed with no warning, and an unguarded `INSERT` duplicates rows
   invisibly.

8. **Correct for every caller that exists is not correct for the caller
   about to be built, and the fault only goes live when something starts
   depending on the branch that was being skipped.** Before building on an
   existing path, exercise the branch your new use will rely on,
   especially its failure branch. Three confirmed instances:
   `complete-document` hardcoded `status = 'approved'`, right for every
   caller it had and a gate bypass the moment a URL field was added;
   `api()` had no `catch` around `fetch`, so every caller's `!ok` branch
   was unreachable on a network failure until a pending state needed it
   and sat on "Loading" forever; and `renderTbStageExitCriteria` had no
   load-token guard, safe only because it ran last, until the fetches were
   parallelised. **None appeared as a regression** and no test broke,
   because nothing was broken until the new use arrived. Distinct from
   build-discipline rule 6, which is a fix failing to reach a new surface;
   this is an unchanged path meeting a new demand.

---

## Verification

1. **Layout: measure the container, not the element.** A card can report a
   healthy width inside a container that can never fit it.
2. Assert a minimum usable width, not mere presence.
3. Run overflow checks on block-level elements.
4. **Open the screenshot and look at it.** Programmatic checks have passed
   on visibly broken layouts.
5. When a control matters, the assertion belongs in the automated suite,
   where it passes or fails, not in prose.

6. **Never verify on a fixed delay. Wait on real state.** Promoted here
   Round 10 after being restated in four consecutive round briefs and
   living nowhere permanent. Round 6 Phase 3 and Round 8 Phase 6 both
   recorded checks that resolved against the previous tab's content.

7. **Before waiting on a condition, state what it would look like if the
   action had NOT happened, and check it differs.** This is the operative
   test; "wait on something only the new state can satisfy" is the
   principle, and it gives no help on any specific condition. The
   counterfactual does, immediately and without knowing the feature:
   `#tb-display-name` exists either way; `dataset.stage === 'Qualification'`
   is already true from the previous record's panel; six `.tb-crit-box--met`
   exist either way, because that selector also matches the computed rows.

   Rule 6 is necessary and not sufficient: **eight probe faults across
   Round 10 Phases 5B and 6 passed it**, most being real-state waits the
   OLD state already satisfied. **Two of them briefly presented as product
   defects** - one as a cross-record data-binding fault, a second Test
   Bed's approval rows appearing bound to the first record's id, which
   would have meant approvals recorded against the wrong record; the other
   as a feature simply not working, the landing tab reading as the
   previous stage on all seven transitions. Both were the harness
   measuring mid-navigation. **Knowing this rule does not confer the
   ability to spot which conditions are stale-satisfiable** - four of the
   eight were written in the phase that promoted it. Apply the
   counterfactual; do not rely on recognising the shape.

   **A change that MOVES something is two claims, not one:** the thing
   appears in its new place, and the thing is gone from its old one. The
   second claim needs its own assertion and almost never gets one, because
   the natural evidence for a move is a screenshot of the destination, and
   a screenshot of the destination cannot show what is still sitting
   elsewhere on the page. **Assert the count: exactly one instance
   renders, not at least one.** Round 10 Phase 2 moved Summary, verified
   that it appeared in its new place, and shipped a duplicate that the
   business found - the first fault in this project to reach anyone other
   than the person who wrote it.

8. **Every Supabase call has its `error` checked, including upserts and
   any write whose result is not otherwise read.** An unchecked write
   returns success with nothing stored. Two confirmed instances of this
   exact shape: `PATCH /contacts/:id` and `PATCH /test-beds/:id` at
   Milestone 5, and the `document_details` upsert behind the document URL
   in Round 9 Phase 6. A read whose error is unchecked is at least
   visibly empty; a write whose error is unchecked looks like it worked.

9. An invariant not proven capable of failing is not evidence. Inject a
   real violating case, watch it fail, then revert.

10. **Layout is checked at 1240px, 1920px and 3440px, before and after.**
    Promoted here Round 10 after appearing in seven briefs and no
    permanent document. 1240 is where things break, 3440 is where a cap
    stops content using real width, and a before/after pair is what makes
    a layout claim checkable rather than asserted.

11. **Test fixtures are SOFT deleted, never hard deleted, and a
    `reference_number_counters` row is never deleted at all.** Promoted
    here Round 10 after four briefs restated it. `records` carries
    `ON DELETE RESTRICT` references from `record_revisions`, `approvals`
    and `audit_log`, so a hard delete is blocked or orphans history; and a
    counter deleted while a soft-deleted record still holds a code from it
    restarts and collides, which has happened. Confirm teardown by
    re-querying `deleted_at`, never by trusting the delete's own result.

---

## `CURRENT_STATE.md`

Generated by `scripts/state-dump.mjs`. Regenerated and committed at the end
of every round.

1. **Generated, never hand edited.** Carries a generation timestamp and the
   git commit SHA it was produced at.

   **Staleness test: the recorded SHA is an ancestor of `HEAD`, AND no
   tracked configuration source has changed since it.** Corrected here
   after Round 9 Phase 9.4. The rule previously read "a copy whose SHA is
   not current `HEAD` is stale", and **that check can never pass**: the
   file records the commit it was generated at and is then committed, so
   it can never name its own commit, and it was stale by its own rule the
   moment it was first written. A rule that always fails is worked around
   rather than followed, which is the reason Round 9 declined this as a
   merge gate.

       git merge-base --is-ancestor <recorded-sha> HEAD
       git diff --name-only <recorded-sha>..HEAD -- \
         supabase/migrations supabase/seeds src/routes

   **A changed source is not automatically staleness.** The generator
   parses source files from disk, so a file generated with uncommitted
   changes present already reflects them; the second half failing means
   check the content, by regenerating and diffing the configuration and
   source-parsed sections, not that the file is wrong.
2. **Records what is, never why.** Nothing regenerates an opinion, so a
   generated file carrying justification will drift.
3. **Every value read from the live database or by parsing the real source
   file.** Never restated from another document.
4. **No secrets, no client data.** No environment variables, keys or
   tokens. Records reported as counts by status, never by name or reference
   code. This file is uploaded into chat sessions.
5. **Tracked in git.** The diff between rounds is the configuration
   changelog.
6. **A round is not complete until it is regenerated and its diff
   reconciled against that round's phase list.** A change no phase accounts
   for is a finding.

---

## Documentation

Update `DESIGN_PRINCIPLES.md` **the moment** a decision changes during a
build, not in a consolidated pass afterward. Record supersessions with the
superseded reasoning left visible rather than deleted.

Record findings precisely whether or not they were the expected answer. The
value is in the record being trustworthy, not in it being tidy.

**When a round corrects or refines a rule that already lives in this file,
the correction lands in THIS FILE in that round, not only in the brief.**
Promotion into `CLAUDE.md` is currently one-way: a rule gets promoted, a
later round finds it imprecise, the refinement is written into that round's
brief, and the version here stays wrong. Both rules corrected in Round 10A
reached this state that way - the phase-count grep and the
`CURRENT_STATE.md` staleness test - and each had been followed literally in
the meantime, one producing an undercount and the other a check that could
never pass. **A brief is a record of one round; this file is what the next
session actually reads.**

**This file is delivered into each session as a snapshot taken at session
start, so a session following a round that edited it receives the old
version.** Re-read it from disk whenever the previous round's close-out
records a change to it, and treat the injected copy as a pointer to the
file rather than as its content.

---

## Output style

No em dashes in any written output, including code comments, commit
messages and documentation. Double hyphens are not a substitute. Rewrite
the sentence.

Sentence case throughout. Brand palette, typography and reference-code
conventions are in `DESIGN_PRINCIPLES.md`.
