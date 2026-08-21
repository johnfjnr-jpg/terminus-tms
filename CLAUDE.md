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

8. **Fix the class, not the instance the failure happened to name.** Round
   13 Phase 0, 2026-08-20, found by the next round rather than by the round
   that caused it. Round 12's final merge hit three failing invariants
   naming four orphaned `stage_gate_rules` rows left by a test run killed
   mid-flight. Those four rows were deleted, the suite went green, and the
   round was signed off on that basis. **The same killed run had also left
   six live `harness_*` records**, which nothing asserted against at that
   moment and which therefore went unnoticed for a full round, falsifying
   `CURRENT_STATE.md`'s own printed claim that "No harness record type holds
   a live row" the entire time.

   **The fix was scoped to what the assertion named rather than to what the
   event did.** A killed run leaves whatever it had created, not whatever the
   first failing check happens to mention. When residue is found, enumerate
   everything the responsible actor writes and check all of it, and re-assert
   the claims that depend on it rather than only the one that fired.

9. **Create the round branch before Phase 1 begins, and commit at every phase
   boundary.** Not at the close, and not when the first code change happens.

   **`main`'s working tree is never mid-round.** The dev server serves the
   frontend from disk and the API from the same tree, so an uncommitted round
   means whatever the business opens is whatever the current phase has
   reached. Round 17A ran eight phases that way for four hours, including a
   window where ten write paths had been edited and the server had not been
   restarted, so the browser was served new frontend code against old backend
   code. Nothing came of it because the business had finished for the day 55
   minutes earlier: timing, not design.

   **Per-phase commits are the recovery point.** Round 15 restored its edits
   after checking out `main` to compare, because the work had landing points
   to return to. **Round 14 lost work to that same manoeuvre even with commits
   in place**, which is the measure of how much worse it goes without them. A
   round with no commits has nothing to restore to, and any interruption costs
   the whole round.

   A phase that ships no diff still commits, even if only the brief: the
   branch should carry its own scope from the start.

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

9. **A destructuring parameter list is an allowlist that gives no feedback
   when it excludes something.** `function f({ a, b })` accepts a call
   passing `c` and silently discards it. The options object **reads as
   open-ended at the call site and is closed at the definition**, and the
   two are usually far enough apart that the caller cannot see it. Adding a
   key to a call is a no-op until the definition names it too.

   **The diagnostic signature: the failure output does not change at all.**
   Round 11 Phase 6 added a newly-mandatory column to three fixture calls
   and the suite failed **byte-identically** - same tests, same constraint
   name, same message - because `Fixtures.createRecord` destructured a fixed
   key set and built its insert from those names only. An unchanged failure
   after a change that looks correct is evidence **the change never reached
   the code path**, which is cheaper to test than any theory about the
   failure itself. Same family as a render call site hardcoding its own
   `opts` instead of spreading the field definition, twice recorded: the
   definition looks like the source of truth and the call site ignores it.

---

## Verification

1. **Layout: measure the container, not the element.** A card can report a
   healthy width inside a container that can never fit it.
2. Assert a minimum usable width, not mere presence.
3. Run overflow checks on block-level elements.
4. **Open the screenshot and look at it.** Programmatic checks have passed
   on visibly broken layouts. **Presence is not legibility, and no
   assertion can tell them apart.** Round 15 Phase 4 shipped a Cost
   summary card, whose whole purpose is that totals read first, with its
   totals in the dimmed treatment meant for the itemized rows a total is
   built from: the least prominent figures on the tab. Right place, right
   figures to the dollar, exactly one instance, no overflow, identical at
   all three widths. **Every check passed**, because every property a
   check can name was correct. For anything whose purpose is emphasis,
   ordering or prominence, looking is not a formality after the
   assertions; it is the only instrument that measures what the change
   was for.

   **Refined Round 17A Phase 3, 2026-08-21: "open the screenshot" assumes
   the screenshot contains the thing.** A clipped capture was taken of a
   region the element had scrolled out of, so the image was pure
   background, and **every programmatic check passed on it** because the
   checks were querying the live DOM while the picture showed nothing at
   all. A blank image is not a failed check; it is no check, and it looks
   like diligence. **Confirm the element is inside the captured region
   before treating the image as evidence** - scroll it into view, take the
   rect after scrolling, and sanity-check that the capture is not empty.
   Same family as Verification 12 and 13: an instrument that reports
   nothing reads exactly like a clean result.
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

    **Residue is every live record no person owns, not only `harness_*` rows
    and probe-owned ones.** Added Round 18A after eighteen rounds of true
    reports missed twenty-six live fixture records sitting in the business's
    own list views. Those two questions are shaped around
    `verify-harness.mjs`, which mints a synthetic `record_type` and owns its
    rows as a probe user. **A browser session driven by an interactive test
    account produces neither**: it signs in and calls the real API, so it
    leaves an ordinary record with an ordinary reference code, owned by an
    account that is neither a probe user nor the business. Ask which accounts
    are real people, and check for live records owned by anything else.

    **Enumerate what to tear down from the database, by a tag the fixtures
    carry, never from a file the harness wrote.** Round 15 Phase 4, a
    fixture rebuilt mid-phase overwrote the same `f4.json`, so the file
    named two records where four existed. Teardown would have reported a
    clean 2/2 and left an Account and a Test Bed live. A bookkeeping file
    records what you meant to create; a rebuild, a retry or a killed run
    leaves records it no longer names and no trace of having done so. Same
    shape as build discipline rule 8: cleanup scoped to what the record
    names rather than to what the actor did. Re-query the tag afterwards
    and confirm zero remain.

12. **A tool that returns empty rather than erroring produces output
    indistinguishable from a true negative.** Round 13 Phase 0, 2026-08-20.
    `scripts/state-dump.mjs` holds two literal NUL bytes at lines 500 and
    561, used as composite-key separators inside template literals. `file`
    reports the file as `data`, and **plain `grep` therefore matches nothing
    in it, silently and with exit status 1**, which is the same answer it
    gives for a pattern that genuinely is not there. Use `grep -a` on that
    file.

    **This nearly produced a published wrong conclusion.** Searching the
    generator for `scoring_criteria` returned nothing, and the reading that
    follows from that is "the generator does not record the scoring tables",
    which is false and was about to be reported as a finding. The real answer
    is the opposite: it records them and simply omits one column. What caught
    it was noticing that a file `head` could read was a file `grep` could not.

    **The general rule, which outlives this one file:** when a search returns
    nothing, the possibilities are that the thing is absent OR that the search
    did not run. Those are different, and most tools do not distinguish them
    for you. Before reporting an absence, confirm the search can find
    something you already know is there. Same family as Architecture rule 9,
    where a failure output that does not change is evidence the change never
    reached the code path.

13. **A count of zero from an instrument never shown to reach one is not a
    measurement.** Round 14 Phase 2, 2026-08-20. Asserting that something
    does not happen is asserting an absence, and an absence is what a broken
    probe reports too: a counter on the wrong object, a wrapper installed
    after the code path ran, a selector that matches nothing all read exactly
    like the clean result you were hoping for.

    **So the instrument has to be shown firing.** Phase 2 wrapped
    `requestChangeReason` and counted zero across six score paths, which is
    the claim. What made it evidence was running the same wrapper on
    Opportunity's Est. Close Date and reading one. **The positive case is not
    a bonus check, it is the thing that gives the zero meaning**, and it is
    usually available for free because the mechanism being removed still
    exists somewhere else.

    This is Verification 9 stated for absences rather than invariants, and the
    same family as Verification 12 and Architecture rule 9: **a tool that
    reports nothing, a search that never ran, and an unchanged failure output
    are all the same mistake wearing different clothes.** Where the positive
    case genuinely does not exist, say so rather than reporting the zero as
    though it had been calibrated.

14. **A check that passes when both sides are absent is not a check, and it is
    more dangerous than rule 13 because it reports success rather than
    nothing.** Round 14 Phase 4, 2026-08-20. The positive-case twin of the
    rule above: 13 is about an absence you failed to measure, this is about a
    match you never made.

    Phase 4 asserted that the reference code on screen equalled the reference
    code in the database. On two of three paths the record had not been
    created at all, so both sides were `null`, `null === null` was true, and
    **the probe printed MATCH for the two paths that had failed.** The other
    signals in the same output said the navigation had not happened, and the
    match line said it had.

    **The fix is to require both sides to exist before comparing them**, which
    costs one clause: `!!a && !!b && a === b`. The general form is that
    equality between two unknowns is not evidence of anything, and the same
    shape appears wherever a comparison can be reached with nothing to
    compare: two empty arrays, two undefined fields, two zero counts.
    **Compare presence first, then value.**

15. **A criterion expressed as a measurement at one viewport stops describing
    the thing it was written about.** Round 15 Phase 0, 2026-08-20. Round 8
    recorded Total Cost sitting 306px below the fold **at 1920**, named its
    levers, and carried it forward. Seven rounds then re-measured at 1920
    because that is where the number was first taken.

    **Measured again at every width, the criterion had inverted.** At 1920 the
    gap had closed by 228px, to 78px, and at 1080 it was gone entirely, both
    through changes made for other reasons: a sticky tab row and a grid that
    packed panels three across. **At 1240 it was 343px, worse than it had ever
    been recorded anywhere.** The problem had migrated to the narrower width
    while the criterion kept pointing at the wider one.

    **A number is not a criterion; the condition it stands for is.** Write the
    condition, and measure it wherever it can occur, which for layout is the
    three widths Verification 10 already names. A criterion that names one
    viewport will be re-measured there indefinitely, and will report progress
    on a problem that has moved somewhere else.

16. **Capture the run to a file, then search the file. Never pipe a run whose
    result is not yet known through a filter.** Write the full output to disk
    and grep the file.

    **This names a step to perform rather than a mistake to avoid**, which is
    the distinction Round 17A Phase 5 recorded after a rule caught its own
    author within the hour for the third time: knowing a rule confers no
    ability to spot its instances, so prefer rules that prescribe an action.

    **Three instances, and the middle one is the argument.** Round 12 lost a
    failure's identity to filtering. **Round 13 diagnosed `PGRST303` at seven
    sightings precisely BECAUSE it kept the output.** Round 17A lost a 49/50
    the same way Round 12 did, after the rule already existed in prose.

    **Round 18 Phase 0 identified that same failure on its first captured
    run**, before this rule was written down, which is what it costs to
    follow: one redirection.

    A filtered run that shows nothing is indistinguishable from a run that
    found nothing, and the moment you most need the output is the moment you
    have already discarded it.

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
