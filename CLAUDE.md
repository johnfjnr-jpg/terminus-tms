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
| `OPPORTUNITY_DESIGN.md` | What Opportunities is meant to become, and what is still undecided. Read for any Opportunity work |
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
   phases that were actually signed off**, not against the brief.
   Enumerate the sign-offs, then confirm each has a matching commit and
   that none is missing. Two rounds recorded a premature completion claim
   caught only by counting.

   **The brief is not a reliable source for the count, and searching it
   is worse than not searching it.** The rule originally read "check
   against the brief's own list" with `grep -n "^## Phase\|^### Phase"`.
   That has now failed seven consecutive rounds in five distinct ways:
   four briefs carried the phase list as a **table** and returned 0; one
   brief correctly carried **no list at all**, because the phases were
   produced in a Phase 0 report and signed off in conversation, and also
   returned 0; and two briefs returned **1** from a section heading
   *about* Phase 0 rather than a list of phases. **The 1 is the dangerous
   result**: a zero is obviously broken, and a plausible number is not.
   A round trusting it would have declared itself complete after Phase 0.

   The instrument works. In Round 26 it was calibrated three ways,
   including injecting `### Phase 99` and watching the count move and
   return. **The premise is what is false**: a phase list does not
   reliably live in a brief as headings.

   If a brief does carry phase headings, the pattern must include `###`.
   Round 10 split Phase 5 into `### Phase 5A` and `### Phase 5B`, and the
   narrow pattern returns 11 against that brief where the real count is
   13. A heading that is shared context rather than a phase is stated as
   such.

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

10. **A CONTROL FINDING DOES NOT AUTOMATICALLY OUTRANK THE QUEUE.** Set by
    the business 2026-08-29, and it is theirs to set.

    Round 38 ran eight-plus stretches of correctness and control work. Every
    one was justified, every one found something real, and the reshape - the
    only work in the round that makes the system pleasant to use - was
    deferred each time for a good reason.

    **That is how you end up with a rigorously controlled system nobody
    enjoys using, and you find out when the first real user arrives.**
    Terminus is pre-revenue with one user, and the controls now materially
    exceed the usability.

    **The standing order: the approving surface, then THE RESHAPE, and the
    reshape does not move again.** A control finding goes on the list unless
    it is **destroying live data**. Not "unless it is serious", not "unless
    it is a gate": destroying live data. Everything else is recorded, scoped
    and queued.

    Findings do not stop being worth reporting. This rule is about what
    happens next, not about what gets noticed. Report it, scope it, put it on
    the list, and carry on with the queued work.

    **The next finding will be tempting, and the answer is still the list.**

    **AND THE LIMIT OF THIS RULE, set by the business 2026-08-29, Round 39: A
    FINDING THAT YOUR OWN CHANGE CREATED IS PART OF THE CHANGE, NOT A NEW
    ITEM.** Rule 10 keeps UNRELATED findings off a round. It does not license
    closing a round whose own screen contradicts itself.

    The instance. Teaching the Deal Summary to say `GST, not recorded` left
    `Withholding Tax %` four lines above it still prefilling a 0, so one card
    carried a bright zero and a dim zero meaning a value and a placeholder.
    **That is worse than the uniform wrongness it replaced, and it is worse
    because of what the round did.** The mechanism already existed, so applying
    it to the two remaining rate keys was not new design.

    **The test is authorship, not severity or relatedness.** A defect the round
    introduced, or made visible by making its neighbour correct, is finishing
    the work. A defect the round merely walked past goes on the list.

    **AND THE LIMIT OF THIS RULE, set by the business 2026-08-29, Round 39: A
    FINDING THAT YOUR OWN CHANGE CREATED IS PART OF THE CHANGE, NOT A NEW
    ITEM.** Rule 10 keeps UNRELATED findings off a round. It does not license
    closing a round whose own screen contradicts itself.

    The instance. Teaching the Deal Summary to say `GST, not recorded` left
    `Withholding Tax %` four lines above it still prefilling a 0, so one card
    carried a bright zero and a dim zero meaning a value and a placeholder.
    **That is worse than the uniform wrongness it replaced, and it is worse
    because of what the round did.** The mechanism already existed, so applying
    it to the two remaining rate keys was not new design.

    **The test is authorship, not severity or relatedness.** A defect the round
    introduced, or made visible by making its neighbour correct, is finishing
    the work. A defect the round merely walked past goes on the list.

11. **AN UNANSWERABLE PRECONDITION IS A STOP, NOT A PROCEED-WITH-JUSTIFICATION.**
    Round 38 close, 2026-08-29. Recorded from a real instance, with both
    halves of the fault, because only one of them was mine.

    The business said: *"Answer both, then push."* One question - does a push
    to main trigger a Render deploy - **could not be answered from the
    repository at all**, because the setting lives in a hosting dashboard.
    The reasoning that followed was sound, the direction was the safer one,
    and no harm came of it. **It was still the wrong move.**

    **A precondition that cannot be satisfied has not been satisfied.** When
    the gate on an outward-facing act is a question you cannot answer,
    the answer is to say so and stop, not to answer the ones you can and
    proceed on the strength of them. The reasoning being good is exactly what
    makes this tempting: a bad argument would have stopped itself.

    **Scope: outward-facing acts.** Pushing, deploying, sending, publishing,
    anything that leaves the machine. For ordinary read-and-build work,
    proceeding under a stated assumption remains right and is the standing
    instruction.

    **THE OTHER HALF, and it is the business's own note: the instruction was
    badly formed.** It asked for something visible only in a dashboard nobody
    in the session could see. **A precondition has to be answerable by
    whoever it is set for**, and one that is not will be either guessed at or
    quietly dropped. Both parties own this: ask for what can be measured
    where the work happens, and refuse to proceed when what was asked cannot
    be.

    **RESOLVED 2026-08-29 at the Round 39 close, and the answer was that the
    question had no subject.** The standing consequence had been "assume Render
    auto-deploy is ON, so a push to `main` is a deploy". **Render was never set
    up: no deployment, no auto-deploy, no environment.** A push is a git
    operation.

    **The precondition was unanswerable for a reason neither party had
    considered: not because the setting was hidden, but because there was
    nothing for it to be a setting of.** "Hosted on Render" was a plan, recorded
    in the same voice as a fact, and it ran for two rounds.

    **That strengthens the rule rather than retiring it.** The correct move at
    the Round 38 close was still to stop, and stopping is what eventually
    produced the question that found this. **A precondition you cannot answer is
    sometimes evidence that the thing it describes does not exist**, which is
    only ever discovered by refusing to proceed without it.

    The rule stands unchanged for the next outward-facing act. What changes is
    that `main` is not a deploy target today, and the item that makes it one is
    at the head of package B in `DESIGN_PRINCIPLES.md`.

12. **A STANDING RULE ON PUSHING, so neither party spends a round trip on it.**
    Set by the business 2026-08-30, Round 40.

    **When the gate is green and the change is DOCUMENTATION OR RULES ONLY,
    push without asking.** Ask only for schema, calculator, or anything that
    changes what a user sees.

    The reasoning is the business's and it is about risk rather than ceremony:
    green work sitting unpushed is itself a condition to avoid, and treating a
    documentation commit like a migration manufactures that condition and calls
    it discipline.

    **This does not soften build-discipline rule 11.** An unanswerable
    precondition is still a stop, and a push is still an outward-facing act. What
    this settles is which pushes need a fresh decision and which do not.

13. **NO PUBLIC HOSTING OF TMS UNTIL SIGN-IN IS RESTRICTED IN THE APPLICATION.**
    Set by the business 2026-08-31, from a finding in the stage approvals phase.

    **The precondition, and every clause is required:**

    > An allowlist or domain check exists **in `requireAuth`**, is **mirrored in
    > RLS via the JWT email claim**, and is **proven by test**.

    **The finding it comes from.** `signInWithOAuth` passes no hosted-domain
    parameter, `requireAuth` verifies the JWT against the JWKS and checks nothing
    else, and `terminus_staff` has columns `id, name, title, created_at`: **no
    email and no `user_id`, so it does not link to `auth.users` at all** and
    cannot be an identity gate. `records_select` is `auth.uid() is not null`.
    **Any Google identity Supabase accepts would sign in and see everything.**

    **THE CONSOLE SETTINGS ARE MITIGATIONS, NOT THE CONTROL.** Today the exposure
    is bounded by three things that are all outside this repository: TMS runs on
    one laptop and is not published, the Supabase endpoints are reachable only
    with the anon key, and the Google OAuth consent screen is **External,
    publishing status Testing, with only the named test users**. Every one of
    those is a setting somebody can change in a dashboard without touching a line
    of code, and none of them is visible to a reviewer reading this repository.

    **`hd` on the OAuth call is a HINT ONLY.** It steers the account chooser and
    is not enforced on the token, so it is worth adding and worth nothing on its
    own.

    **THE ALLOWLIST LIVES AS DATA, NOT AS A CONSTANT.** The same reasoning as
    `track_approvers`: the moment a second address needs access the answer must
    change without a deploy. It has to admit both the staff domain and named
    individual addresses, because the walk accounts are neither.

    **Related to rule 11 and distinct from it.** Rule 11 is about a precondition
    you cannot answer. This is a precondition that CAN be answered, has been, and
    the answer is no.

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

   **A VALIDATION can go stale the same way, and that direction is not
   watched.** Round 30 Phase 2, 2026-08-25. All nine instances above are
   code built for a screen that then changed. This is a **rule built for a
   state that then changed**, and it is harder to see because the rule
   keeps running and keeps passing.

   The assessment panel required a reason on any revision, and tested it by
   asking whether the reason box was non-empty. That was correct for every
   caller it had, because the box was created empty on every revision. The
   same phase then **prefilled the box with the recorded reason**, which
   makes the test pass by construction: it fires on every save, reports
   satisfied every time, and no longer asks anything. **Nothing fails. No
   test breaks. The guard is gone and the output is identical**, which is
   the Architecture rule 9 signature arriving from the validation side.

   The replacement has to restate the intent rather than the symptom: the
   reason must **differ from the one already recorded**, because otherwise
   a new level is recorded carrying the reasoning given for a different
   level.

   **The check to run: when you change the state a rule reads, re-derive
   what the rule now asks, not whether it still passes.** A rule whose
   answer has become constant is indistinguishable from a rule that is
   working, and the passing case is the one you will see.

   **A HARDCODED CLAIM goes stale the same way and nothing can catch it,
   because a literal has no source to disagree with.** Round 31 Phase 0,
   2026-08-25. The third variant, and the sharpest: code built for a screen
   that changed is caught when the screen is exercised, a rule built for a
   state that changed is at least still running, but a sentence typed into
   the markup is not derived from anything and therefore cannot be
   falsified by anything.

   Round 21 Phase 5 wrote `No assessments configured for this stage.` into
   an Opportunity stage-tab card as a deliberate placeholder, and it was
   TRUE: nothing was configured. Round 25 Phase 2 configured
   `assessCommBudgetConfirmed` at Qualification and the sentence became
   false. It then sat on the screen for five rounds until the business read
   it and reported assessments as LOST. Nothing was lost; the card had
   never been wired to anything.

   **The signature is a container that is written and never read.** The id
   `opp-stage-assessments-<key>` appears exactly once in the repository, at
   its own creation, and `git log -S` returns exactly one commit whose
   subject is "placeholders". Two live cards beside it are empty `<div>`s
   filled by a loader; the two placeholders carry their text inline. **The
   difference between a slot and a lie is visible in four adjacent lines of
   markup**, and it is worth looking for whenever an empty state is
   reported as a defect.

   The same round found the pattern once more, in a comment: Round 21's own
   note describing the card row as "a 2-up grid at 1240 and 1920" measured
   as two columns at 1240 and **three** at 1920.

   **The check: a hardcoded statement about configuration is a claim with a
   shelf life. Prefer deriving it, and where it must be a literal, expect
   it to rot and re-read it when the configuration it describes changes.**

   **A MIGRATION CAN INVALIDATE A STRING, AND NOTHING IN THE CODEBASE CAN
   FLAG IT.** Round 33 Phase 2, 2026-08-26. The fourth variant, and the only
   one where the change and the thing it breaks are in different
   repositories of meaning: the first three are code built for a screen that
   changed, a rule built for a state that changed, and a literal that was
   true when typed. **This is a DATA ROW changing under a string that was
   correct when written.**

   `score-entry.js` refused a blank reason with `a reason is required at
   ${label}, naming what is missing`. That was true while exactly one scaled
   level required a reason, Unknown, where a gap is what a reason explains.
   A migration then set `reason_required` on a confirmation scale's
   **Confirmed** level, because the business wants the licence reference
   recorded, and the message began telling a scorer confirming a requirement
   to name what was missing.

   **No line of code changed. No test could fail. `git log -S` on the string
   returns the commit that wrote it and nothing since**, because nothing
   since touched it. The only trace is in a migration that never mentions
   the file.

   **The check: when a migration changes configuration that code branches
   on, grep the code for strings that describe the OLD configuration.** The
   branch itself will be correct, because it reads the data; the prose
   around it will not be, because it was written when the data said
   something else. `reason_required`, `is_terminal`, `required`, and any
   enum a message names in words are where this lives.


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

10. **A migration handed over for by-hand application carries its own ledger
   row, in the same file.** Set by the business 2026-08-29, Round 40. Applying
   SQL through the Supabase dashboard does NOT write to
   `supabase_migrations.schema_migrations`, so the schema and the ledger
   disagree from that moment and nothing in the application can see it: the
   ledger is not in `public`, so PostgREST does not expose it, and
   `CURRENT_STATE.md` reads the directory rather than the database.

   **ONE PASTE, TWO STATEMENTS.** Not a following note and not a reminder. The
   by-hand path cannot produce a mismatch when applying and recording are one
   action, and it produces one every time they are two and the second is
   remembered.

   ```sql
   insert into supabase_migrations.schema_migrations (version)
   values ('<this file's version prefix>')
   on conflict (version) do nothing;
   ```

   Safe under both paths, which is what lets it live in the file: by hand it
   records what the dashboard will not, and under `supabase db push` the CLI
   writes the row itself and the `on conflict` makes it a no-op.

   **The instance is the argument.** Round 40 reconciled the directory against
   the ledger for the first time since Round 9 and found 97 of 98 in sync - and
   the single mismatch was the migration written that hour, which drifted while
   both parties were reading about drift.

11. **A DEFAULT IS AN INITIAL VALUE, NOT A FALLBACK.** Set by the business
    2026-08-30, Round 41, and it is the permanent closure of the recovery-period
    finding.

    > A default is **written into the field when the deal is created** and never
    > consulted again. If the user clears the field, **the field is empty and the
    > sheet says the value is not recorded**. It does not quietly reappear.

    **Without this rule a default is a coercion with better manners.** The
    instance: `recoveryMonths` had a `NUMERIC_DEFAULTS` entry of 0 and the
    calculator read `recoveryMonths || 0`, so a blank field priced a two-phase
    deal at zero months of hardware recovery. `$492,858` of hardware revenue was
    never invoiced, closing cash was `-$275,556`, and achieved margin still read
    30.0% because margin is computed on `contractNet` and never asks whether a
    penny of it is collected.

    **THE TWO READINGS OF "DEFAULT" DIFFER BY LOCATION.** Corrected by the
    business 2026-08-30 from a first draft that rested on visibility, which is
    the wrong property:

    > **An initial value lives in the RECORD. A fallback lives in the
    > CALCULATION.**

    **And it is a fact about creation rather than about every read**, which is
    the half that makes it testable: an initial value is written once and can be
    cleared and stay cleared, so the not-recorded path is reachable at all.

    **Visibility follows from location rather than defining it.** Something in
    the record is on the screen and in the version because that is what a record
    IS. Something in the calculation can be shown or hidden and is wrong either
    way.

    **The counter-example that settles it: a VISIBLE fallback is possible and
    still wrong.** Leave the field empty and render "not set, using 24 months"
    beside it. Honest, readable, and the calculation still runs on a value the
    user did not choose. **A version would then freeze an empty field alongside a
    computed 24**, which is ambiguous at exactly the point where somebody
    approves a price.

    **Consequences, and each is part of the rule rather than a detail of it.** A
    default does not reach records created before it. Changing a default does not
    touch a saved version, which freezes the value and whether it was default or
    override. And a cleared field is a state the screen must be able to SAY, not
    merely tolerate.

    Same family as Verification 20's addendum, read and write must agree about
    absence, from the configuration side: here the writer is a default and the
    disagreement is with the field's own emptiness.

12. **A DEFINER FUNCTION DERIVES; IT DOES NOT ACCEPT.** Set by the business
    2026-08-31, Round 41, from two migrations in the same afternoon.

    > **A `SECURITY DEFINER` function derives IDENTITY and RECORD STATE for
    > itself - `auth.uid()`, the record's own stage, its own current revision -
    > and never takes them as parameters. A parameter is the CALLER'S CLAIM, and
    > the caller is who the rule constrains.**

    **Two origins, and the second only became visible because the first had
    already been fixed.**

    **`p_approver`, in `20260831000004`.** `decide_transition_request` took who
    was approving as an argument, and enforced "the requester may never approve
    their own request" against it. Measured with the publishable key and a real
    user's JWT: the function was callable directly, so the argument was whatever
    the caller said it was, and the rule was decoration. It now reads
    `auth.uid()` and the parameter is gone rather than merely ignored.

    **`from_stage` and `frozen_revision`, in `20260831000005`.** A transition
    request carried the stage it was raised from and the revision it froze, both
    supplied by the caller. A fabricated pair produced a request that **looked
    entirely normal to an approver**, so three people approved in good faith and
    the record moved without its exit criteria ever being asked. The raise
    function now reads both from the record.

    **THE TEST IS WHETHER THE PARAMETER IS ABOUT THE CALLER OR ABOUT THE WORLD.**
    `p_track` and `p_decision` are the caller's business and are correctly
    parameters: they say what the caller wants. `p_approver`, `p_from_stage` and
    `p_frozen_revision` were the caller ASSERTING FACTS the database already
    holds, and a fact the database holds must be read, not accepted.

    **AND A DEFINER FUNCTION IS EXACTLY WHERE THIS BITES**, which is why the rule
    names them. A function running as its owner has the privilege to act on what
    it is told; a route running as the user is bounded by RLS whatever it
    believes. **The more powerful the executor, the less it may take on trust.**

    Same family as Verification 20, two readers of one value, with the twist that
    one of the two readers is the person the rule is about.

---

## Verification

### The index: when each check fires

**Added at the Round 39 close, on the business's instruction. Grouping sits
ABOVE the numbers, not instead of them, because rounds cite the numbers.**

Read the group whose moment you are at. The collapse measurement that produced
the first group is recorded in full further down, under the index task.

**BEFORE WRITING** - Architecture 8, 9; Verification 20, 22, 23
A migration asserting a derived value names every reader of it and says what the
asserted value tells each one (20).
Correct for every caller that exists is not correct for the caller about to be
built. A destructuring parameter list silently discards what it does not name.
Read through the accessor the authoritative consumer uses. Name what reads a
required field. Search for an existing decision about the same behaviour before
taking a new one.

**BEFORE TRUSTING A NULL OR A GREEN READING** - Verification 12, 13, 17, 25, 39
collapse into one:

> Before trusting a null reading, make the instrument produce a non-null one on
> the system under test, ON THE SAME POPULATION you are about to make the claim
> about.

Three that do NOT collapse into it and fire at the same moment: **Verification 14**,
require both sides to exist before comparing them; **Verification 18**, do not
stop at the first fix, because a calibration that does not move the number has
failed to run rather than passed; and **Verification 39**, strip comments before
matching, because a green reading from a source scan can be supplied by prose.

**BEFORE MAKING A CLAIM** - Verification 19, 24, 26. One trigger, three actions,
and they stay three rules: enumerate every member of a category and check it
against the name (19); write one test passing a value different from the default
(24); treat the clause after "so" or "which means" as a separate claim (26).

**BEFORE MEASURING A LAYOUT** - Verification 4, 6, 7, 10, 15, 27, 28
Wait on real state, never a fixed delay, and state the counterfactual first.
Three widths, before and after. Open the screenshot and confirm the element is
in it. State the measure as something the PERSON experiences. Measure two
changes to one surface alone AND together.

**BEFORE CHANGING WHAT A MISSING VALUE DISPLAYS** - Verification 20's addendum
Find what WRITES it and confirm the two agree. A form default, a prefill, an
`?? 0`, a `COALESCE` and a column default are all writers.

**BEFORE DELETING OR TEARING DOWN** - Build discipline 8; Verification 11
Fix the class, not the instance the failure named: enumerate everything the
responsible actor writes. Soft delete, enumerate from a tag in the database
rather than a file the harness wrote, and re-query afterwards.

**BEFORE SUPERSEDING A DECISION** - Verification 29, 23
Record what each option's stated advantage DEPENDS ON. A premise that fails
means the decision is re-taken, not re-weighed, and the superseded reasoning
stays visible.

**BEFORE WRITING A SCRATCH OR BACKUP ARTEFACT** - Verification 44
Key on the full path, not the basename. This repository mirrors names across
src/lib and src/routes on purpose, and a harness restored the routes file over
the lib file.

**BEFORE SHOWING AN APPROVAL OR GATE STATE** - Verification 43
Name the function the enforcement calls, and confirm the panel calls it too.
Three instances: the exit-criteria gate, the version bridge, the stage panel.

**BEFORE TREATING A WALK DEFECT AS LIVE** - Verification 42
Hard reload, then re-observe, and say so in the report. Two of the fourth walk's
three findings were code that had already been fixed.

**BEFORE SUPERSEDING A ROUTE** - Verification 41
List every frontend caller of the old route in the report, with a disposition
each: removed, refused, or kept-and-why. And make the old route refuse, because
callers are found by looking and a refusal is found by testing.

**BEFORE CALLING A BOUNDARY GREEN** - Verification 40
Every route the boundary added OR MODIFIED is exercised from outside over HTTP,
as the signed-in user, on the SUCCESS path, asserting the new behaviour rather
than the status. A gate made of refusals is satisfied by a route that refuses
everything.

**BEFORE AN OUTWARD-FACING ACT** - Build discipline 9, 10, 11
Commit at every phase boundary. A control finding goes on the list unless it is
destroying live data, and its limit: a finding your own change created is part
of the change. An unanswerable precondition is a stop.


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

   **A fixed delay does not only produce a wrong answer. It produces
   AGREEMENT, which is worse, because agreement is what a passing check
   looks like.** Round 32 Phase 1, 2026-08-25. A Test Bed comparison
   captured each page 600ms after its load condition and reported
   before-equals-after at two of three widths, which was read as a clean
   result. Four captures of ONE unchanged tree then differed: the first
   was 22KB smaller than the other three, because content was still
   arriving and the shutter caught a race.

   **So the two matching widths were not a weaker result, they were no
   result.** Two unstable readings that happen to agree are
   indistinguishable from two stable ones, and the instrument gives no
   sign which it produced. Re-run against a settled condition, the third
   width's hash changed too, which means all three earlier readings had
   been mid-render.

   **The check to run before trusting any before-and-after: capture the
   same unchanged tree twice and confirm the two agree.** An instrument
   that cannot reproduce itself cannot compare anything, and this costs
   one extra capture.

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

9. **An invariant not proven capable of failing is not evidence**, and
   **AN OPERATION'S OWN SUCCESS LINE IS NOT CONFIRMATION EITHER.** Round 40,
   2026-08-30, and it is kept for what has teeth rather than for what happened.
   `SendUserFile` returned "2 files delivered to user", nothing arrived, and I
   quoted that line back to the business as confirmation. **The author of the
   rule about operations reporting success without verification did exactly
   that, in the same session as writing it, and neither party checked.** As "a
   send failed" it is worth nothing; as "the person who knew the rule best was
   the one it caught" it is worth keeping. **`SendUserFile` is not repository
   tooling** - the class is general, the instance is external, and there is no
   bug in this codebase to go looking for.
   "invariant" means EVERY DETECTOR: a test assertion, a probe, a scan, a
   generated column, a hook. Anything whose job is to notice. Broadened at the
   Round 40 close, where the business put it as **a detector that has never
   fired is an assertion, not a control**, and the register of which of this
   project's detectors are unproved is under rule 38. Inject
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

17. **A probe that distinguishes two states must be shown returning a
    different value in each, on the actual file or system under test.**
    Promoted Round 19, 2026-08-22. A probe can be well formed, run cleanly,
    and still be unable to tell the two states apart, in which case it
    reports the answer you wanted for a reason unrelated to the truth.

    Two instances in one round of documentation work, which is the
    lowest-stakes setting available:

    - **A substring that cannot fail.** Phase 2 asserted that a superseded
      sentence was gone using `free text**, unchanged from their original`.
      That is a substring of its own replacement, `built as free text**,
      unchanged from their original`, so it returns 1 whether the edit
      worked or not.
    - **A marker shared with everything else.** Phase 3 asserted that
      Finding 6's `FINDING, UNRESOLVED` was gone and read 7, because six
      other findings and the status legend carry the same marker.

    A probe can also be specific, unique and correct and still fail to
    discriminate because the tool's granularity does not match the thing
    measured, as when a line-based search targets text wrapped across a
    line break, which returned 0 for a retained sentence in Round 20 Phase 1.

    A distinct species: a probe that discriminates perfectly but is shown
    only part of the population, as when a paged API silently caps a scan
    at its default limit, so confirm the query is evaluated over the WHOLE
    population rather than only that it returns different values, since a
    calibration string inside the returned page passes the guard while the
    scan stays blind to the rest (Round 20 Phase 8 read 1000 of 8237
    `record_revisions` rows and reported a residue count of zero).

    **The check: run the probe against a state you know differs, and
    confirm the value changes.** Cheapest forms are a known-present and a
    known-absent string on the same file, a before and after delta, or
    reinstating the thing you removed and watching the probe fire.

    **Distinct from 13 and 14, and the boundary is worth holding.** Rule 13
    is an absence from an instrument never shown reaching one, and its
    remedy is to find a positive case elsewhere. Rule 14 is a comparison
    reached with nothing on either side, and its remedy is to require both
    sides to exist. Both assume the instrument, once firing, measures the
    right thing. **This is the case where it fires correctly and measures
    the wrong thing.** The substring probe was present, non-empty, and
    structurally incapable of separating pass from fail, so `!!a && !!b`
    does not help and a positive case looks identical to the failure.

    Rule 12 is the nearest neighbour and prescribes calibrating a SEARCH
    that may not have run. Both instances here are searches that ran
    perfectly against the wrong thing, which is why this is a separate
    number rather than a sentence inside a rule about `grep -a`.

18. **One green result can have more than one independent cause, and fixing
    the first reveals the second rather than the answer.** Round 32 Phase 2,
    2026-08-25. Second instance after Round 28 Phase 6, and the first with
    three.

    A Test Bed comparison reported identical before and after. It was blind
    three ways, and **each was invisible until the previous one was fixed**:

    - It ran on the record's Reference tab, which holds **zero
      `.tb-crit-row` elements**, so it could not have exhibited the
      regression it existed to rule out. The claim was about a rule
      affecting those rows.
    - Moved to a stage tab, its calibration injected 14 nodes and **the
      pixel hash did not move**, because the injection had landed on a
      hidden element. The pixel dimension had never been shown reaching a
      different value.
    - Calibrated on a visible row, the injection grew the card by 148px and
      **the 1240 hash still did not move**, because that page scrolls an
      inner container, the card sits below the fold at that width, and
      `fullPage` captures the viewport.

    Only after all three did the instrument discriminate at every width, and
    the answer was unchanged: before and after really were identical. **The
    result was right the whole time and none of the three readings that said
    so had been evidence.**

    **What generalises is the order.** A green result is not one claim, it
    is a conjunction: the probe ran, it ran on a page that can exhibit the
    fault, it measured a dimension that can move, and it saw the region the
    change is in. Rules 12, 13, 14 and 17 each name one of those failing.
    **This is the case where several fail at once**, and the sign is that
    fixing one changes nothing about the output. **A calibration that does
    not move the number has not passed; it has failed to run**, and the next
    thing to check is whether the instrument can see the thing at all.

19. **A CATEGORY NAME IS A FINDING AND NEEDS THE SAME EVIDENCE AS ONE.**
    Round 38, 2026-08-29. Three claims in one round, all of them labels, all
    of them false, and none of them found by re-reading:

    - **`APPEND_ONLY`**, a symbol naming six revision writers as safe because
      they only ever added. All six were single-key read-modify-write: a value
      read in one round trip, rebuilt in JavaScript, written back. The worst
      was the deal snapshot, which took the record's WHOLE payload from an
      earlier read and re-stamped it over every key, so a concurrent write to
      any key was lost entirely. It carried the append-only label for a round.
    - **"every Test Bed and every Account belongs to a different owner, so
      those routes answer 403 before reaching the write"**, written into a
      test file as the justification for a source scan. It was a description
      of the DATA phrased as a permission boundary. Measured, the test account
      creates its own Account and Test Bed, owns both, and writes to both.
      Nothing stopped it. There was no fixture that made one.
    - **The unwired census**, "the four client-unwired sites". There were
      five, two of which were fallback branches rather than sites, and wiring
      them properly reached thirteen client call sites and a defect on a
      fourteenth that no label had ever named.

    **The mechanism is that a label is read as a summary of work already
    done.** A finding gets challenged; a category name gets used. Nobody
    greps for a claim inside a symbol, a bucket, a status enum or a comment
    that explains why a check is scoped the way it is, so a name that was
    approximately right when coined stays in place while the thing it names
    moves. This is the same family as Architecture rule 9's fourth variant, a
    literal that cannot be falsified, and the difference is that a label is
    load-bearing: code branches on it and people reason from it.

    **The check: when a name asserts a property, measure the property.**
    Enumerate every member of the category and check each against the name,
    the way you would check a finding before reporting it. All three above
    took one pass of reading the actual call sites, and all three had
    survived multiple rounds of people reading the label instead.

20. **A SECOND READER OF THE SAME VALUE ALWAYS DRIFTS.** Round 38,
    2026-08-29. Sibling to rule 19: that one is a claim written into a name,
    this one is a claim written into an access path. Five instances, all in
    one round, all found by measurement rather than by reading:

    - **Three modules each held a private revision number** for one
      Opportunity. `loadOpportunityDetail` does ONE GET and hands the same
      record to all three tabs, so they were the same number written down
      three times, and an exit-criterion tick left Commercials holding a
      number the record had already left.
    - **Five copies of `warrantyPct` and three of `targetMargin`** across the
      tab, each reading the DOM or the payload its own way.
    - **`BRIDGE_KEYS` was a `Set` built at module load** from a definition
      that can change, so a calibration that changed the definition could not
      move it and the check it fed reported a clean result.
    - **Two goldens that both claimed to agree.** The server's copy of
      `buildDealInputs` carried a comment saying it was "kept identical" to
      the client's. They were, on all eight shapes measured, which is the
      benign end of the same shape and is not a reason to keep two.
    - **`factoringRatePct` read flat where it lives nested.** The approval
      page read `payload.factoringRatePct`; the calculator reads
      `payload.factoring.ratePct`. The page therefore told every approver
      "nobody entered a value" for a deal that had set it.

    **The last one is the worst and the least visible**, because both readers
    were correct in isolation. Nothing was broken; two paths simply disagreed
    about where a value lives, and only one of them was ever exercised
    against real data.

    **The rule: read through the accessor the authoritative consumer uses,
    never a second one written alongside it.** Where a second path is
    genuinely needed, it names why in the code and is PROVEN equal to the
    first by a test, not asserted equal by a comment. "Kept identical to" is
    the phrase that marks an unproven one.

    **AND A HAND-TYPED NUMBER IS A SECOND READER OF A COMPUTED VALUE.** Round 39
    close, 2026-08-29, set by the business, and it is **the least obvious instance
    of this rule so far**, because the "second reader" is a person writing prose
    rather than a second code path.

    A commit message said **217 pass** while the suite said **216**. The gap was
    not a typo. **Six new tests were not in the suite at all**, because the one
    line adding them to `package.json` had never landed, so the commit claimed a
    green suite that did not include the tests it was adding.

    **The count mismatch is the only thing that surfaced it**, and that is the
    argument for this rule rather than tidiness: had the two numbers agreed by
    luck, six tests would have sat unrun indefinitely with every message saying
    the suite was green.

    **The remedy is rule 20's, not a new guard: ANY NUMBER DESCRIBING A RUN IS
    EMITTED BY THE RUN, NEVER TYPED.** Test counts, timings, row counts.
    `scripts/verify-all.mjs` now prints `222/222 pass, 0 fail` beside each suite
    stage, parsed from that stage's own output, so a message quotes the gate
    rather than restating it.

    **It closes the neighbouring failure as far as it can be closed**, and the
    limit is honest rather than papered over: a script that never ran produces
    no number to quote, and nothing in the repository can catch an intention
    that was never expressed.

    **A display surface never invents its own read.** The approval page
    reads every deal value through the same readers `buildDealInputs` uses,
    so a value it reports as unset is unset by the calculator's own
    definition.

    **AND READ AND WRITE MUST AGREE ABOUT ABSENCE, OR MAKING IT VISIBLE ONLY
    MAKES IT VISIBLE ONCE.** Round 39, 2026-08-29, set by the business. Rule 20
    is two readers of one value; this is a READER AND A WRITER holding
    different definitions of "not set", and the writer wins on the first click.

    406 of 467 opportunities carry no `gstPct`. New rows were built to render
    that as `not recorded` rather than as a confident GST-free price. The entry
    box still did `setVal('deal-gstPct', p.gstPct ?? 0)`, so **opening any of
    those deals filled the box with a rate nobody had entered, and the first
    save RECORDED one**, destroying the absence the new rows existed to report.
    The display would have been right exactly until somebody used the screen.

    **The check: after changing how a missing value is DISPLAYED, find what
    WRITES it and confirm the two agree.** A form default, a prefill, an
    `?? 0`, a `COALESCE` and a column default are all writers. Where a screen
    both shows and edits a value, the round that teaches it to say "not
    recorded" is the round that has to stop it quietly recording something.

    **AND AFTER REMOVING A CONTROL, FIND WHAT IT WROTE.** Round 40 Phase 1,
    2026-08-29, and it is the sharpest instance of this corollary because it is
    the one that would have cost DATA rather than credibility.

    **A control that edits a value is also what SUPPLIES it on save.** Deleting
    the control therefore turns "unchanged" into "empty" wherever the payload is
    rebuilt from the screen, and the record reads empty as deletion.

    The instance. Phase 1 removed the eleven per-line margin inputs, correctly
    and on the business's instruction. `marginOverrides` is in
    `COMMERCIALS_OWNED_KEYS`, so it is sent on EVERY save, and `readPayload`
    built it by reading those eleven boxes. **With the boxes gone it would have
    sent `{}` and deleted the overrides on 33 opportunities at their first
    save.** Nothing would have errored. The screen would have looked right.

    **The screen's absence became the payload's absence**, which is this
    corollary exactly, arriving from the direction nobody watches: not a default
    filling in a value nobody entered, but a removal emptying a value somebody
    did.

    **AND AN ASSERTION ABOUT A VALUE IS NOT AN ASSERTION ABOUT ITS READERS.**
    Round 41, 2026-09-03, and it is rule 20 arriving from the SCHEMA side.

    `20260902000004` taught `required_tracks_for` to exclude version-scoped
    rules, correctly, and carried a self-check proving it: *"Proposal must
    collect no tracks under the version gate."* **The assertion was true, it
    passed, and it was the defect.** `decide_transition_request` reads that same
    array and treats it as the set of tracks a decision may name, regardless of
    the request's kind, so an empty set meant NO TRACK MAY BE APPROVED and no
    authorised approver could approve a pricing approval at all.

    **Four readers of one derived value. Three branched on kind or scope and the
    SQL did not.** The migration proved the number and nobody asked what the
    number would MEAN to somebody else holding it.

    **The check: when a migration asserts a derived value, name every reader of
    that value and state what the asserted value tells each one.** A self-check
    that proves a set is empty has proved nothing about whether empty is
    survivable. The replacement asserts the two sets are DIFFERENT across all
    four combinations of kind and stage, which is what the first could not see.

    **AND THE SECOND HALF WAS THE SAME FAULT ONE LAYER DOWN.** The staleness
    check in the same function was not kind-aware either, so with the track
    check corrected the FIRST ORDINARY EDIT made a pricing approval undecidable
    - on a feature whose entire point is that it does not freeze the record.
    Found only because the probe for the fix was calibrated on the real
    population, and folded into the same migration before it was applied.

21. **A RECONCILIATION THAT CANNOT FAIL IS NOT A RECONCILIATION.** Round 38,
    2026-08-29, on the approval page's bridge.

    A displayed bridge shows figures rounded for reading, so the parts do not
    quite sum to the whole and a "rounding" line carries the difference.
    Computed as closing minus the sum of the steps, **that line is a plug: it
    absorbs whatever does not fit, including a real defect, and the column
    still balances.** A page that always adds up is telling you nothing about
    whether it should.

    **The check: state the tolerance the rounding can legitimately reach, and
    refuse to reconcile above it.** With figures at two decimals and N steps
    plus an opening and a closing, no more than `(N + 2) x 0.005` can come
    from rounding. A larger number is not rounding; it is an error wearing
    its label, and the page must say the bridge does not reconcile rather
    than printing it.

    Same family as Verification 9: an invariant not proven capable of failing
    is not evidence. This is the case where the invariant is arithmetic that
    was constructed to hold.

22. **A REQUIRED FIELD WITH NO READER BECOMES CEREMONY.** Round 38,
    2026-08-29, on the Deal Sheet version reason.

    The reason was required at three layers - a `not null` with a length
    check, a route returning 400, and a client refusal that focuses the box -
    and read in exactly ONE place: a caption under a row in a list. Nothing in
    `approvals` read it. Nothing else read it at all.

    **That is not a harmless imbalance. A field that must be filled and is
    never read teaches the person filling it that the content does not
    matter**, and the content is what the requirement was for. Somebody types
    "initial pricing" on the first version and "update" on the tenth, and the
    field goes on passing every check it has.

    **Two halves, and both are needed.** Giving it a reader is what makes the
    requirement honest: the approval page now renders the reason as prose
    beside the bridge showing what moved, so a reason that disagrees with the
    figures is visible to the person signing. And the PROMPT CHANGES BY
    CONTEXT, because a question with one answer gets a rote answer: a first
    version asks what the price is based on, a subsequent one asks what
    changed and why. Same field, two questions, because they are two
    questions.

    **The check: for every required field, name what reads it.** If the
    answer is a list view or nothing, either give it a reader or stop
    requiring it. And where the same field is required in genuinely different
    situations, ask the question that situation actually poses.

    Related to Architecture rule 9's fourth variant from the other side: that
    one is a message that stopped being true, this is a field that never had
    to be.

23. **TWO CORRECT DECISIONS ABOUT THE SAME QUESTION, TAKEN IN DIFFERENT
    ROUNDS, PRODUCE A CONFLICT NOTHING DETECTS.** Round 38, 2026-08-29.

    Rule 20 is two readers of a value. **This is two rulings on a rule**, and
    it is worse, because each ruling is defensible on its own terms and the
    disagreement lives in the space between them where no file sits.

    **The instance.** Round 7 made Opportunity approval rules `scope:
    'stage'`, so an approval survives every revision. That was a correct fix
    to a real defect: revision-scoped approvals were invalidated by editing
    any field, which re-enabled the control and recorded a duplicate approval
    per edit. Round 38 then decided that an approval is of a VERSION and any
    revision after it voids it, because otherwise an approval means
    "something was once approved", which looks like control and is not.

    **Both shipped. Both read the same `approvals` table. Neither knows the
    other exists.** Measured on the live data: one Opportunity carried four
    Commercial approvals and three of them described prices that had already
    moved, while the gate read green. A green gate is a positive claim in the
    record that a named person accepted this price, which is worse than no
    gate, because no gate is an absence people work around.

    **Nothing could have caught it.** No test failed. Neither decision is
    wrong where it was made. The conflict is only visible to somebody holding
    both at once, and the two were written a round apart by people who never
    met.

    **The check, and it is cheap: BEFORE DECIDING HOW SOMETHING BEHAVES,
    SEARCH FOR AN EXISTING DECISION ABOUT THE SAME BEHAVIOUR.** Grep the
    configuration and `DESIGN_PRINCIPLES.md` for the concept, not for the
    word you are about to use: `scope`, `expires`, `valid`, `supersede`,
    `stale`, `required` are all places a previous round may already have
    ruled.

    **And the fix is deletion, not reconciliation.** Changing one decision to
    agree with the other leaves two mechanisms that agree today and drift
    later, which is rule 20 arriving at design level. One of them has to
    become a caller of the other.

24. **A DEFAULT MAKES A PARAMETER INVISIBLE, SO EXERCISE IT WITH A SECOND
    VALUE.** Round 38, 2026-08-29. A method rather than a warning, in the
    spirit of Verification 16: it names a step to perform.

    `versionApprovalState(version, approvals, latestRevision, track =
    APPROVAL_TRACK)` gained a `track` parameter so one evaluator could serve
    every approval track. The parameter was threaded through the signature,
    through the caller, and through the caller's caller. **One filter inside
    still read the hardcoded `APPROVAL_TRACK`.**

    Every test passed. Every call in the application passed. The default is
    `'Commercial'` and every existing caller wanted Commercial, so the
    parameter and the constant agreed on every path that ran, and the
    parameter was decorative without being wrong anywhere.

    **It was found by writing a test that used the parameter for something
    else** - one assertion asking whether a Legal approval satisfies a Legal
    rule. That test had no other purpose; the behaviour it checks is not
    needed today.

    **The check: when you add or generalise a parameter that has a default,
    write one test that passes a value DIFFERENT from the default.** Not for
    coverage, and not because that value is needed: because the default is
    what hides an incomplete change. Same family as Verification 17, a probe
    that cannot distinguish two states, with the twist that here the two
    states are "the parameter is used" and "the constant is used" and they
    are identical until somebody asks for the other value.

    Generalises past parameters: any defaulted thing - an options key, a
    config column with a default, an enum whose first member is assumed -
    hides an incomplete change until a second value exercises it.

25. **A COUNTER THAT HAS NEVER BEEN SEEN TO INCREMENT IS NOT A MEASUREMENT.**
    Round 38, 2026-08-29. **A zero is evidence only once the instrument has
    been shown capable of producing a non-zero.**

    `retryOnClockSkew` wrapped an OPERATION and was applied to exactly one
    call in a suite of hundreds. The budget test at the end of the run
    printed `retries this run: 0` and passed **in the same run the suite
    failed on PGRST303**, at a query the wrapper had never covered.

    **The zero was not wrong about its own path. It was wrong about the
    question anybody was asking it.** "Is the platform still skewing?" was
    answered by an instrument pointed at one insert, and a budget that covers
    almost nothing reads exactly like a platform that has settled down.

    **The check, before any clean reading is quoted at anybody: make the
    counter move.** Not in principle, not on a synthetic path - on the code
    under test, in a way the suite actually exercises. If you cannot make it
    move, you do not yet know what it measures.

    Distinct from Verification 13, which is about an absence you failed to
    measure, and from 17, which is about a probe that fires and measures the
    wrong thing. **This is a probe that measures the right thing on far too
    small a population**, and the population is invisible in the output. The
    remedy is different too: 13 wants a positive case found elsewhere, 17
    wants a calibration, and this wants the instrument moved to where the
    thing it measures actually happens. A skew is a property of the
    connection, so the retry belongs on the transport, which deletes the call
    sites rather than listing them.

    **COROLLARY, THE SAME RULE APPLIED TO A PROCEDURE RATHER THAN A COUNTER.
    Round 39, 2026-08-29, set by the business. A RECOVERY PATH THAT HAS NEVER
    BEEN EXERCISED IS NOT A RECOVERY PATH, IT IS A PLAN.**

    `refresh-session.js` printed "Use: `scripts/sign-in.js <email>
    <password>`" when the refresh token had expired. `sign-in.js` only ever
    PRINTED an access token. `session-ref.json` was written by exactly one
    file, `refresh-session.js` itself, which needs a live refresh token, which
    is the one thing that has just been established as dead. **The recovery
    step could not restore the file it existed to restore**, and nobody knew,
    because until the rotation after the committed credential nobody had ever
    needed it.

    **Found by accident, which is how every unexercised recovery path is
    found**, and the accident was cheap this time because the thing lost was a
    dev session rather than data.

    **On the list, and it is the general form: enumerate every recovery path
    in the system and exercise each once, BEFORE there is real data to lose.**
    Migration rollback, fixture teardown after a mid-run failure, restoring a
    deleted record, rebuilding the database from migrations on an empty
    project. **Each of those currently exists as an intention.** A zero is
    evidence only once the instrument has produced a non-zero, and a recovery
    is a procedure only once it has recovered something.

    **AND "RUN EACH ONE ONCE" UNDERSELLS IT. Set by the business 2026-08-29,
    after the path above finally worked.** `refresh-session.js` succeeded for
    the first time in its life only because a credential rotation had forced a
    fresh sign-in, which minted a live refresh token. **Before that the path was
    only ever reached in the failure state, and in the failure state its own
    prerequisite was already gone.**

    **That is the general reason recovery paths stay untested, and it is not
    neglect.** Waiting for the real failure tests nothing, because the real
    failure is usually the thing that destroyed what the recovery needs.

    **So exercising a recovery path means CONSTRUCTING THE FAILURE DELIBERATELY
    WHILE PRESERVING WHAT THE RECOVERY NEEDS.** Expire the access token but keep
    the refresh token. Kill a run mid-flight but keep the tag its fixtures carry.
    Drop a table on a copy, not on the one holding the migration ledger. The
    construction is the work; running the script afterwards is the easy part.

26. **A STRUCTURAL FACT STATED AS A BEHAVIOURAL CLAIM.** Round 39 Phase 0,
    2026-08-29. The brief for a whole round rested on one sentence, and half
    of it had been measured while the other half never had.

    > "The Deal Sheet sits on a sub-tab of its own, **so the number cannot be
    > seen at the same time as any input that changes it.**"

    **The first clause is a structural fact and it is true.** The Deal Sheet
    does sit on its own sub-tab. **The second clause is a behavioural claim
    inferred from it, and it is false**: achieved margin is not on that
    sub-tab at all. It is in a strip above the sub-tab row, visible on all
    five, and at minimum scroll it is on screen while the margin input is
    being typed. The real cost was 578px of separation, which is a different
    problem with a different fix.

    **The inference felt like a restatement, which is why neither party
    checked it.** "X is on another screen, so you cannot see X while doing Y"
    reads as the same sentence twice. It is two sentences, and the second is
    about a person's viewport at a scroll position, which is a measurement.

    **The check: when a sentence contains "so", "which means" or "and
    therefore", the clause after it is a separate claim and needs its own
    evidence.** Structure is cheap to establish - a grep, an id, a file. What
    somebody can SEE is a viewport, a scroll position and a width, and it is
    only ever established by looking.

    Distinct from rule 19, where a name asserts a property nobody checked:
    here the property was asserted in prose by someone who HAD checked the
    other half of the same sentence. **The measured half is what lends the
    inferred half its authority**, which is why this one survived being
    written at the top of a brief and read by two people.

    **THE BUSINESS'S OWN REMEDY, recorded as theirs.** The same fault
    happened a second time in the same round, in the other direction: a
    Round 38 measurement ("the rates are absent from the input surface")
    became a Round 39 instruction ("keep the card as a reference panel")
    without anyone asking what it rested on. The measurement had been true of
    one screen and was false of the one being rebuilt.

    > **"When I turn one of your measurements into an instruction I will name
    > the measurement it rests on, so you know what to re-check."**

    That is the cheapest possible fix and it belongs on the instruction side,
    because the person receiving an instruction cannot see which of its
    clauses were measured and which were inherited.

27. **A DISTANCE IS A PROPERTY OF THE LAYOUT. A WINDOW IS A PROPERTY OF THE
    TASK.** Round 39 Phase 2, 2026-08-29.

    A readout sat 578px from the control that changed it, so the round set
    out to shorten that distance. The change moved it to 240px **and the
    number went off screen**, because the readout now sat below the control
    and the scroll position that made the control usable put the readout past
    the edge.

    **The improving measure and the worsening experience pointed opposite
    ways**, and the measure was not wrong about distance. It was measuring
    the wrong thing.

    The right measure was **the height of the scroll window in which BOTH are
    visible** - the number of positions a person can work from without losing
    the number. On the same change that took the distance from 578 to 240,
    the window went from 60px to 450px at 1240x700, and elsewhere a window of
    zero appeared where the distance looked fine.

    **A COROLLARY FOUND IN THE SAME CAPTURE: a note nobody can read is
    functionally absent.** Round 39's Phase 0 reported an asymmetry as one that
    "has never been named". It had been named on screen since Round 36, in a
    sentence set dim, uppercase and monospaced. **The reason neither the
    business nor I knew it was there is visible in the capture.** Presence is a
    property of the document; being read is a property of the person. The claim
    was false and it felt true, and the style is why.

    **The check: state the measure as something the PERSON experiences, not
    something the page has.** Distance, element count, panel height and
    scroll height are all properties of the document. Whether you can see two
    things at once, how many positions let you, how many actions a task
    takes: those are properties of doing the task. **When a layout number
    improves and the screen feels worse, the number is describing the
    document.**

29. **RECORD WHAT AN OPTION'S STATED ADVANTAGE DEPENDS ON, AT THE MOMENT THE
    DECISION IS TAKEN.** Round 39, 2026-08-29, set by the business, and the
    value is on the RECORDING side rather than the superseding side.

    > When a decision is taken by comparing options, record what each option's
    > stated advantage depends on. A later round can then test the premise
    > rather than re-litigate the choice. When a premise proves false the
    > decision is **RE-TAKEN, not re-weighed**, and the original reasoning stays
    > visible so a reader can tell which happened.

    **The instance.** `MERGE_GATE.md` chose a manual gate over the CI-secret
    path because "an enforced gate today beats a CI job that cannot run". That
    advantage depends on one thing: that the manual gate can actually be run.
    **It cannot.** Three of five stages need an authenticated session, the
    session needs a password, and the password belongs to one person. The round
    stalled on it twice in one day.

    **The forward half is what would have caught this a round earlier.** Nobody
    needed to re-argue the choice; somebody needed to have written down that the
    advantage rested on "the gate runs unattended", at which point the next
    session tests one sentence instead of re-opening the decision. Written that
    way in Round 38, it would have been found in Round 38.

    **Re-taken, not re-weighed, is the other half and it is about honesty of
    the record.** A decision whose comparison has lost a leg is not the same
    decision with a smaller margin. Leaving the superseded reasoning beside the
    supersession is what lets a later reader tell whether a premise failed or
    a preference changed, and those are different histories.

    Related to Verification 23, two correct decisions about the same question
    taken in different rounds, from the other end: 23 is a conflict nobody can
    see because no file holds both. **This is a conflict between a decision and
    the world, and it is invisible for the same reason: the thing that changed
    was never written down as a thing the decision depended on.**

28. **TWO CHANGES TO THE SAME SURFACE MUST BE MEASURED AS A PAIR.** Round 39
    Phase 2, 2026-08-29.

    Each change can be measured correctly on its own and still mislead about
    the combination.

    Moving the contract duration control next to the margin controls was
    measured, correctly, as putting it beside the thing it changes. **On its
    own it took that control's both-visible window against the existing
    readout from 90px to ZERO at 1240x700** - there is no scroll position
    where the control and that readout are visible together. It is an
    improvement only because a second change, in the same phase, put a
    readout inside the card: zero becomes 570px.

    **Neither measurement was wrong. The pair was never measured.**

    **The check: when two changes touch one surface in one round, measure
    each alone and both together, and say which combination the result
    describes.** Landing them in separate phases would have shipped the first
    one as a regression that every individual reading called an improvement.

31. **READ THE DECISIONS BEFORE THE ARTEFACTS.** Round 39 close, 2026-08-29,
    set by the business, and it is the process fault that cost the round its
    structural half.

    > When a brief holds both a DECIDED DESIGN and a REFERENCE IMPLEMENTATION,
    > the decision is an instruction and the implementation is only evidence
    > about what exists today. **A prototype tells you what was built, not what
    > was agreed.**

    **The instance.** `COMMERCIALS_RESHAPE_PHASE_0_BRIEF.md` carries a section
    headed **"Decided with the business"** whose first item is the layout: no
    sub-tabs, one scrolling screen, five sections in order, detail expandable
    beside the summary, Payment Terms and Cash Flow side by side.

    **Round 39 read the prototype first and in full, and the decided layout was
    in the same document.** The round then removed one sub-tab of five and
    called that the reshape, and spent its measurement effort on switch counts
    and both-visible windows for a structure the business had already decided to
    remove. My own Phase 0 wrote "the prototype is the only place a layout was
    ever specified", which is false, and pointed the round there.

    **This is rule 30 at document level**: we reasoned about how the screen
    behaves without first establishing which description of it was
    authoritative. 30 asks whether a thing exists; this asks which of two
    descriptions of a thing is the instruction.

    **The check: before reading a reference implementation, find the decisions.**
    Grep the brief and `DESIGN_PRINCIPLES.md` for "decided", "agreed",
    "supersedes", "the business", and read those first. What survives is the
    screen-content work, which is true under any layout; what is wasted is
    every structural measurement taken against the superseded shape.

32. **A NUMBER THAT HAS BEEN CITED IS AN IDENTIFIER, NOT A POSITION.** Round 40,
    2026-08-30, set by the business from a catch made while recording another
    rule.

    > It can be appended to. It can be superseded. **It can never be reordered.**

    **The instance.** Architecture rule 10 was first written as rule 7, pushing
    the existing 7, 8 and 9 down by one. Measured before committing: **51
    citations of Architecture rules 8 and 9 exist** across code comments, briefs
    and this file. Renumbering would have silently invalidated every one of them,
    and nothing would have failed - a citation is prose, and prose that now
    points at the wrong rule reads exactly like prose that points at the right
    one.

    So the new rule took the next free number and was moved into reading order,
    rather than taking the number its topic suggested.

    **AND IT IS THE SECOND AND HARDER REASON FOR A DECISION ALREADY TAKEN.** The
    index pass groups ABOVE the numbers rather than renumbering, which was chosen
    because rounds cite them. That was a readability argument. This is the
    evidence: the citations are not hypothetical, there are 51 of them, and the
    grouping is what makes the set navigable without touching a single one.

    Same family as Verification 19, a name asserting a property, from the other
    direction: **a number is a name that looks like an ordering**, and the
    ordering is the part nobody may rely on.

33. **EVERY MEASURE HAS A SHAPE, AND WHAT FALLS OUTSIDE IT IS FOUND BY LOOKING
    OR NOT AT ALL.** Round 40 Phase 2, 2026-08-30, set by the business, and it
    is recorded as the honest limit of a measure that WORKED rather than as a
    fault in it.

    **The instance.** Phase 2 removed four sub-tabs and rebuilt the screen as
    five sections. The measure was a control census, before and after, naming
    every interactive control: 75 to 71, losing exactly the four sub-tab buttons,
    gaining nothing, with no surviving control changing shape. It was calibrated
    and it was exact in both directions.

    **The four sub-tab buttons were also the section NAMES.** With them gone,
    Installation began with "Contractor payment milestones", **Structural Terms
    had no heading at all**, and Payment Terms began with "Invoicing". **A
    section name is not a control, so the census could not see it**, and no
    amount of making the census better would have: it counts what it enumerates.

    **The check: when you choose a measure, name what it cannot see, and look at
    that.** The next rebuild will reach for the same instrument and inherit the
    same blind spot, which is why this belongs beside the census rather than in
    the round that found it.

    **AND THE SHARPER INSTANCE, from the same phase.** A comment cut in half by
    the same rebuild swallowed section 3's closing tag, so sections 4 and 5
    became CHILDREN of section 3. **Four measures passed:** the div-balance count
    (it counted tags inside comments), an id probe (every element was in the
    DOM), the control census (nesting loses no controls) and the layout
    measurement (nested sections still stack with increasing tops).

    **THE FOUR MEASURES WERE NOT FOUR.** Set by the business, and it is what
    makes this rule usable rather than only true. Counting controls, checking
    presence, measuring geometry and balancing tags all ask ONE question in
    different words: **is the thing there and in the right place on screen?**
    None asks whether the document is well formed. It was never four independent
    measures with one shared gap; it was one question asked four ways, and the
    diversity was illusory.

    > **When several measures all pass, ask what question they SHARE, not what
    > each one covers.** A set assembled from one worry inherits that worry's
    > blind spot however many members it has.

    Nearest neighbour is Verification 18, where one green result has several
    independent causes and fixing the first reveals the second. **This is the
    opposite arrangement: several green results with ONE cause**, and no amount
    of adding members to the set would have found it.

    **AND A COUNT IS NOT A STRUCTURE. Set by the business, Round 40, after the
    same instinct produced three failures in one round.**

    - **Div balance.** `<div>` minus `</div>` over the file returned zero while a
      comment had swallowed a `</section>` and two sections were nested inside a
      third. The count was right and described nothing.
    - **Comment delimiters.** `<!--` 139, `-->` 139, balanced, while an orphaned
      tail sat outside any comment and **rendered as prose on the page** under
      the Save changes button. Inserting a block inside a comment gave the
      opener a nearer closer to pair with; the count cannot see a re-pairing.
    - **The control census**, which is a count done honestly and still could not
      see a section losing its name, because a name is not a control.

    **A count answers "how many", and structure is "which one is inside which".**
    Balanced totals are consistent with any number of wrong pairings, so the
    check has to walk the pairing: for comments, every `-->` consumed by an
    opener; for nesting, the parentage asserted rather than the totals.

    **The instinct will reach for a count again**, because a count is one line
    and a walk is ten, and it is recorded here with all three instances so the
    next reach is at least an informed one.

    **The cause underneath is rule 34's caveat.** Slicing and reassembling markup
    treats structured text as lines, and the comment straddled a boundary the
    slicer did not know existed. A rebuild done with a script that does not read
    what it carries loses exactly the structure the script cannot see.

    Distinct from Verification 4, "open the screenshot and look at it", which
    says looking beats an assertion for emphasis and prominence. **This is
    narrower and harder: the assertion was RIGHT, complete, and calibrated, and
    the thing that broke was simply not of the type it counts.**

34. **A REBUILD IS ALSO A SURVEY.** Round 40 Phase 2, 2026-08-30, set by the
    business.

    Restructuring forces every selector, every id and every assumption in the
    moved code to be re-read, and that reading finds things no test was looking
    for. Phase 2's better find was not the layout: the live recompute used three
    panel-scoped selectors plus four Payment Terms fields named individually,
    **so an input added to Payment Terms would silently not have recomputed** -
    and that was true before the round started. Nothing would have failed. The
    figure would simply have been stale.

    It surfaced only because the panels were being dismantled and the selector
    had to be looked at.

    **Worth recording as a reason structural work pays for itself beyond the
    structure**, and as a reason to read what you move rather than moving it
    mechanically: the survey is most of the value and it is free, but only if
    the moving is done with the code open rather than by a script that does not
    read what it carries.

35. **FOR ANYTHING PUBLISHED, ORIGIN IS THE SOURCE OF TRUTH, NOT LOCAL.**
    Round 40 close, 2026-08-30, set by the business.

    **A generated section that reads LOCAL state and calls it fact will publish
    a wrong fact with full confidence.** `CURRENT_STATE.md` gained a tags table
    and was one generation away from doing exactly that: local
    `reshape-complete` pointed at `46f3fdf`, origin at `3499884`, and the
    generator read local.

    **The check: where a generated fact has a published counterpart, generate it
    from the PUBLISHED side, or generate both and let a disagreement FAIL rather
    than resolve silently.** Silently preferring either one is the fault; the
    disagreement is the finding.

    It is the same shape as Verification 20, two readers of one value, with the
    twist that one reader is a machine writing a document other people will
    quote. **A file that says "generated" is read as authoritative**, which is
    what makes a wrong fact in it worse than a wrong sentence anywhere else.

36. **RULE 32 BINDS THE TOOLING AND THE AGENT, NOT JUST THE FILE.** Round 40
    close, 2026-08-30, set by the business.

    A cited identifier cannot be reordered, **and it cannot be force-moved
    either**. Rule 32 was written about renumbering rules in a document. The same
    week, its author force-moved a published git tag five times.

    **THE MECHANISM, ESTABLISHED FROM THE RECORD RATHER THAN RECALLED, and it is
    the part that generalises.** No script and no helper: a hand-written
    `git tag -f -a reshape-complete` in an ordinary command, issued after the tag
    had already been pushed, without checking whether it had been. Nothing in
    `scripts/`, `.githooks/` or `package.json` touches tags at all.

    **AND THE OPERATION HAS TWO SPELLINGS, ONLY ONE OF WHICH CONTAINS THE WORD
    "FORCE".** Counted across the session: `git tag -f` eight times, and
    `git tag -d <name>` followed by `git tag -a <name>` eleven times. The
    delete-and-recreate form needs no flag, reads as housekeeping, and moves a
    published identifier just as completely.

    **So a rule phrased as "never force-move a tag" leaves the more common route
    open**, and a guard grepping for `-f` would catch the minority case. The rule
    is about the EFFECT: after a tag is published, nothing may change which
    commit it names, by any spelling. Supersede it with a new name instead, and
    record what the old one covers (`DESIGN_PRINCIPLES.md`).

37. **A RULE THAT NAMES A MECHANISM POLICES THE MECHANISM, NOT THE EFFECT.**
    Round 40 close, 2026-08-30, set by the business, and it is the round's
    sharpest finding. It is not about tags.

    > **Where a rule names a command, a flag or a tool, it is describing ONE
    > ROUTE to an effect, and is presumed incomplete until the other routes are
    > named.** Rules are written about outcomes.

    **The instance.** "Never force-move a published tag" reads as complete. The
    operation has two spellings and only one contains the word "force":
    `git tag -f <name>`, and `git tag -d <name>` followed by `git tag -a <name>`.
    Counted across one session: **eight force moves and ELEVEN
    delete-and-recreates.**

    **The obvious guard would have caught the minority case and reported clean.**
    A grep for `-f` finds eight of nineteen. The delete-and-recreate form needs
    no flag, reads as housekeeping, and moves a published identifier just as
    completely - and it is the one used MORE often, precisely because it does not
    look dangerous.

    **The check: read every rule for a noun that is a tool.** `git tag -f`,
    `??`, `grep`, `db push`, `setVal`, `readdirSync`. Then ask what else produces
    the same effect, and rewrite the rule around the effect with the routes named
    underneath as instances. The routes are evidence; the effect is the rule.

    Related to Verification 19 from the other side: 19 is a name asserting a
    property nobody measured. **This is a rule asserting a COVERAGE nobody
    measured**, and it is worse, because a rule believed to be working stops
    anybody looking.

38. **A DETECTOR THAT HAS NEVER FIRED IS AN ASSERTION, NOT A CONTROL.** Raised
    by the business at the Round 40 close. **CHECKED FIRST, AND IT IS ALREADY
    VERIFICATION 9**, which says an invariant not proven capable of failing is
    not evidence: inject a real violating case, watch it fail, then revert. Same
    remedy, so by this file's own collapse test it is the same rule and does not
    get a second number.

    **What the business's phrasing adds is SCOPE, and 9's wording is now broader
    for it.** "Invariant" reads as a test assertion. The same discipline applies
    to a probe, a generated column, a hook, a scan: anything whose job is to
    notice. Read rule 9 as covering every detector.

    **AND THE REGISTER OF WHAT IS UNPROVED, kept rather than left implicit,
    because "we calibrate here" is exactly the coverage claim rule 37 is about.**
    Round 40 built these detectors; the unproved ones are named, not swept:

    | detector | proved by |
    |---|---|
    | `probe-dead-selectors.mjs` | an injected dead rule, a live rule, and the real `.pg-margin` instance |
    | tags `local agrees` column | force-moving the local tag, watching it read NO, reverting |
    | comment swallows a tag | reintroducing the runaway comment |
    | stray `-->` outside a pairing | recreating the stolen-closer fault |
    | `scripts/edit.mjs` refusals | seven separate refusal paths |
    | rate resolution | letting the resolver read a catalog-only key; adding a key to the server allowlist |
    | **all eleven margin inputs exist** | **NOTHING. Rewritten in Phase 3 and never made to fail.** |
    | **a margin box is read from the screen** | **NOTHING. Same rewrite, same gap.** |

    Both unproved detectors guard the same thing: a margin input lost in a
    rearrangement, which drops its key and reads as deletion. **They are the two
    guarding the most expensive failure in the round and the two nobody has
    watched fire.**

    **BOTH WERE THEN CALIBRATED, 2026-08-30, and the business reversed their own
    instruction to do it.** Their reasoning is the reusable part: Round 40 WAS a
    rearrangement of the screen those eleven inputs sit on, so this was the
    failure the round could plausibly have caused, and **one absent field among
    eleven is what an eye slides past** - a walk-through would not have found it.

    **Eight injections, all fired, all reverted, and NO DEFECT FOUND.** Recorded
    as a cost that returned confidence rather than one that returned a bug,
    because that is what most calibration buys and a record that only shows the
    calibrations which found something misrepresents the practice. The business's
    own note: they would call the reversal the same way again.

    **The sharpest of the eight is worth keeping.** Renaming one input leaves the
    COUNT at eleven and the test fails anyway, because it asserts the eleven
    NAMES rather than the number. A count would have passed it. Rule 33's
    companion, arriving inside a calibration.

39. **PROSE SATISFIES A CHECK MEANT FOR CODE.** Set by the business 2026-08-30,
    Round 41, after the same fault fired three times in one round in three
    instruments written independently by somebody who had already been caught by
    it twice.

    > **A guard or probe that scans source code for evidence STRIPS COMMENTS
    > BEFORE MATCHING, and calibrates that the stripping keeps real code.**

    **The three instances, and none of them was a careless grep.**

    - **A route assertion matching a comment.** The scan asked whether a route
      performed a write; a comment describing the write satisfied it.
    - **The fetch scan guard**, satisfied by a sentence about wrapping `fetch`.
    - **An import check matching its own comment.** A guard tested whether the
      file contained `system-defaults.js` before adding the import, and matched
      the comment written four lines earlier that mentioned the filename. **The
      guard printed a true reading of a false thing**, the import never landed,
      and the gate found it as `defaultsForStructureChange is not defined`.

    **The third is the shape to remember: the prose that satisfied the check had
    been written by the same hand, in the same minute, as the check.** Nothing
    adversarial and nothing stale. A file that talks about its own code will
    contain every string a scan of that code looks for.

    **THE SECOND HALF IS NOT OPTIONAL AND IS THE EASIER ONE TO SKIP.** A
    stripper that eats real code turns every scan built on it into a silent
    false negative, which is this same fault wearing the other hat and is worse,
    because the first version at least fails loudly when the code is missing.
    `'https://x'` is not a comment. `/[^/]*/` is not a comment. A `/*` inside a
    template literal is not a comment. `$$ -- inside a plpgsql body $$` is not a
    comment. `${VAR#prefix}` is not a comment. **Calibrate in both directions:
    show a comment failing to satisfy the scan, and show the stripped source
    still parsing.**

    **AND ONE KIND OF SCAN MUST NOT STRIP, which is why the rule names EVIDENCE
    rather than scanning.** A scan looking for a HAZARD reads the file raw: a
    key pasted into a comment is committed exactly as hard as one pasted into a
    string, so stripping in `scripts/tests/no-secrets.test.mjs` would build the
    hole rather than close it. The exception is recorded at that scan, not here.

    **The first instrument to adopt it found something within the minute**,
    which is the argument for the rule rather than for the tidiness: reading
    `style.css` through the stripper showed `.detail-tab-panel` and
    `.field-editing` had no rule at all. Both are applied by live JavaScript.
    The scan had been reporting them styled because two comments mentioned
    them, one of which says the class deliberately carries no styling.

    Nearest neighbour is Architecture 9's fourth variant, a literal that cannot
    be falsified. **This is the reverse: a literal that falsifies a measurement
    of something else**, and the measurement is the one reporting green.

40. **A BOUNDARY IS NOT GREEN UNTIL EVERY ROUTE IT TOUCHES HAS BEEN EXERCISED
    FROM OUTSIDE, ON THE SUCCESS PATH.** Set by the business 2026-08-31, Round 41,
    from walk finding W4.

    > **Every route a boundary ADDS OR MODIFIES is exercised from outside over
    > HTTP, as the signed-in user, observing the NEW BEHAVIOUR on the SUCCESS
    > PATH.**

    Each clause is load-bearing and each was absent in the instance.

    **OR MODIFIES is the half that was missing.** A new route gets attention
    because it is new. `fe073b5` did not add a route: it modified an existing,
    working one to return the new revision number, and nothing exercised it
    afterwards because nothing ever had.

    **FROM OUTSIDE OVER HTTP.** Everything in `npm run test:db` reaches Postgres
    through the service key, which has BYPASSRLS and never enters a route.
    A route's behaviour is only measurable through a route.

    **ON THE SUCCESS PATH**, and this is where the existing gate was weakest.
    All three HTTP probes measured REFUSALS: a stale write rejected, an approval
    refused, a gate held shut. **Not one exercised a write that is supposed to
    work.** A suite made entirely of refusals is satisfied by a route that
    refuses everything.

    **THE INSTANCE.** `fe073b5`, the revision-handshake commit, destructured
    `{ error: revErr }` from `appendRecordRevision` and named an undeclared
    `newRevision` on the response line. A `ReferenceError` **thrown while
    building the 201 for a write that had already committed**, so both score
    routes answered 500 to every criterion on every lens.

    It reached `main`, was pushed, and was found four hours later **by a person
    on a walk**. The gate was five stages green: 354 pure tests, 91 database
    tests, three HTTP probes. **No test imported `recordScoreEntry` and nothing
    in the repository had ever POSTed a score**, so the only scoring write in
    the system had never been executed by anything but a human being.

    **AND THE ASSERTION IS ABOUT THE NEW BEHAVIOUR, NOT THE STATUS.** A 201 was
    what the route returned once the ReferenceError was fixed; a probe checking
    only the status would then pass while `revision_number` came back `null`,
    which is the same commit's other failure mode and the reason the handshake
    existed at all. `probe-score-success.mjs` was calibrated against both shapes
    and fires on each.

    **Nearest neighbour is Architecture 8**, correct for every caller that
    exists is not correct for the caller about to be built, and the difference
    is the direction: rule 8 is an unchanged path meeting a new demand. **This is
    a CHANGED path meeting its existing demand**, with nothing outside the
    process to notice that it had stopped meeting it.

41. **WHEN A ROUTE IS SUPERSEDED FOR A RECORD TYPE, THE ROUND REPORT LISTS EVERY
    FRONTEND CALLER OF THAT ROUTE AND STATES ITS DISPOSITION.** Set by the
    business 2026-08-31, Round 41, from walk finding A.

    > Superseding a route is not finished when the new route works. It is
    > finished when every caller of the old one has been found and each has been
    > **removed, refused, or deliberately kept with the reason written down.**

    **THE INSTANCE.** The stage approvals workflow replaced
    `POST /records/:id/approvals` for Opportunity across five migrations and
    three phases. **The old route was never touched, and a live control on the
    Opportunity stage panel kept calling it.**

    What that cost, and none of it announced itself:

    - The walk's approve click returned *"An approval decision from you already
      exists for this revision and track"* - the OLD route's 23505 message,
      refusing a duplicate of its own earlier row. Three plausible causes were
      proposed and **all three were wrong**, because everybody was looking at the
      workflow.
    - **Every row it wrote satisfied no gate.** For a workflow record type
      `approvalSatisfiesRule` returns `requestApprovals.has(track)` and never
      reaches the stage or revision branches. The rows looked like approvals,
      were stored as approvals, and did nothing.
    - **It had no identity check beyond being signed in**, so the record's owner
      approved their own transitions through it five times - the single rule the
      workflow exists to enforce.

    **A SUPERSEDED ROUTE DOES NOT GO QUIET. It goes on working**, which is worse
    than breaking: a route that 500s is found in a minute, and one that returns
    201 for a write nothing reads is found by a walk, or not at all.

    **The check is a list, in the report, with a disposition per row.** Not "the
    callers were updated": the enumeration itself is the instrument, the same way
    Round 40's control census was. Grep for the path, and for every hit say
    removed, refused, or kept-and-why.

    **AND "FRONTEND" IS TOO NARROW, corrected within the hour of writing this.**
    The rule was set as "every frontend caller" and the frontend census came back
    complete. The gate then went red on `probe-version-approval.mjs`, which had
    been calling the superseded route twice to set up its fixtures - **a caller
    the rule as phrased did not ask about.** Verification 37 exactly: a rule that
    names a mechanism polices the mechanism, and "frontend" was one route to the
    effect. **Grep the whole repository**, and the disposition list covers probes,
    tests and scripts as well as screens.

    **AND THE OLD ROUTE ITSELF REFUSES**, rather than relying on no caller
    reaching it. Callers are found by looking; a refusal is found by testing.
    Round 41 made it a 409 conditional on the same `WORKFLOW_RECORD_TYPES` list
    the evaluator branches on, so the screen and the route cannot disagree, and
    an HTTP probe proves it refuses for one record type and still works for the
    other.

    Nearest neighbour is Verification 23, two correct decisions about the same
    question taken in different rounds. **This is two correct ROUTES for the same
    action**, and the same signature: each is defensible on its own terms, and
    nothing in either one knows the other exists.

42. **A WALK ON A CACHED BUNDLE REPORTS DEFECTS THAT ARE ALREADY FIXED.** Set by
    the business 2026-09-01, Round 41, from the fourth walk.

    > **Before a walk defect is treated as live, the stale-bundle possibility is
    > checked: hard reload, then re-observe.**

    **THE INSTANCE, and the cost was not the half hour.** The fourth walk reported
    three defects. **Two of them did not exist.** The stage area blank after a
    transition and three approval rows in the exit-criteria list had both been
    fixed and pushed; neither reproduced on current code. A hard reload settled
    both.

    **What made it expensive is that the third defect WAS real**, and separating
    it from the two phantoms took a full diagnostic pass over paths, renderers
    and routes - enumerating thirteen re-render triggers and measuring the
    exit-criteria route on three stages - to establish that two of the three
    findings were about code that no longer existed.

    **A REPORT THAT MIXES FIXED AND LIVE DEFECTS IS WORSE THAN A WRONG REPORT**,
    because every item in it has to be re-measured before any of it can be
    trusted, and the real one arrives with the same authority as the phantoms.

    **THE FIRST QUESTION IS NOW MECHANICAL, and it is cheap.** Hard reload, then
    re-observe, and say in the report that it was done. It costs one keystroke
    and it removes the one failure mode that makes a walk unfalsifiable.

    **AND THE SERVER WAS CHANGED SO IT CANNOT HAPPEN AGAIN**, which is the half
    that does not depend on anybody remembering. `cache-control: no-store` on
    everything except `/api`. The previous default, `public, max-age=0` with a
    weak ETag, is correct for an ordinary reload and does not cover the two cases
    a walk runs in: a tab left open across a fix, and a bfcache restore.

    **A walk is this project's stopping condition.** A walk that can run pre-fix
    code is a broken instrument, and this is the same argument as Verification
    12: a tool that returns the wrong answer for a reason unrelated to the truth
    is worse than one that returns nothing.

43. **A SURFACE THAT DISPLAYS AN APPROVAL OR A GATE STATE READS FROM THE SAME
    SOURCE THE ENFORCEMENT READS.** Set by the business 2026-09-01, Round 41,
    from the sixth walk. **The third instance of one defect, which is why it is a
    rule rather than a fix.**

    > Never a parallel query. Where a display genuinely cannot share the
    > enforcement's read, it is **tested against the enforcement's own outcome**,
    > not against a second derivation of it.

    **THE THREE INSTANCES, and they are the argument:**

    - **The exit-criteria gate, Round 38.** The panel and `computeBlocking`
      answered the same question by different rules. Live data carried three
      Commercial approvals describing prices that had already moved while the
      gate read green. `approvalSatisfiesRule` exists because of this one.
    - **The version bridge**, Verification 20's own instance. The approval page
      read `payload.factoringRatePct`; the calculator reads
      `payload.factoring.ratePct`. The page told every approver "nobody entered a
      value" for a deal that had set it. **Both readers were correct in
      isolation.**
    - **The stage panel, sixth walk V8.** `GET /records/:id/stage-approvals`
      built ONE set of approvals from the record's single OPEN request and handed
      it to every stage. On a record with no open request every track on every
      stage read "waiting" - including two stages whose approvals sat on closed
      requests. Six approvals existed and the panel could see none of them, on a
      record that could not have advanced without them.

    **WHAT MAKES THIS FAMILY DANGEROUS is that the enforcement is right every
    time.** `decide_transition_request` has never let a record move without its
    approvals. Every one of these was a READER beside a correct rule, and each
    was defensible on its own terms until somebody compared it with the gate.

    **A GREEN DISPLAY IS A POSITIVE CLAIM.** "Approved" on screen says a named
    person accepted this, and "waiting" says nobody has. Round 38 recorded that a
    wrong green is worse than no gate, because no gate is an absence people work
    around. V8 is the same sentence inverted: a wrong EMPTY tells somebody the
    approvals they gave were never recorded.

    **The check: for any panel showing approval or gate state, name the function
    the enforcement calls and confirm the panel calls it too.** Where it cannot -
    a different grain, a different transport - the test asserts the panel against
    the enforcement's OUTCOME on the same record, which is what
    `buildStageTracks` being exported for the agreement test already does and
    what V8 slipped past by feeding that exported function the wrong argument.

    Nearest neighbour is Verification 20, two readers of one value. **This is
    narrower and has a remedy 20 does not: there is a specific function to
    share**, and sharing it is cheaper than proving two readers equal.

44. **A BACKUP OR TEMP ARTEFACT KEYS ON THE FULL PATH, NEVER THE BASENAME.** Set
    by the business 2026-09-01, Round 41, from a fault in a calibration harness.

    **THE INSTANCE.** A harness backed six files into a scratch directory with
    `cp $f $SP/dir/$(basename $f)` and restored them the same way.
    `src/lib/transition-requests.js` and `src/routes/transition-requests.js`
    share a basename, so **the backup loop overwrote the lib copy with the routes
    copy, and the restore loop then wrote the routes file over the lib file.**

    **THIS REPOSITORY MAKES THE COLLISION LIKELY RATHER THAN UNLUCKY.** It
    deliberately mirrors names across `src/lib` and `src/routes` - the module
    holds the decisions and the route holds the wiring, and they are named for
    the same thing on purpose. `transition-requests`, `deal-sheet-versions`,
    `approvals`, `records`, `scoring`, `transitions`: six pairs, and any harness
    touching one of each hits this.

    **CAUGHT BY THE REVERT NOT RETURNING TO GREEN**, which is the one thing a
    calibration harness reliably reports and the reason to run the final
    "reverted" pass rather than assuming it. Recovered from `HEAD` and the lost
    edits re-applied; the calibration that had been skipped was then re-run with
    distinct filenames and fired.

    **The remedy is one substitution:** key on the path with separators
    replaced, `${f//\//_}`, or mirror the directory structure under the scratch
    root. Either makes the collision impossible rather than unlikely.

    **AND IT IS NOT ONLY BACKUPS.** Any scratch artefact named after a source
    file has this shape: capture files, diff outputs, per-file logs, the
    `.verify` transcripts. A name that is unique in one directory is not unique
    across a tree.

### At round close: index these by when they apply

**Raised by the business 2026-08-29, Round 39. Not a trim, an index.**

There are roughly forty rules and corollaries here, and the last several rounds
have each added one or two. They are earning their keep. **But a set that stops
being held in a head and starts being consulted is a different kind of
document**, and this one is still arranged by the order things were learned.

Group them by **when they apply**: before writing, before claiming, before
deleting, before superseding, before quoting a measurement. **The check then
fires at the moment rather than by recall**, which matters because several
rules here record their own author being caught by them within the hour of
writing them down. Knowing a rule confers no ability to spot its instances;
being prompted at the right moment does.

**AND ASK ONE QUESTION OF THE GROUPS: DO THEY COLLAPSE?** Added by the
business the same day, and it is the point of the exercise rather than a
refinement of it.

Rules 19 to 29 came out of two rounds, each from an incident. That is the right
way to acquire a rule. **It also means the set is shaped by what went wrong
rather than by what matters**, and incidents cluster.

**If nine of the last eleven land in "a claim made without measuring it", that
is not nine rules. It is one rule with nine instances**, and it should read that
way, with the instances kept underneath as the evidence. The instances are what
make the rule believable and what let a reader recognise the shape in the wild;
they are not nine separate things to remember.

**An index that reveals the set is smaller than its numbering is worth more than
an index that files it neatly.**

**THE TEST FOR A COLLAPSE IS THE REMEDY, NOT THE SHAPE.** Set by the business
2026-08-29, from this file's own boundary work: **two failures that look
identical are still two rules if the remedies differ.** Similarity of symptom is
what makes rules feel mergeable and is not evidence that they are. Ask instead
whether collapsing them costs anybody an action they would otherwise take.

**MEASURED AGAINST THAT CRITERION, 2026-08-29, by extracting the prescribed
action from each rule rather than reading its description. The result disagreed
with both prior guesses, in opposite directions.**

**12, 13, 17 and 25 collapse, and my own boundary paragraphs were wrong to
separate them.** Rule 25 says "13 wants a positive case found elsewhere, 17
wants a calibration, and this wants the instrument moved". Set against each
other, those are three ways of SOURCING one action: produce a non-null reading
before trusting a null one. The single rule is:

> **Before trusting a null reading, make the instrument produce a non-null one
> on the system under test, ON THE SAME POPULATION YOU ARE ABOUT TO MAKE THE
> CLAIM ABOUT.**

The four instances are what teach you where to find the positive case: a
known-present string (12), the same mechanism somewhere else (13), a
deliberately differing state (17), the code path the suite actually runs (25).

**The population clause is 25's own twist and the merged sentence needed it
adding back.** Without it the rule is satisfied by a narrow demonstration: the
clock-skew budget DID produce a non-null reading, on the one call it wrapped,
while the claim being quoted from it was about hundreds. **An instrument can be
demonstrably working somewhere and blind on the population the claim covers**,
and a positive reading from the narrow path is then evidence that the instrument
exists rather than evidence for the claim. Nearest neighbour is Verification 17's
own paged-API species, a probe that discriminates perfectly over 1000 of 8237
rows.

**14 and 18 do NOT join them, though they sit in the same family.** 14's remedy
is a clause in the assertion, `!!a && !!b && a === b`, not a calibration at all.
18's is the opposite instruction to the others: **do not stop at the first
fix**, because a calibration that does not move the number has failed to run
rather than passed. That is an action the collapsed rule would lose.

**19, 24 and 26 do NOT collapse**, against the expectation that they would.
They share a trigger, a claim made without measuring it, and their actions are
three different things: enumerate every member of a category and check it
against the name (19); write one test passing a value different from the default
(24); treat the clause after "so" or "which means" as a separate claim (26).
Nobody holding only the merged sentence would arrive at 24.

**Which is the distinction the index has to carry: 19, 24 and 26 belong in the
same GROUP and remain three rules.** Grouping is by when the check fires;
collapsing is by whether the action is the same. The pass does both and must not
confuse them.

**AND A MERGE CAN DESTROY INFORMATION RATHER THAN ONLY TIDY IT.** The 18 result
is what shows it: its action is the OPPOSITE instruction to the rules it most
resembles, so a merge on similarity would have deleted "do not stop at the first
fix" while looking like housekeeping. **Nothing would have failed. The merged
rule would read perfectly well.**

**The test, and it is the same one that kept 24: would each member's action
survive being read from the merged sentence ALONE, by somebody who has never
seen the originals?** If not, that member is carrying information the merge
would consume, and it stays. Applied honestly this is what limits a collapse to
four, not nine, and it is the reason an index pass is a measurement rather than
an edit.

Nothing is removed and nothing is reworded by the index pass. The current
numbering is load-bearing, because rounds cite it: **the grouping sits above the
numbers, not instead of them.**

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
