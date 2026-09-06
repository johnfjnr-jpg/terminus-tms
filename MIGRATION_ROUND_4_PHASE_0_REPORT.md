# Migration Round 4, Phase 0: the version card, investigated

Investigation only. No product code. Numbered against the brief's five items.

---

## 1. Couplings to `opportunity-deal-versions.js`

**Instrument, recorded with the count** per the Round 2 close-out rule: the
repository walked for `.ts/.tsx/.js/.mjs/.html/.md`, each file read BOTH raw and
through `readCode` (comments stripped), and every hit classified by what it
reads the name AS. Test files are split on `\ntest(` so the ledger is per-claim
rather than per-file.

**Ten files mention it. Six are couplings; four are prose.**

| class | files | mentions | disposition when the card is superseded |
|---|---|---|---|
| **markup, the script tag** | `frontend/index.html` | 2 | **the swap target.** One is the tag, one is prose in the comment beside the form's tag |
| **test: reads the file** | 4 files, 6 mentions | 6 | **re-point**, listed below |
| **probe or script** | `scripts/census-form-filter.mjs` | 3 | reads the file to decide which ids the FORM must adopt. Re-points to the React card |
| **comment only** | 4 files | 4 | no re-point; prose that goes stale, Architecture 9's fourth variant |

**The six test couplings, per claim:**

| file :: block | what it reads the file for |
|---|---|
| `transition-requests.test.mjs` :: `V1/V2/V4: the next major comes from the record, not from the draft` | **a Round 3 re-point.** It moved here from `opportunity-deal.js` in D2c and re-points again |
| `transition-requests.test.mjs` :: `the issue control targets a draft NEWER than the last issue, and says so when there is none` | **a Round 3 re-point**, same origin, same fate |
| `commercials-wiring.test.mjs` :: `FINDING 5: the note says what the code does, and the code does it` | the version half of a claim split across the seam in D2c |
| `live-form.test.mjs` :: `and the version machinery is live under BOTH forms` | asserts the tag is loaded. **This one INVERTS at the swap** rather than re-pointing: it must then assert the React card is live and the vanilla tag is not |
| `adopted-identity.test.mjs` (module level, line 16) | reads the file to prove the FORM's adoption list has a reader |
| `census-form-filter.mjs` (module level, lines 13, 18) | same, as the generator |

**The two `transition-requests` blocks are the ones the brief names**, confirmed
by measurement rather than taken on trust: both carry the D2c three-part
re-point comment and both moved from the form file.

**A finding about the ledger's shape.** `vanilla-coupling.test.mjs` enumerates
couplings to `opportunity-deal.js` and can only shrink. **There is no equivalent
for this file**, so Round 4 creates one at the swap or the same drift happens
again: a test reading a file the browser no longer loads, passing forever.

---

## 2. `renderVersionList`, enumerated as behaviours

219 lines, `opportunity-deal-versions.js:106-324`. Enumerated before any build,
B-style, so the tests can be derived from these rather than from the code.

### The range toggle and its note

| | behaviour |
|---|---|
| **R1** | the toggle is HIDDEN at five versions or fewer: there is nothing to range over |
| **R2** | exactly the active range carries `active`, matched on `data-range` |
| **R3** | `all` shows everything; a numeric range shows the FIRST n, and the list is newest-first |
| **R4** | the note reads `Showing n of N versions. k older version(s) are not listed.` and pluralises `is`/`are` on k |
| **R5** | with nothing hidden the note reads `Showing all N versions.` **only above five**, and is empty at five or fewer |
| **R6** | the note is hidden exactly when it is empty |
| **R7** | the range is version-card state and resets to 5 on init. Round 3 W4 moved that reset here from the form's `populateForm`, which was the form reaching into version state |

### The row

| | behaviour |
|---|---|
| **W1** | one `.ds-row` per shown version, newest first |
| **W2** | the label carries an inline `draft`/`issued` word; anything not `issued` reads `draft` |
| **W3** | the author is `issued_by_email` for an issued version and `created_by_email` otherwise, falling back to `unknown author` |
| **W4** | the timestamp is the ISO minute of `issued_at ?? created_at` |
| **W5** | the section count reads `n section(s) recorded` and carries the full list in `title` |
| **W6** | **every row carries a Restore control**, unconditionally: no state suppresses it |
| **W7** | **everything interpolated is escaped** - label, reason, author, timestamp, section list, and the version id inside `data-restore-version`. The approval and track lines are the two exceptions and escape internally |

### The approval line, per state

Seven states, and **all seven are reachable**: `approved`, `superseded`,
`unknown`, `rejected`, `none`, `unapprovable`, `inconsistent`.

| state | line |
|---|---|
| `approved` | `Approved at revision N, and the pricing has not changed since.` |
| `superseded` | `SUPERSEDED. ... the pricing has changed since: <named keys>. Take a new version and have it approved.` |
| `unknown` | `... but whether the pricing has moved since could not be determined. Report this rather than reading it as approved.` |
| `rejected` | `Rejected at revision N.` |
| `none` | `Not yet approved.` |
| `unapprovable` | `Taken before versions recorded their revision, so it cannot be approved.` |
| `inconsistent` | `Names revision N, which this record has not reached. Report this.` |

**AN INSTRUMENT CAVEAT, recorded because it nearly became a false finding.** A
scan for `state: '<literal>'` in the evaluator returned SIX states against the
card's seven, which reads exactly like a dead branch. `superseded` is produced at
`version-approval.js:214` inside a **ternary**, which that shape cannot see. The
card has no dead branch. Verification 39's family: a literal-shape scan measuring
something it cannot express.

`inconsistent` is documented in the evaluator as **unreachable by construction**,
with the reasoning, which makes it a fixture-only state (item 5).

### The track line

| | behaviour |
|---|---|
| **T1** | it renders ONLY for the version the open pricing request froze (`pending.frozen_version_id === v.id`); every other row gets an empty string |
| **T2** | each required track reads `approved`, `REJECTED` (capitalised) or `waiting` |
| **T3** | with no required tracks it renders nothing at all, rather than an empty prefix |
| **T4** | the prefix is `Under approval since <formatted>`, and the formatter says `an unknown time` for a missing date |

### The issue control

| | behaviour |
|---|---|
| **I1** | the target is a draft whose major EQUALS the highest issued major: **the newest draft, not the latest** |
| **I2** | enabled only when such a draft exists |
| **I3** | its label names both versions: `Issue V2.1 as V3` |
| **I4** | with no target, the label reads `Save a new version to issue` and the title distinguishes "a version is issued and nothing newer exists" from "nothing has been saved" |
| **I5** | the whole control is hidden when `oppVersionGateApplies()` is false |

### The empty state

**E1**: `No versions saved yet. V0.1 is the first.` - it names the act and the
label that act produces, rather than reporting an absence.

---

## 3. The approval-link interplay

### What the card must keep publishing

| feed | called by | when |
|---|---|---|
| `window.oppCurrentVersionRejection()` | `app.js:1191` | at render time, inside the rejection banner. Returns the CURRENT issued version's rejection or null |
| `window.oppRefreshVersionActions()` | `app.js:8069` | after `stage-approvals` resolve |

**Both are read at the moment app.js chooses, never cached, and app.js says why
at each site:** the versions load after the banner first runs, and the deal
module renders before `stage-approvals` resolves. **A React card must publish
both with identical semantics, including that `oppCurrentVersionRejection`
answers from the CURRENT issued version rather than from request history.**

### THE FINDING: app.js writes INTO the card's DOM

Measured across all eleven of the card's ids. `app.js` touches exactly **two**:

| id | app.js |
|---|---|
| `btn-request-pricing-approval` | `1298` - disables it and sets `Requesting...` |
| `pricing-approval-state` | `1297`, `1317`, `1327` - clears it, then writes the outcome |

All four writes are inside `window.requestPricingApproval`, which the card calls
via `ask.onclick`. **So the card hands control to app.js, and app.js then drives
two of the card's elements by id.**

**For a React card this is the sharpest constraint in the round.** Those two
elements cannot be ordinary React state: app.js's imperative writes would be
overwritten by the next render, silently, and the button would re-enable itself
mid-request. Round 4 must decide between (a) keeping both as
app.js-owned DOM the card renders but does not control, (b) giving the card a
callback interface app.js calls instead, or (c) moving `requestPricingApproval`'s
UI half into the card. **This is a decision, not an implementation detail, and it
belongs before Phase 1.**

`wireApprovalLink` is by comparison trivial: a once-only listener on
`#btn-open-approval` that navigates to `opportunity-approval`, guarded by a
per-element `dataset.wired`.

---

## 4. Endpoint census, and the card's own state

### Four routes

| method | route | after the response |
|---|---|---|
| `GET` | `/api/opportunities/:id/deal-sheet-versions` | render + `applyReasonPrompt`. **Render only** |
| `POST` | `/api/opportunities/:id/deal-sheet-versions` | clears the reason box, **ROUND TRIPS** via `loadVersions()`, then feedback |
| `POST` | `/api/deal-sheet-versions/:id/issue` | **ROUND TRIPS** via `loadVersions()` |
| `POST` | `/api/deal-sheet-versions/:id/restore` | **NO round trip.** It populates the form through the seam, recomputes, and reports. Correct: a restore changes the form, not the version list |

The save carries `expected_revision` from `window.getOppLoadedRevision()`, so the
card depends on the shell's revision holder as well as on the seam.

### The reason box

| | behaviour |
|---|---|
| **N1** | required. Blank refuses with `reasonPrompt().refusal`, focuses the box, and **writes nothing** |
| **N2** | the prompt CHANGES BY CONTEXT via `reasonPromptFor(dealVersions.length)`: a first version asks what the price is based on, a later one asks what changed. Label and placeholder both |
| **N3** | cleared on a successful save only, before the reload |
| **N4** | typing in it must not dirty the form: it is not a deal input |

### The feedback line

| | behaviour |
|---|---|
| **F1** | `msg-success` when ok, `msg-error` when not, `hidden` when empty. The class is REPLACED, never toggled, so the three states are exclusive by construction |
| **F2** | a refused save that ALSO saved the pricing says both: `Your pricing was saved, but the version was not taken: ...` |
| **F3** | a successful save distinguishes `Pricing saved, and V0.1 taken from it.` from `V0.1 taken.` |
| **F4** | `clearDealFeedback()` runs first on every version action, clearing both this line and the form's |

### Two refusals before any write

`saveVersion` refuses on the contractor schedule twice: once when it is
incomplete (`incompleteStatement`) and once when it does not reconcile
(`refusalStatement`). **Both run BEFORE the freeze**, so a refused version writes
nothing at all - which is why the reconciliation base comes from `recompute()`
rather than from `freezeCurrentState()`, recorded in D2c.

---

## 5. Fixture states for the walk

| state | reachable in a walk? | how |
|---|---|---|
| **draft** | **yes** | save a version. Walked in Round 3 |
| **issued** | **yes** | click Issue. Walked in Round 3 |
| **restored-from** | **yes** | Restore, through the discard prompt. Walked in Round 3 with full fidelity |
| **none** (not yet approved) | **yes** | the default for any new version |
| **approved** | **NO - fixture only** | a pricing approval needs decisions on the required tracks, and `decide_transition_request` reads `auth.uid()` and refuses the requester approving their own request (migration `20260831000004`). **One account cannot produce this state end to end** |
| **rejected** | **NO - fixture only** | same rule, same reason |
| **superseded** | **NO - fixture only** | it is `approved` plus a subsequent pricing change, so it inherits approved's blocker |
| **unknown** | **NO - fixture only** | requires an approved version whose comparison is not comparable |
| **unapprovable** | **NO - fixture only** | a version taken before versions recorded their revision. No live path creates one now |
| **inconsistent** | **NO - fixture only, and the source says so**: documented as unreachable by construction, closed by a composite foreign key |

**Named per the Round 1 pattern:** four states walk end to end, six need
fixtures, and **the reason for all six is the same single rule** - the
self-approval refusal - or a construction the writer cannot produce. That is a
better position than it looks: the six are all APPROVAL-LINE states, so one
fixture builder that plants approvals against a version covers every one, and
the walk covers the whole lifecycle the card's own controls can drive.

**The fixture builder does not exist yet.** Round 3's `scripts/fixtures.mjs`
creates records and opportunities; nothing plants an approval on a version.
Building it is Phase 1 work and should be named in that phase's scope.

---

## 6. Discrepancies

**None that stop the round.** Three things are recorded rather than resolved:

1. **`app.js` writes into two of the card's elements** (item 3). A decision is
   needed before Phase 1 builds those two controls.
2. **No coupling ledger exists for this file** (item 1). Round 4's swap should
   create one, as Round 3 did for the form.
3. **The approval-state fixture builder does not exist** (item 5), and six of
   the ten version states depend on it.
