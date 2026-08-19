# Round 10 build brief: Reference tab layout, interaction defects, Closed record panel

Source of truth: `CLAUDE.md`, `CURRENT_STATE.md`, `DESIGN_PRINCIPLES.md`,
`PROTOTYPE_SPECIFICATION.md`, `INTERACTION_STANDARDS.md`,
`ROUND9_BUILD_BRIEF.md`. Read all six before starting.

This round is frontend and interaction. Almost every item came from a real
person using the system rather than from a test, which is a different and
more valuable source than any prior round has had.

Work through phases in order. Stop after each, report real test evidence,
wait for sign-off before starting the next.

---

## Scope boundaries, confirmed with the business

- **Installer and Test Bed Tech Team are Round 11**, alongside the scoring
  framework. Both need gate rules and a data model change, so they are not
  frontend and do not belong here.
- **Record history is Round 12.** Per-field change trail, criterion
  authorship, surfaced from `audit_log`. One mechanism serving three needs,
  and it is the same mechanism Round 11's scoring history requires.
- **Customer Documents and Google Drive are Round 13.** Client-supplied
  material such as site drawings and QHSE guidelines. The concept has no
  table, no panel and no records today, and its absence from the Reference
  tab is correct rather than a defect.
- **No gate rule changes in this round.** `stage_gate_rules` ends this round
  at the same 54 rows, 38 on `test_bed`, that Round 9 measured. Phase 7's
  invariant 1 asserts exactly that, so any change here fails the suite,
  which is the intended behaviour.

---

## Standing rules that govern this round

`CLAUDE.md` applies in full. Three items from it bear directly on this
round's work and are restated because each has already produced a defect
here:

1. **Layout verification: measure the container, not the element.** A card
   can report a healthy width inside a container that can never fit it.
   Assert a minimum usable width, run overflow checks on block-level
   elements, and open the screenshot and look at it.
2. **Never verify on a fixed delay.** Round 6 Phase 3 and Round 8 Phase 6
   both recorded checks that resolved against the previous tab's stale
   content. Wait on real state. The `dataset.stage` markers added in Round 9
   Phase 6 exist for this.
3. **Display renames stay display renames.** Several items below change
   labels. None of them changes a payload key, an endpoint key or a column.

---

## Phase 0: Investigate and report. No building.

Report before Phase 1 starts. Direct reads of the real code, not
inferences from any document.

1. **Regenerate `CURRENT_STATE.md` and confirm it is current.** Round 9
   closed at `efa1ea3` and the merge to `main` was a fast-forward, so the
   configuration should be unchanged. Report any delta. Harness
   accumulation is expected and is not a finding.

2. **The two-click dropdown.** Reported live on Commercial Authority and
   described as affecting all Terminus Details dropdowns: a first click
   focuses without opening, a second is needed. **Round 8 Phase 1
   investigated this exact symptom and could not reproduce it**, then found
   and fixed a different real defect instead. Reproduce it now, on the
   merged build, and report what state the control is actually in after the
   first click before proposing any fix. If it still cannot be reproduced,
   say so plainly rather than fixing speculatively.

3. **The stale render.** Two symptoms, one suspected cause. Switching to a
   stage tab shows the previous stage's data until the fetch resolves, and
   a criterion tick takes a visible time to register. Report whether these
   are the same defect. Phase 8 recorded that each approval triggers its own
   re-render while the previous request is in flight, so check that path
   specifically. Report what the panels do today between the click and the
   response landing.

4. **New Contact dialogue: the Save navigation.** Saving returns the user
   to the Leads page rather than staying in context. Report where that
   navigation is triggered and whether the dialogue has more than one
   caller, since the correct destination may differ by caller.

5. **Test Bed name.** Round 5 Phase 2 recorded that `name` is
   server-writable but carries no edit affordance, which is why
   auto-suffixing was chosen over a name prompt. **Wording corrected in
   Phase 0: that entry, and this brief's first version, both said "never
   rendered". The accurate statement is rendered read-only with no edit
   affordance** - `name` renders as a plain `<h1 id="tb-detail-name">` set
   via `textContent`, with no `onclick`, no `tabindex` and no
   `.ref-field[data-key="name"]` anywhere. What is absent from every field
   array is the click-to-edit control, not the display. Confirm that is
   still true, and confirm what `POST /contacts/:id/create-test-bed`
   currently sets it to.

6. **Baseline the suite.** `npm test` and `npm run test:db` both passing on
   a clean checkout of `main` before anything is touched.

---

## Phase 0A: One click reveals and opens a click-to-edit control

**Added after Phase 0, which reproduced the two-click dropdown that Round 8
Phase 1 could not. This is a scope addition and it is its own phase,
deliberately not folded into Phase 2 or Phase 3.** Same reasoning as Round 9
Phase 4A: it is a **mechanism change** in a round whose other phases are
layout and configuration, and folding a mechanism change into a layout phase
hides it inside a change of a different kind. It also has to land first,
because Phase 3.2 would otherwise add a ninth affected control to a defect
that is already eight wide.

### What Phase 0 established

The reported symptom is exactly accurate and the cause is not the dropdown.
In `tbFieldRow` the closed field is a `<div class="ref-field-display"
onclick="openTbField(key)">` and the control lives in a **sibling**
`<div class="ref-field-edit hidden">`. `openTbField` hides the div, unhides
the sibling and calls `input.focus()`. The click that reveals the control is
consumed by a different element, so it can never also open it. Measured
directly: after the first click the `<select>` is revealed, focused, and
sitting under the pointer, having received **zero** pointer events.

**Eight controls are affected, not the one reported**, per the standing rule
that a fix built for the reported instance is not a fix for the class:

| Panel | Fields | Control |
|---|---|---|
| Terminus Details | `terminusLead`, `commercialAuthority`, `technicalAuthority`, `terminusLegalOwner`, `region` | `<select>` |
| Site Details | `siteOwnership` | `<select>` |
| Key Dates | `estimatedInstallationDate`, `estGoLiveDate` | `<input type="date">` |

Seven text, number and textarea fields on the same tab are **not** affected:
focus alone is enough to start typing there, so one click genuinely works.
The defect is specific to controls with a popup layer.

### Requirements

1. A single click on a closed click-to-edit field both reveals **and** opens
   the control, for all 5 selects and both date pickers.
2. **The 7 text and number fields keep their current behaviour exactly.**
   They were never affected, and a change that makes them worse in service
   of the other 8 is a regression, not a fix.
3. Do not change what any field saves, validates or writes. This is an
   interaction fix, not a data change.
4. The keyboard path (`Enter`/`Space` on the display element, already built)
   must keep working, and must not be made to depend on a pointer event.

### Test evidence required

Prove it with **the same instrumentation that reproduced it**, not by eye:
count real `mousedown` events reaching the control itself after a single
real click at the closed field's own centre. Before the fix that count is 0
on all 8; after it, a single click must reach and open the control on all 5
selects and both date pickers. Confirm the 7 unaffected fields still open,
focus and accept input as they do today. Scroll each field into view before
clicking, since a viewport-relative click below the fold silently lands
somewhere else and reports a false negative.

---

## Phase 1: Test Bed name

Reported twice, in two separate testing sessions.

1. **The creation dialogue accepts a Test Bed name.** Today the record is
   created with the Account name and an auto-suffix, so a second Test Bed
   for the same client becomes "Willowglen (2)".
2. **The name is editable after creation**, on the Reference tab, following
   the same click-to-edit pattern every other field uses.

**Keep the auto-suffix as the default**, populated into the dialogue field
rather than applied silently. It is a sensible starting value and the user
can accept or replace it. Round 5 Phase 2 chose auto-suffixing precisely to
avoid a prompt; this reverses that decision deliberately, because the
resulting names are not usable in practice. Record the reversal.

**Test evidence required:** create a Test Bed from a Contact, confirm the
dialogue offers the suffixed default and accepts a replacement. Confirm the
name persists, verified server-side. Edit it afterwards and confirm the
change persists and appears in the header. Confirm two Test Beds for the
same Account can carry genuinely different names.

---

## Phase 2: Reference tab layout

All four items confirmed by the business, described against the annotated
screenshot supplied with the original feedback.

1. **Summary moves in line with the Test Bed name**, at the top of the
   page. Round 8 Phase 5 placed Summary and the last two notes beneath the
   name, stacked. Summary comes up; Notes go down.
2. **Notes move to the bottom of the page**, retaining the two-most-recent
   default with expansion to full history built in Round 8 Phase 5.
3. **Panel order becomes Terminus Details, Customer Details, Site Details,
   Key Dates.** Today it is Terminus, Customer, Key Dates, Site Details.
4. **Customer Details narrows** from the `.pg-card-wide` two-track span
   given in Round 6 Phase 2.

**Item 4 is only safe because of the label changes in Phase 3, and the two
must ship together.** Round 6 Phase 2 widened that panel specifically to
stop the buyer role dropdown and its actions truncating, confirmed live in
a screenshot at the time. Narrowing it without shortening the labels
reintroduces a bug fixed two rounds ago. If Phase 3 is deferred for any
reason, item 4 is deferred with it.

**Test evidence required:** screenshots at 1240px, 1920px and 3440px,
before and after. Confirm the panel order, confirm Summary renders in line
with the name, confirm Notes render at the bottom with the two-note default
and working expansion. Confirm no label or value truncates in the narrowed
Customer Details panel at any tested width, specifically the buyer role
dropdowns.

---

## Phase 3: Label shortening and Installation Environment

### 3.1 Labels

Per the business's own table, with one amendment. Display only, no payload
or column changes.

- The "CLIENT BUYERS" grouping label is removed.
- Buyer labels shorten to COMM. BUYER, TECH. BUYER, LEGAL BUYER.
- Terminus Details labels shorten correspondingly, COMM. AUTH, TECH. AUTH,
  LEGAL AUTH.
- **Installation Environment renders as INST. ENV., not INT. ENV.**
  Confirmed with the business: "Int." reads as Internal or International,
  and "Inst." is consistent with the existing "Est. Inst Date".

### 3.2 Installation Environment becomes a picklist

**Blocked on Phase 0A, which must land first.** `installationEnvironment` is
a text input today and is therefore one of the 7 fields Phase 0 found
unaffected by the two-click reveal defect. Converting it to a `<select>`
moves it into the affected set, making it a **ninth** instance of a defect
that is already eight wide. Do not build 3.2 until 0A is signed off, and
include this field in 0A's own evidence once it exists.

Values: **Indoor, Outdoor, Both.** Follow the existing
`VALID_SITE_OWNERSHIP` hardcoded-array convention in `test-beds.js`, which
matches `VALID_SOURCES` elsewhere. Do not create a picklist table; the
business has confirmed these move to an Admin-configured list later, and a
table built now would be a second home for the same decision.

**Existing data must be mapped, not stripped.** At least one live record
carries the free-text value "Indoor and Outdoor", which maps to **Both**.
Survey every live and soft-deleted Test Bed for existing values before
writing the migration, report what is actually there, and map each one
explicitly. A value that does not map is reported, not silently cleared.

**Test evidence required:** confirm the picklist offers exactly three
values and rejects anything else server-side, not only in the browser.
Confirm every pre-existing value was mapped, by direct query before and
after. Confirm no label anywhere still reads "Int. Env.".

---

## Phase 4: New Contact dialogue, two defects plus one re-scoped

All three reported live. **Item 3's premise was refuted by Phase 0 and is
re-scoped below to the real cause.**

1. **Mobile accepts free text.** Add validation. Be deliberate about how
   permissive it is: international numbers carry `+`, spaces, parentheses
   and hyphens, and a validator that rejects them is worse than none.
   Report the rule chosen before building it.
2. **Region should populate from City. DECLINED in Phase 4, on evidence,
   which this item was explicitly written to allow.** Reported before
   building, as required. **Region already auto-populates, from Country**,
   via `regionForCountry()` - a line-cited port of the prototype's own
   function (`Terminus Ops.dc.html:7510-7523`) wired to the Country field,
   confirmed working live across all five regions. Country is a strictly
   better key than City for a continent-scale Region: country-to-region is
   a total, unambiguous function, whereas Newcastle alone spans three of
   the five regions and Tripoli splits Africa from Middle East. The live
   data agrees by accident - one record holds city `"Singapoer"` with its
   country correct, so the misspelling sits in the field the proposal
   wanted to key on. Second time a location-derivation heuristic has been
   declined against real data, after Round 2 Phase 6. Recorded in
   `DESIGN_PRINCIPLES.md`; Region stays as it is.
3. **RE-SCOPED after Phase 0. The original premise is refuted, and the
   original fix would have changed working code.** This item read "Save
   returns to the Leads page. The user should stay in the context they were
   working in." Phase 0 established that **neither contact-creation dialogue
   navigates to Leads, or anywhere else.** There are exactly two in the
   whole frontend, confirmed by sweeping every `POST /api/contacts` caller:
   `saveContact` (New Lead modal) ends in `closeNewLeadModal()` then
   `loadContactsData()` and does not navigate at all, and its trigger button
   exists only inside `view-leads`, so the user was already there;
   `saveInlineBuyerContact` has two callers, Test Bed and Opportunity, and
   already reloads the originating record for each. Both are already
   correct.

   **Do not touch `saveContact` or `saveInlineBuyerContact`.**

   **What to fix instead:** `init()` in `frontend/app.js` wires
   `supabaseClient.auth.onAuthStateChange` with **no event filter**, and the
   handler calls `showApp(session)`, which ends with `navigate('leads')`. So
   every session-bearing auth event re-runs the entire sign-in path,
   navigation included. Supabase refreshes the access token automatically in
   the background, so roughly once an hour the user is silently returned to
   Leads from wherever they were. Reproduced directly in Phase 0: a
   `visibilitychange` and a window `focus` event each produced no auth event
   and no navigation, and a genuine `refreshSession()` produced
   `TOKEN_REFRESHED` and moved the app to `view-leads`.

   Fix the handler so a `TOKEN_REFRESHED` event updates the session without
   re-running the sign-in path or navigating. A genuine sign-in must still
   land on Leads as it does today.

   **Record in `DESIGN_PRINCIPLES.md`** that a periodic background event
   which steals the user's place misattributes as a bug in whatever the user
   last did, and that the original report of this did exactly that: it named
   a save path that has never navigated anywhere. Already written up at
   Phase 0; keep it current if the fix changes anything about the mechanism.

**Test evidence required:** confirm a valid international mobile number is
accepted and genuine free text is rejected, server-side. For Region, either
confirm correct population against at least four real addresses spanning
the regions Terminus operates in, or report the approach as unreliable and
leave the field manual. For item 3, drive a real token refresh while sitting
on a Test Bed detail page and confirm the view does **not** change, using
the same reproduction Phase 0 used; then confirm a genuine fresh sign-in
still lands on Leads, so the fix has not simply disabled the handler.

---

## Phase 5: Stale render and in-flight state

**SPLIT into 5A and 5B after Phase 0.** The brief assumed "two reported
symptoms, one suspected cause". Phase 0 established **two defects sharing
one cause but needing different fixes**: fixing either does nothing for the
other. They are separate phases with separate evidence, and 5A is measured
again after its first step because that measurement may change what 5B
needs.

**The shared cause, stated once:** no path in the stage panels renders
anything at the moment of the user's action. Every visible change waits on
at least one server round trip, and there is no pending state, so the only
two states are showing old data and showing new data.

**Standing constraint for both:** do not build a fixed delay, a debounce
tuned by trial, or a spinner that hides the problem rather than fixing the
ordering. Whatever indicates loading must not become permanently-static UI;
the standing decision against empty panels applies.

---

### Phase 5A: Stale content presented as current

The tab-switch defect. Measured live in Phase 0 on `TT-SGP-AIRPRT-008`,
Pre-Site Assessment to Site Assessment, sampled every animation frame:

| | settled at |
|---|---|
| heading said "Site Assessment" | t = 23ms |
| documents panel still showed Pre-Site's "NDA" | t = 674ms (**651ms stale**) |
| criteria panel still showed Pre-Site's criteria | t = 2057ms (**2034ms stale**) |

For two seconds a person sees the new stage's heading above the previous
stage's documents and criteria, with nothing distinguishing it from settled
content. `loadTbStageDetailTab` sets the heading synchronously, then awaits
the fetches without clearing or marking the panels.

**Do these two steps in this order, and measure between them.**

1. **Parallelise the three fetches first.** Phase 0 found them strictly
   sequential: `document-requirements` 654ms, `stage-approvals` 310ms,
   `exit-criteria` 1070ms, summing to exactly the 2034ms criteria settle
   time. The criteria panel waits on two fetches it does not depend on.
   **Then measure again**, with the same per-frame sampling, and report the
   new figures. This step alone should cut the criteria stale window to
   roughly the cost of its own fetch, and it changes what remains for step 2
   and possibly for 5B.
2. **Then render a pending state synchronously**, so a panel showing data
   for a stage other than the one selected is never displayed as though it
   were current.

**Test evidence required:** the before figures above are the baseline.
Report after-figures for step 1 and step 2 separately, so it is visible what
each bought. Switch between three stage tabs in quick succession and confirm
no panel ever displays another stage's content as current, verified against
`dataset.stage` rather than by eye. Confirm the automated suite still waits
on real state and not on the new mechanism's own side effects - and note
specifically that if step 2 introduces a loading indicator, waiting on that
indicator is waiting on the fix rather than on the data.

---

### Phase 5B: Action latency with no local feedback

The tick defect. Two paths, both of which change nothing in the DOM at the
moment of the click:

1. **`toggleExitCriterion`** awaits a `PATCH`, then awaits
   `renderTbStageExitCriteria()`, which itself awaits a
   `GET /exit-criteria`. **Two serial round trips before the tick mark
   changes.** The GET half alone measured 1070ms in Phase 0, which is a
   floor on the visible lag rather than an estimate.
2. **`submitStageApproval`** calls `loadTbStageDetailTab` on success - the
   entire three-fetch, ~2s tab reload - and that function's first act is
   `++tbStageTabLoadToken`. A second approval ticked while the first is
   still reloading **invalidates the first reload**, which returns early and
   never writes. This is Round 9 Phase 8's "each approval triggers its own
   re-render while the previous request is in flight", confirmed.

**Note the coupling, because it is why these read as one defect from the
outside:** because the approval path reuses `loadTbStageDetailTab`, ticking
an approval re-enters 5A's stale window and briefly redisplays stale
criteria. That is exactly the Phase 8 symptom of a red criteria row beside
an enabled Next Stage button.

Requirements:

1. A tick reflects its own result without waiting on an unrelated request.
2. The approval path stops triggering a full tab reload.

**Test evidence required:** demonstrate the defect first, reproducibly, then
demonstrate its absence. Tick two criteria in rapid succession and confirm
both register correctly. Tick two approvals in rapid succession and confirm
neither is discarded. Report the measured click-to-visible-change time
before and after, for both the criterion tick and the approval tick.

---

## Phase 6: Transition lands on the next stage's tab

Confirmed with the business, settling a decision open since Round 8 Phase 1
and measured in Round 9 Phase 8 as **seven of the walkthrough's 59 clicks
existing only because of this**.

On a successful transition, the user lands on the tab for the stage the
record has just entered, not on Reference.

**One exception, confirmed: the final transition lands on Closed**, which
Phase 7 below gives something to show. Before Phase 7 is built, Closed
renders nothing, so sequence these two together or land the final
transition on Reference until Phase 7 completes. State which was done.

**Done: Phase 6 landed the final transition on Reference, and Phase 7
removed that exception.** Phase 6 was not sequenced with Phase 7. The
exception was one condition in one place and was deleted when Closed gained
a real panel; all seven landings re-verified after the removal, T7 on
`stage-Closed`.

**Test evidence required:** drive a Test Bed through all seven transitions
in the browser and confirm each lands on the correct tab. Confirm the click
count for the lifecycle drops by the expected amount against Round 9 Phase
8's measured 59, and report the new figure.

---

## Phase 7: Closed shows the completed record

Confirmed with the business, and it replaces Round 9 Phase 6.3's decision
that Closed renders nothing. Record the supersession with the original
reasoning left visible.

The Closed tab shows a single read-only panel listing **every document
produced across the whole lifecycle**, with its URL.

- **Grouped by stage, in lifecycle order.** A flat list of nine documents
  loses the shape of what happened; grouped, it reads as a record of the
  engagement.
- **Read-only. No Confirm control, no editable URL.** A closed Test Bed's
  documents are the record, and altering them after closure undermines the
  audit trail. Where something genuinely must change, the backward
  transition path built in Round 9 Phase 4A exists and records the move as
  a regression.
- The original rule stands elsewhere: this is not a licence to show empty
  panels on other terminal states. It is specifically that a panel which
  becomes meaningful at Closed, and is genuinely full when reached, is the
  opposite case to the empty cards Phase 6.3 removed.

**Test evidence required:** open the Closed tab on a completed Test Bed
with all nine documents and confirm all nine render, grouped by stage in
lifecycle order, with their URLs. `TT-SGP-AIRPRT-008` from Round 9 Phase 8
carries a full set. Confirm no editable control appears. Confirm the panel
degrades sensibly on a Test Bed reaching Closed with documents missing,
which is possible today via the backward transition path. Screenshots at
the tested widths.

---

## Phase 8: Sensors panel

Requested by the business: the Sensors list on the Reference tab becomes a
**Show Sensors** toggle, and each sensor renders as its own panel rather
than as a flat list.

**Panel contents are deliberately minimal for now.** The business has
confirmed that per-sensor detail is later work. Each panel carries the
sensor identity and the existing "not yet linked to a real device" state.
Do not invent fields. Mark the panel as having space for detail rather than
filling it speculatively.

This is the visible surface of a real gap: sensor counts are typed numbers
with no link to any device record, and Asset Management is where that
connects. Record it as such rather than as a layout item.

**Test evidence required:** confirm the toggle shows and hides, confirm one
panel renders per sensor on a Test Bed with a real mixed count across
SafeSight, air quality and HEMIR, and confirm layout degrades gracefully at
1240px with a high sensor count. Screenshots.

---

## Phase 9: Regenerate and reconcile

Re-run `scripts/state-dump.mjs` and commit the regenerated
`CURRENT_STATE.md`.

1. **`stage_gate_rules` must be unchanged at 54 total, 38 on `test_bed`.**
   This round configures no gates. A change here is a defect, not a delta
   to explain.
2. **`TEST_BED_WRITABLE_KEYS` may change** if Phase 3.2 alters how
   Installation Environment is handled. Account for it if so.
3. Diff against the Round 9 close-out file and reconcile line by line
   against this brief's phase list. A change no phase accounts for is a
   finding.
4. Expect harness accumulation to have moved. It is known, unfixed, and not
   this round's scope.

**Test evidence required:** the committed file, the full diff, and a
line-by-line reconciliation. Confirm no secrets and no client data by
direct inspection.

---

## Documentation discipline

Update `DESIGN_PRINCIPLES.md` the moment a decision changes during the
build. Four things need recording regardless of outcome:

- **The Test Bed name reversal.** Round 5 Phase 2 chose auto-suffixing
  specifically to avoid a creation-time prompt. Two testing sessions found
  the resulting names unusable. Record what changed and why.
- **Closed superseding Round 9 Phase 6.3**, with the original reasoning
  left visible and the distinction stated: the rule was against
  permanently-empty UI, not against terminal-stage UI.
- **Phase 0 item 2's finding on the two-click dropdown**, whichever way it
  resolves. Round 8 could not reproduce it and this is the second report.
  **Resolved in Phase 0: reproduced, 8 controls wide, cause is the
  click-to-edit reveal rather than the dropdown.** Record what Phase 0A
  changes, and record that the reason Round 8 found nothing is most likely
  that there is no defect in the dropdown to find.
- **Phase 4 item 2's outcome on Region.** If the mapping proves unreliable,
  that is the second time a location-derivation heuristic has failed
  against real international data, and the pattern is worth naming rather
  than rediscovering a third time.
- **Phase 4 item 3's re-scope**, already written up at Phase 0: a periodic
  background event that steals the user's place misattributes as a bug in
  whatever the user last did, and the original report named a save path that
  has never navigated anywhere.
- **The `state-dump` / `test:db` collision**, already written up at Phase 0:
  a dump taken while the suite runs reports harness fixtures as
  configuration, and is indistinguishable from a real abandoned-fixture
  finding.
- **The Test Bed name wording correction.** "Never rendered" was wrong in
  both `DESIGN_PRINCIPLES.md` and this brief's first version; rendered
  read-only with no edit affordance is the accurate statement.

Before declaring this round complete, check the phase count against this
document's own list with `grep -n "^## Phase\|^### Phase"`, and confirm
every phase has an explicit sign-off. Rounds 3 and 5 both recorded a
premature completion claim caught only by doing exactly that. **Note the
grep pattern changed with the Phase 5 split**: 5A and 5B are `###`
subheadings and a `^## Phase` grep alone will miss them and undercount.
**The list is now 12: 0, 0A, 1, 2, 3, 4, 5A, 5B, 6, 7, 8, 9**, with Phase 5
itself a shared preamble rather than a phase to sign off.
