# Migration Round 4, Phase 2: the swap, whole in one session

Session of 2026-09-06. Items 1 to 6 of the Phase 2 instruction, and the
report.

---

## What is NOT finished, first

Per build discipline 15: the report's first section about an unfinished
item says so before any account of what was done.

**One defect, authored by this round, is found and NOT fixed.** It is
described in full under *Finding 1* below. Every item of the instruction is
complete and the gate is green; this is a defect the session's own
measurement uncovered at item 5, in the component built in Phase 1.

Under build-discipline rule 10's limit it belongs to this change rather
than to the queue, and the reason it is reported rather than fixed is
stated there: the observable is established and reproducible, the React
mechanism is not, and a speculative fix to the reason handling at the end
of a long session is the wrong way to close a swap that is otherwise
sound.

**The recommendation is that Phase 3 opens on it**, before the walk.

---

## Item 1: the dual-mode `requestPricingApproval`

`window.requestPricingApproval(versionId, label, reporter)` takes an
optional third argument.

- **Called bare**, it is byte-for-byte what it was: it disables
  `#btn-request-pricing-approval`, relabels it `Requesting...`, clears and
  then writes `#pricing-approval-state`, and restores the label on failure.
- **Called with a reporter**, it writes no DOM at all. `onStart()` and
  `onResult(message, ok)` carry the same two moments outward, and the card
  owns its own controls.

Six tests in `scripts/tests/request-pricing-approval.test.mjs`. They
**extract** the function from `app.js` by brace-walking and evaluate it
with stubs, rather than copying it, so the test cannot drift from the
source the way a transcribed copy would.

Committed as `d626d70` with item 2.

## Item 2: the swap

One commit. The bundle registers `initOpportunityDealVersions`; the vanilla
`<script type="module" src="/opportunity-deal-versions.js">` is commented
in place with its restore instructions; the card's markup is wrapped in
`#deal-version-vanilla` and hidden; `#deal-version-root` is the mount.

Re-points, inverted assertions and the coupling ledger all landed in the
same commit. The Verification 41 STRINGS-clause scan found one stale
sentence, in the *form's* revert comment in `index.html`, which still said
the version file "stays live under BOTH forms". Corrected in the same
commit.

## Item 3: the primary write path, walked live

`scripts/round4/walk-card.mjs`, run against the swapped tree.

**37 of 37.** Transcript at `scripts/round4/walk-card.out.txt`.

| what was walked | result |
|---|---|
| the React card is mounted and the vanilla is hidden | ok |
| a blank reason refuses, says what is wanted, and **writes nothing** | ok |
| save from a **clean** form: a version, and **no** deal revision | ok, 1 → 1 |
| save from a **dirty** form: the deal is saved FIRST | ok, 1 → 2 |
| the version froze the **saved** value, not the screen | ok, 31 |
| the issue control is **visible**, and names both versions | ok, `Issue V0.2 as V1` |
| the ask is offered, and the reporter drives the requesting state | ok |
| **a re-render mid-request does not re-enable the control** | ok |
| a non-reconciling schedule refuses, and the card says why | ok |
| the refusal wrote nothing, and the reason survived it | ok |
| restore over a dirty form asks before discarding | ok |
| restore fidelity, six fields asserted **by name** plus UI state | ok, 7/7 |
| a newer draft disables the ask, and the card says why | ok |
| no page errors; **no live records left** | ok |

**Three things the walk had to be corrected on, each recorded because the
correction is the finding:**

**The session token had expired nine minutes before the first run**, and
every stage failed in seconds. Verification 48 read it correctly before any
failure was opened. Rule 16's own clause governs the recovery: refresh
freely before probes, never before the gate.

**The ask was measured in the wrong place.** The first ordering took two
further versions before reaching the pricing-approval control, and `askView`
disables the ask whenever a draft newer than the issued version exists. The
failure detail said only `disabled=true`; adding the state line to it
turned three iterations into one, and the branch it named is now asserted
deliberately at the end of the walk. Verification 14's addendum exactly: the
failure detail carries the cause's own answer.

**The version gate does not apply at a fresh fixture's stage.** Measured:
every version-scoped rule in `stage_gate_rules` sits on `Proposal ->
Evaluation` and later, so `oppVersionGateApplies()` is false at
`Solution Alignment` and the whole ask is correctly hidden. The fixture is
now put at `Proposal` by an admin write rather than by transitioning,
because `decide_transition_request` reads `auth.uid()` and refuses the
requester approving their own request. That is the same one-account
constraint Phase 0 measured for the six fixture-only version states, and
the card reads the stage rather than how the record reached it.

A fourth correction was to the probe itself: `the issue control names both
versions` originally read `textContent`, which a **hidden** element answers
just as readily. Both controls are now asserted visible before their labels
are read.

## Item 4: the two-forms guarantee

On branch `r4-two-forms-rehearsal`, the form's one-line revert applied
exactly as its comment describes: `git diff --stat` showed
**1 file changed, 1 insertion**.

`scripts/round4/two-forms.mjs`, **15 of 15**, run **three times**.

The React card mounted over the **vanilla** form, was handed the vanilla
form's seam (`freezeCurrentState, hasUnsavedChanges, populateForm,
readContractorMilestones, recompute`), refused a blank reason, took a
version through that seam with the freeze saving first (`ssExisting` 27
frozen into the version), raised the discard prompt on a dirty restore,
repopulated the vanilla form through the seam, and kept publishing both
outward feeds.

**The card never reaches around the interface**, and that is now proven
against the other form rather than asserted.

**One 404 on the very first run did not reproduce.** It was seen by an
instrument that recorded no URL. The probe now records every response with
status ≥ 400 and every failed request; three consecutive runs with that
wider instrument saw none. I cannot say what the first one was, only that
it did not recur under an instrument that would have named it.

**The branch is discarded and the tree is byte-identical**: tree hash
`ff522e7ee87f937a64d24f0539f8f4d3cae91069` before and after,
`frontend/index.html` md5 `f434fc2e0b894aac27ccfb33129d7900` before and
after, working tree clean, branch deleted.

## Item 5: the card at three widths

`scripts/round4/visual-card.mjs`, **20 of 20**, 39 captures.

Twelve states at 1240, 1920 and 3440: empty, draft-only, issued-and-draft,
approved, rejected, pending, superseded, a nine-row list, the range
toggled, the reason filled, the success and error feedback, and the
requesting state.

The six states a walk cannot reach are driven through the card's **real**
data path: `window.api` is intercepted for the versions route only, so the
component fetches, parses and renders exactly as it does live. The
interception is installed with `evaluateOnNewDocument`, per Verification 45,
so the card's first fetch is served by it rather than its second.

Layout: the panel measures 876, 1556 and 3076 px, no overflow, and the
range toggle changes the list **both ways** at every width (5 → 9 → 5).

**Four faults in this harness, all mine, and two of them are worth
keeping:**

**A synthetic `value` setter is not a valid instrument for a React
controlled input.** Setting `.value` through the prototype descriptor and
dispatching `input` is deduped by React's per-input value tracker once the
component has persisted, so the DOM showed the typed text while the
component never received it. The probe then read the DOM, reported the box
as filled, and the card correctly said the reason was missing. Verification
17: it fired perfectly and measured the wrong side of the claim. The
harness now types with the keyboard, which is what a person does and has no
tracker to fool.

**The fixture used the wrong key for the author.** `created_by_name` where
the route writes and the card reads `created_by_email`, so every row read
`unknown author`. Verification 47: a fixture that constructs a shape the
system does not produce tests nothing. Corrected, and the captures now show
the real author line.

The other two: each width now starts from a clean page, because driving one
page through nine renders and two viewport changes is a state nobody
reaches; and two fixture-creating probes must never run concurrently,
because `tearDown()` enumerates by tag and removed a running capture's
record mid-flight (`opportunity not found`).

## Item 6: the injection sweep

`scripts/round4/inject.mjs`. **10 of 10 behaved as expected.** Transcript at
`scripts/round4/inject.out.txt`.

The harness follows Verification 44 as extended: keys are full paths with
separators replaced (this repository mirrors basenames across `src/lib` and
`src/routes` on purpose), the snapshot is asserted to exist and to match in
size **before** anything is injected, the restore is compared byte-for-byte
**after every** injection and stops dead on a mismatch, a non-unique or
absent anchor is reported as such rather than as a silent detector, and the
final reverted run is checked green with all four files confirmed
identical. It is written in Node rather than a shell, because zsh does not
word-split an unquoted variable and that is how a previous harness
snapshotted nothing.

| injection | claim it falsifies | verdict |
|---|---|---|
| reporter mode writes the DOM anyway | with a reporter, no DOM is written | DETECTED |
| reporter mode swallows the failure | a failure reaches the reporter | DETECTED |
| bare mode stops relabelling the button | bare mode still drives the two ids | DETECTED |
| the vanilla card tag is restored | the React card is the live one | DETECTED |
| the mount container is removed | the card has a container | DETECTED |
| the revert target markup is removed | the revert target survives | DETECTED |
| the bundle stops registering the card | the shell surface is the four names | DETECTED |
| the card imports a React form internal | the card consumes a seam | DETECTED |
| **the same name in a COMMENT only** | **prose cannot satisfy the scan** | **SILENT, as required** |
| the freeze runs before the reconciliation | reconciliation runs first | DETECTED |

**The ninth is the one worth having.** Verification 39 asks for calibration
in *both* directions, and the second is the easier to skip: the same
forbidden identifier injected as a comment must **not** satisfy the seam
scan. It did not. That is a positive demonstration that the scan reads
stripped source, rather than an assumption that it does.

Two anchors failed on the first sweep (`initOpportunityDealVersions`
appears four times in `main.tsx`; the import line was not what I had
written). Neither was a silent detector, and the harness distinguishes the
two — an unanchored injection reports `ANCHOR NOT UNIQUE (4)`, which is a
harness fault, where `SILENT` would have been a claim with no detector.

---

## Finding 1: the reason box is clobbered by card re-initialisation

**Authored by this round. Reproducible. Not fixed.**

**What a person meets.** They type a reason, press *Save version*, and the
card answers *"A reason is required: what changed in this version, and
why."* **with their reason still on the screen.** Or the box is silently
short by a few characters, or holds the previous version's reason with the
new one appended.

**How it was found.** Not by the walk, which passes 37/37, and not by any
assertion. It surfaced as two widths of the visual capture disagreeing with
the first, on byte-identical DOM.

**The measurement.** `scripts/round4/repeat-save.mjs` takes six versions on
one page with no viewport change, recording the box's length at the instant
of the click. 52 characters are typed every time:

| run | observed box length at click | outcome |
|---|---|---|
| first | 52, 52, 52, **0**, 52, 52 | saves 4 and 5 **refused** |
| later runs | 52, 52, **5**, 52, **109**, 52 | all six saved |
| | 52, 52, **24**, 52, 52, 52 | all six saved |

**0, 5, 24, 52, 57 and 109 where 52 were typed.** A short box is a
re-render landing mid-typing; 109 is a previous reason that was never
cleared; 0 is the whole reason gone. The refusal at 52 is the sharpest
case, because the text is on screen and the component's state is empty.

**It correlates with card re-initialisation.** A counter installed with
`evaluateOnNewDocument` recorded the mount count stepping 1 → 2 exactly
where the box emptied. `initOpportunityDealVersions` is called on every
`loadOpportunityDetail`, which a save itself triggers: the accumulating
capture reached **37 initialisations on one page** with **zero React root
warnings**, so it is one root re-rendered 37 times, not a second root.

**It is intermittent**, which is why the walk does not see it: 24
consecutive saves across four later runs all succeeded, while the box
length still varied. It is a race, and a person is *more* exposed than the
probe, not less: typing a sentence takes seconds, and the probe types 52
characters in about 52 milliseconds.

**The vanilla card cannot do this**, which is what makes it this round's.
`renderVersionList()` re-renders the **list** and never the textarea, and
`saveVersion()` reads the reason from the DOM at click time. The React card
re-renders the whole panel including a controlled `<textarea value={reason}>`.

**What is established and what is not.** Established: the observable, its
reproduction, its correlation with re-initialisation, and that the vanilla
is structurally immune. **Not established: the React mechanism.** The
component has no early return, no `key`, and no reset effect, and state
should survive a re-render of the same element type at the same position.
Until that is understood a fix would be a guess.

**Direction, not a prescription.** The vanilla's property is that a
refresh touches the list and nothing else. The React equivalent is for
`initOpportunityDealVersions` to stop re-rendering the tree when the
opportunity has not changed, and to refresh through the feed the host
already publishes.

---

## Findings 2 and 3: pre-existing, for the list

Both are faithful migrations of vanilla behaviour, so under rule 10 they
are recorded, scoped and queued rather than taken into this round.

**Finding 2: a superseded version can print a sentence that names
nothing.** The capture reads:

> `SUPERSEDED. Approved at revision 2, and the pricing has changed since: . Take a new version and have it approved.`

A bare `since: .` where the changed keys should be. The React
`approvalLine` is byte-faithful to the vanilla's, so this is not new.
**Whether it is reachable with real data is itself a finding**, and it is a
Verification 20 shape: `src/lib/version-pricing.js:143` computes
`changed: payloadsDiffer(now, was)` and `keys: changedKeys(now, was)` as
**two independent readers of the same question**, side by side. `superseded`
is set from `changed`; the sentence is built from `keys`. They agree today
as far as anything measures; nothing proves they must.

Found only by opening the screenshot and reading it. Every assertion about
that line passed: it rendered, it was non-empty, its class was right.
Verification 4.

**Finding 3: the sentence explaining a disabled ask is capped at 32
characters' width.** `.pricing-approval-state` carries
`max-width: 32ch; align-self: center`, so at 1240 **and** at 1920 the
explanation wraps to four lines in a ~200px column with 1500px free beside
it. The `align-self: center` has been inert since the walk of 2026-09-03
moved that `<p>` out of the button row; the `max-width` came with it.
Verification 27: presence is a property of the document, being read is a
property of the person.

---

## The ledger

**Re-points landing on `frontend-react/src/versions/`:** the two
`transition-requests` blocks (their second move, D2c having taken them from
the form to the vanilla version file) now sit in `model.ts`; `FINDING 5`'s
version half is in `VersionCardHost.tsx`, and gained an assertion that
`scheduleReconciliation` runs before `freezeCurrentState`.

**Coupling ledger** (`scripts/tests/version-card-coupling.test.mjs`), both
directions, one entry: `adopted-identity.test.mjs :: <module level>`.

**Inverted assertions:** `live-form.test.mjs` × 2 (the React card is the
live one; the card has its own mount and its own revert target), the
behind-the-line assertion, and the shell global surface, now four names.

**Both reverts are independent and both are proven**: the card's own
one-line revert is exercised by the injection sweep (restoring the tag is
DETECTED), and the form's one-line revert is exercised on a branch by
item 4.

---

## Verdict

Items 1 to 6 complete. Card walk 37/37, two-forms 15/15 three times,
visual 20/20 across 39 captures, injection sweep 10/10 as expected with a
green reverted run and four files byte-identical.

**The swap is sound.** One defect authored by this round is open, with its
reproduction committed, and it should be the first thing Phase 3 takes.

**Gate: all 21 stages passed** on `3bb8b2b`, the tree being reported.
463/463 pure, 92/92 database, 476/476 react, and 14 HTTP probes, every
number taken from the run rather than typed.
Transcript at `.verify/verify-1136774023795500.txt`.

**Not pushed.** Phase 3 follows on sign-off.
