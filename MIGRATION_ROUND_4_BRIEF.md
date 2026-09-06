# Migration Round 4: the version card

**Final, 2026-09-06.** Ruled by John this date: superseded vanilla files
retire on a one-round confidence window - each is deleted after the next
full round completes with no revert needed, in its own commit that also
retires that file's coupling-ledger entries, unloaded-file assertions
and (for the deal form) the parity suite, so nothing is left asserting
against a ghost. Under this policy, Round 4's close deletes
`opportunity-approval.js` (unloaded since Round 1) and
`account-detail.js` (unloaded since Round 2); the deal form and the
parity suite fall due at Round 5's close.

The last piece of the Commercials story: `frontend/opportunity-deal-versions.js`
(652 lines) rendered in React. Its workflow logic is already seam-clean
from Round 3's D2c rewrite; what migrates is the rendering, chiefly
`renderVersionList` (219 lines), the controls, the reason box and the
feedback line, inside `#deal-version-panel`.

**The governing constraint, ruled here:** the seam remains the interface
even React-to-React. The card keeps its `window.initOpportunityDealVersions`
entry, consumes whichever seam it is handed, and never reaches around the
interface into the React form, because the form's one-line revert hands
this card a vanilla adapter and the card must work against both. The
exact-set seam test continues to guard this. The card gets its own
load-order revert, independent of the form's.

Method per the skill, all Round 3 promotions in force, including: a swap
session verifies the surface's primary write path live in the same
session (rule from the Round 3 close), and the behaviour-enumeration-
before-build pattern.

---

## Phase 0: investigation (no product code)

1. Couplings to `opportunity-deal-versions.js`, count with instrument:
   tests, probes, markup references, and the Round 3 re-points that
   landed on it (transition-requests blocks). These re-point again when
   this file is superseded; enumerate them now.
2. `renderVersionList` enumerated as behaviours, B-style, before any
   build: the range toggle and its note, the track line, the approval
   line, per-state controls (draft/issued/approved/rejected, what shows
   when), the empty state, the newest-draft issue targeting, the
   restore control's per-row presence, escaping.
3. The approval-link interplay measured: `wireApprovalLink`, what
   `requestPricingApproval` and `oppPendingPricingApproval` do at the
   moments app.js calls the feeds, and what the card must keep
   publishing (`oppCurrentVersionRejection`, `oppRefreshVersionActions`)
   with identical semantics.
4. Endpoint census for the card's four routes; what round-trips versus
   renders-only. The reason box, feedback line and range state
   enumerated as behaviours (feedback's ok/error styling, reason
   required/cleared-when).
5. Fixture states: which version states (draft, issued, approved,
   rejected, restored-from) the sandbox can produce for the walk, and
   which only fixtures reach, named per the Round 1 pattern.

## Phase 1: the card, behind the line

React card in the bundle, unregistered; behaviours from Phase 0 item 2
implemented against contract-derived tests, red before green; values
through the same `src/lib` presenters; the reason box and feedback as
React state; fixtures obey the non-zero and independent-expression
rules; injections per behaviour with the verified-snapshot harness.

## Phase 2: the swap, whole in one session

The swap commit: bundle registers `initOpportunityDealVersions`, vanilla
tag removed (restore wins by load order), re-points in the same commit,
Verification 41 STRINGS-clause scan. THE PRIMARY WRITE PATH WALKED LIVE
IN THE SAME SESSION: save a version with reason, issue, restore with
fidelity, refusal path, against the React form AND against the vanilla
adapter on a branch (the two-forms guarantee). `live-form.test.mjs`
extended to detect which version card is live. The 22/28-check workflow
probe re-run. Visual comparison of the card at three widths, exercised
states (range toggled, reason filled, feedback showing, each version
state rendered).

## Phase 3: walk, revert rehearsal, close-out

The full walk; revert rehearsed both independently (card alone) and
combined (card and form both reverted, everything still works); rule
promotion check; CURRENT_STATE.md; close-out with the estate ledger.
Per the retirement ruling: this close-out deletes
opportunity-approval.js and account-detail.js, retiring their ledger
entries and unloaded-file assertions in the same commits, and records
the deal form and parity suite as due at Round 5's close. Each deletion
is verified as two claims: the file is gone, and nothing that remains
asserts against it.

## Exit gate for the estate's next round

1. The card works against both forms, proven on the swapped tree and
   the reverted branch.
2. The primary write path (save version, issue, restore with fidelity)
   walked live in the swap session and again at close.
3. The coupling and re-point ledgers updated with instruments; the
   retirement policy's first deletions landed if ruled.
