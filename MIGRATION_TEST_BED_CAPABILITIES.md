# The Test Bed surface's capabilities, as behaviours

**Round 7 Phase 0b, 2026-09-07.** Written from `frontend/test-bed-detail.js`
before any of it is built, completing the ten the Phase 0 report left
enumerated only by name.

**The accounting lists twenty capabilities.** Ten were enumerated in Phase 0
(view-lifecycle, field-rows, save-path, cost-preview, date-bounds, validation,
site-details, commercials, buyer-roles, install-section). These are the other
ten.

**Fifteen endpoints beyond the record PATCH**, which is the honest measure of
this surface's width:

```
GET    /records/:id/exit-criteria        GET    /records/:id/history
GET    /test-beds/:id/units              PATCH  /test-beds/:id/units/:unitId
POST   /test-beds/:id/units/derive       GET    /test-beds/:id/customer-documents
POST   /test-beds/:id/customer-documents DELETE /test-beds/:id/customer-documents/:docId
PATCH  /test-beds/:id/installer          POST   /test-beds/:id/tech-team
POST   /test-beds/:id/buyer-contacts     POST   /test-beds/:id/scores
POST   /test-beds/:id/measurability
```

---

## N. NOTES

**N1.** Read from `tbPayload.notes`, latest first. Empty reads `No notes yet.`
**N2.** The section TITLE changes with the list - plain `Notes` when empty.
**N3.** A note carries a STAGE CHIP (`tbNoteStageChip`): which stage the record
was at when it was written. A note is a record of a moment, and the moment
includes the stage.
**N4.** Added through `tbPatch({ payload: { notes } })` - the same record PATCH
and the same revision handshake as a field save, so a note cannot land on a
stale record.
**N5.** Expand/collapse is view state only (`tbNotesExpanded`), not persisted.

## H. REVISION HISTORY

**H1.** `GET /records/:id/history`, rendered read-only.
**H2.** It is the ONLY capability on this surface that writes nothing.
**H3.** It lives behind a Reference sub-tab, so it is fetched on demand rather
than with the record.

## U. USE CASES

**U1.** A list on `tbPayload.useCases`. Empty reads `No use cases yet.`
**U2.** Add and remove are both **whole-list writes** through
`tbPatch({ payload: { useCases } })` - read, modify in JavaScript, write back.
**U3. THAT IS A READ-MODIFY-WRITE and the revision handshake is what makes it
safe.** Two people adding a use case concurrently would otherwise lose one; the
precondition refuses the second instead.

## D. CUSTOMER DOCUMENTS

**D1.** Its own resource: `GET`, `POST`, `DELETE /test-beds/:id/customer-documents`.
**D2.** Fetched when its sub-tab renders, not with the record.
**D3.** Empty reads `No client documents yet.`
**D4.** Add and remove are **immediate**, not batched - they are their own
writes and do not join the field save.
**D5.** `tbCustDocFeedback` carries a message per attempt.

## I. INSTALLER

**I1.** A search-and-set control, not a field: `PATCH /test-beds/:id/installer`.
**I2.** The search reads Account contacts and is stateful
(`tbInstallerSearching`, `tbInstallerContacts`).
**I3.** Setting is immediate.
**I4.** `tbInstallerFeedback` is its own message channel.
**I5.** Open and close are explicit (`openTbInstallerSearch` /
`closeTbInstallerSearch`), so the panel is not a modal.

## T. TECH TEAM

**T1.** `POST /test-beds/:id/tech-team`, immediate.
**T2.** Rendered as a row but it is a direct-write control.
**T3.** The linked person is read from `tbBed.buyer_contacts` filtered by role
`Test Bed Tech Team` - **the same store the buyer roles use**, one list, two
readers.

## S. SENSOR COUNTS AND UNITS

**S1.** Three counts are ordinary payload fields; the UNITS behind them are a
separate resource (`GET /test-beds/:id/units`).
**S2. A count and its units can DISAGREE**, and `tbUnitShortfall` is what names
the gap. `renderTbCountCorrection` offers the correction.
**S3.** `POST /units/derive` generates units from the counts.
**S4.** `tbLockedCountRow` renders a count that may no longer be edited.
**S5.** `COUNT_KEY_TO_UNIT_TYPE` and `COUNT_KEY_FOR_UNIT_TYPE` are **two
directions of one mapping**, and Verification 20 says they must be proven
inverse rather than maintained twice.
**S6. EVERY UNIT WRITE IS QUEUED**, per row: `tbUnitWriteQueues` holds a promise
chain and `tbUnitSettleRow` resolves it. **The revision is read INSIDE the
queued link, not when the click happened** - which is what makes two quick edits
to one unit serialise instead of racing.
**S7.** `renderTbUnitPane` is per unit type; `UNIT_TYPE_FOR_TAB_KEY` maps the
tab to the type.

## B. EXIT CRITERIA

**B1.** `GET /records/:id/exit-criteria` per stage.
**B2.** `toggleExitCriterion(field, isMet)` - **an arrow assigned to `window`**,
the declaration form that hid from every keyword-anchored scan.
**B3. A tick is a TIMESTAMP, not a boolean.** `payload_field_required` blocks
only on `undefined`, `null` and `''`, so a stored `false` would read as present
and open the gate.
**B4.** `tbCriterionQueue` and `applyConfirmedCriterionTick` mean a tick is
queued and applied on confirmation, not written on click.

## C. SCORING - the largest, 24 names

**C1.** Criteria are fetched per stage (`ensureTbScoringCriteria`) and cached
(`tbScoringCriteria`).
**C2.** A score is a DRAFT until recorded: `setTbScoreDraft` holds it,
`recordTbScores` writes it through `POST /test-beds/:id/scores`.
**C3. A REASON IS REQUIRED AT SOME LEVELS AND NOT OTHERS**
(`tbScoreReasonRequired`), read from the level's own `reason_required` - **data,
not a hardcoded level list.** Architecture 9's fourth variant is recorded
against exactly this: a message that named "what is missing" stopped being true
when a confirmation scale gained a required reason.
**C4. THE REASON MUST DIFFER FROM THE ONE ALREADY RECORDED**, not merely be
non-empty. Round 30 found the non-empty test passing by construction once the
box was prefilled, so it fired on every save and asked nothing.
**C5.** `tbScoreAwaitingReason` blocks the whole Save and focuses the box -
measured in Phase 0's read of `saveTbFields`.
**C6.** `applyTbScoreEntryLock` locks entry once recorded.
**C7.** Anchors (`showTbScoreAnchors`, `tbAnchorSet`) and history
(`toggleTbScoreHistory`, `tbScoreSeries`) are disclosure, not state.
**C8.** `POST /test-beds/:id/measurability` is a **second write** beside the
score.
**C9.** `renderTbScoreSummary` and `renderTbScores` are two renderers over one
series - a Verification 20 pair to prove, not to duplicate.

## Q. THE STAGE PANEL

**Q1.** Ten stage tabs plus three Reference sub-tabs, measured.
**Q2.** The FIELD ROWS do not vary by tab; the id surface does, 183 to 192 per
tab, union 211.
**Q3.** `markStagePanelFailed` / `markStagePanelSettled` are **shell functions**
this file calls, so the panel's loading state is the shell's contract.

---

## What this enumeration does NOT decide

**Whether the units queue survives the port unchanged.** It is a promise chain
per row, and Architecture 8's new clause is that a guarantee resting on
execution order must be re-proven in the new runtime.

**Whether scoring migrates in this round at all.** 24 names against Contact's
whole surface of 76 is a scale question, and it is the business's rather than
this document's.

---

# Addendum, 2026-09-07: the four load-bearing behaviours, exactly

**Round 7 Phase 1b.** The Phase 0b enumeration named these four in outline. This
is them read line by line before any of it is built, and **one of them turned out
not to exist**.

## Q. THE PER-ROW UNIT WRITE QUEUE

**Q1. One queue PER UNIT ROW**, keyed by unit id, so two rows do not serialise
against each other.

**Q2. Nothing is dropped or coalesced.** Writes chain. *"A user cannot outrun
this guard; they can only lengthen the queue, and the cost of lengthening it is
latency rather than a lost write."*

**Q3. THE REVISION IS READ INSIDE THE QUEUED LINK, not when the event fired.**
Three fields entered at paste speed queue three writes, and each must expect the
revision the one before it produced. **Reading it at event time would give all
three the same number and refuse two** - the failure the queue exists to remove,
arriving from the other direction.

**Q4.** On success the local unit is REPLACED by the response, which is what
makes Q3 true for the next link.

**Q5. FAILURES ARE KEYED BY FIELD and outlive the burst**, cleared only by a
later successful write to that same field.

**Q6. The row settles ONCE PER DRAIN**, and shows the FIRST unresolved failure
rather than the most recent - *"the earliest thing that went wrong is the one to
fix first."*

**Q7. A THROWN LINK MUST NOT BREAK THE CHAIN.** A rejected link would silently
stop every later write for that row.

**Q8.** The cell says `Saving` at enqueue, and `Saved` only when every field's
most recent write succeeded.

### Why Q5 and Q6 are two rules and not one

Measured in the vanilla's own history: settling once per drain fixes the
CONCURRENT case and leaves the SEQUENTIAL one, *"which is the commoner one"* - an
invalid latitude refused in ~40ms, well before the operator finishes typing the
longitude, so the two writes never overlap and a later success replaces the
error while the latitude sits unsaved.

## U. THE USE-CASE WHOLE-LIST READ-MODIFY-WRITE

**U1.** Add appends to `tbPayload.useCases` and writes **the whole array**.
Remove filters by index and writes the whole array.

**U2. THAT IS A READ-MODIFY-WRITE IN THE BROWSER**, and the record PATCH's
revision precondition is the only thing making it safe.

**U3. THE CONCURRENT SHAPE, named: two people adding a use case at the same time
would otherwise LOSE ONE.** Both read `["a"]`, both write `["a", "mine"]`, and
the second overwrites the first. With the precondition the second is **refused**
rather than silently winning.

**U4.** Remove-by-INDEX is the same hazard sharpened: if the list changed
between render and click, index 1 is no longer the row the person clicked. The
precondition catches the record having moved; **it does not make the index
right**, and that is a limit rather than a fix.

**U5.** On success the record is re-read; on refusal nothing local changes.

## B. THE EXIT-CRITERION TICK

**B1. A tick writes an ISO TIMESTAMP; an untick writes `null`.** Never a
boolean.

**B2. WHY, and it is load-bearing:** `payload_field_required` blocks only on
`undefined`, `null` and `''`. **A stored `false` reads as PRESENT and opens the
gate.** Storing a timestamp on tick and deleting the key on untick makes
"present and non-empty" structurally equivalent to "ticked".

**B3.** A failed write leaves the control **untouched** - *"a failed write must
not look like a success."*

**B4.** The stage at click is captured, and the confirmed tick is applied only
if the person is still on that stage.

**B5.** It goes through `tbPatch`, so it carries the precondition like every
other write on this screen.

## R. THE SCORE REASON - AND THE ONE THAT DOES NOT EXIST

**R1.** A reason is required when the LEVEL declares `reason_required`, read
from the level's own data rather than a hardcoded list of levels.

**R2.** A reason is ALSO required on any REVISION - `tbScoreSeries(key).length > 0`
on the client, `existing.length > 0` on the server.

**R3.** Save refuses locally and focuses the box, so the requirement is enforced
at entry rather than asked again at save.

### R4. MUST-DIFFER IS NOT IMPLEMENTED ANYWHERE, and the Phase 0b enumeration was wrong to state it as a behaviour

**Measured**: `src/lib/score-entry.js` refuses an EMPTY reason twice - once for a
`reason_required` level and once for a revision - and **compares the reason to
nothing**. The client checks non-empty only. Neither side has ever compared a
reason to the one already recorded.

**The Phase 0b enumeration said it did**, citing Round 30. Round 30's ruling is
real and is in `CLAUDE.md`, but it was made about the **Opportunity assessment
panel**, and I asserted it of this surface without reading for it. That is a
behaviour enumerated from a RULE rather than from the SOURCE, which is the thing
these documents exist to prevent.

**So building it is an IMPROVEMENT, not a port**, and it is recorded as one.
The rule is worth applying: on a revision the box starts empty, so non-empty is
a real check - but a person can retype the same sentence and a new level is then
recorded carrying the reasoning given for a different one.

### R4, RE-RECORDED 2026-09-07: BUILT IN PHASE 1b, STRIPPED IN PHASE 2, QUEUED

**Ruled by the business at the Phase 2 opening.** Phase 1b built must-differ
anyway, on the reasoning above. Phase 2 took it out before the swap.

**The reasoning for the strip, and it is about WHEN rather than WHETHER.**
Round 7 is a migration. A rule the vanilla does not have is a behaviour change
arriving inside a swap commit, so a walk comparing the two surfaces finds the
React one refusing a save the vanilla accepts - and the person walking it cannot
tell an improvement from a regression. **The strip landed as its own commit
BEFORE the swap** for exactly that reason.

**What survives is the port**: the empty-reason refusal, which is the vanilla's
behaviour at both `score-entry.js` sites, and R1 and R2 above.

**QUEUED, PENDING A BUSINESS RULING, and the argument is unchanged.** A person
can retype the same sentence on a revision, and the new level is then recorded
carrying the reasoning given for a different one. **That is a product decision
about what a scorer is asked, not a migration decision**, and it belongs to
whoever owns the question rather than to the round that happened to notice it.

**It is not lost, and it has a detector.** `scoreReason.ts` carries the full
reasoning at the site rather than a deletion (Verification 29: a superseded
decision stays visible so a reader can tell a failed premise from a changed
preference), and the Phase 1b injection sweep now REINSTATES must-differ as an
injection - so the strip is a change something watches rather than an absence
nothing asserts.

---

# Addendum, 2026-09-07 (fifth entry): THE STAGE-TAB SHELL, enumerated before build

**Round 7 Phase 2b, session 1.** The five LOGIC-ONLY capabilities have no
rendering surface because the thing that would render them does not exist. This
enumerates it.

**Enumerated from the vanilla by instruction** (`app.js`, the tab strip at
`:2419`, `loadTbStageDetailTab` at `:6816`, the panel-state helpers at
`:6787-6812`), which is the exception Phase 2b's instruction names to
Verification 47's contract-only rule: there is no contract document for the
stage tabs, and the Phase 0 enumeration recorded only Q1-Q3.

---

## T. THE TAB STRIP

**T1. TEN TABS, and only eight of them are stages.** Measured from
`data-tb-tab` in `index.html`: `reference`, `commercials`, and eight
`stage-<name>` - Qualification, Pre-Site Assessment, Site Assessment,
Installation and Commissioning, Monitoring and Analysis, Review and Completion,
Decommissioning, Closed.

**T2. THE EIGHT STAGE TABS SHARE ONE PHYSICAL PANEL**, `#tb-tab-stage-detail`.
`reference` and `commercials` have panes of their own. This is why the strip
supplies an `activate` hook rather than the default one-tab-one-pane mapping,
and why every stage switch is a LOAD rather than a reveal.

**T3. THE OPEN TAB AND THE CURRENT STAGE ARE DIFFERENT THINGS.** `.active`
marks whichever tab is open; any of the ten can be opened at any time,
including peeking at a future or past stage. `markTbCurrentStageTab` separately
marks the ONE stage tab matching the record's own `status`, with the same green
dot the chevron strip uses. **A green dot is not a selection.**

**T4. THE USER'S CLICK OUTRANKS THE LOAD'S DEFAULT.** `tbUserPickedTab` exists
because the tab bar is static markup and clickable before the record's own
`switchTbTab('reference')` runs, and a real click in that window was silently
overwritten. Confirmed live in Round 5 Phase 7.

**T5. THE LANDING TAB, in precedence order** and it is four branches, not two:

| condition | tab |
|---|---|
| a transition just landed | `stage-<the stage just entered>` |
| a fresh arrival and the user has not clicked | `reference` |
| a reload with a tab already open | that same tab, RE-LOADED |
| otherwise | `reference` |

The third branch re-runs the load rather than leaving the tab alone: it
preserves the tab AND refreshes it. Leaving the switch out keeps the tab and
shows stale content, which trades one fault for a worse one.

**T6. THE SAVE FEEDBACK CLEARS ON A TAB CHANGE, NOT ON A RE-APPLY.** Every
reload calls `switchTbTab`, including the branch that re-selects the open tab,
so clearing on any activation would erase the message `recordTbScores`
deliberately writes before reloading - the one case where a failure must
survive a reload, because the reload is part of reporting it.

**T7. NEXT STAGE IS GATED ON THE OPEN TAB**, and the tab can change with no
re-render, so the button is refreshed from the activate hook. Disabled unless
the open tab is `stage-<the record's current stage>`; label becomes `Final
stage` with no next stage.

---

## P. THE STAGE PANEL'S LOAD

**P1. A LOAD TOKEN, TAKEN AT THE TOP AND CHECKED AFTER EVERY AWAIT.** Fast tab
switches leave two loads in flight, and without the check the OLDER response
resolves last and writes the wrong stage into the shared panel. Confirmed live
on two panels; a third had no guard at all and was safe only because it ran
last, until the fetches were parallelised (Architecture 8's own recorded
instance).

**P2. THREE FETCHES CONCURRENTLY, EACH RENDERING ON ITS OWN RESPONSE**:
documents, exit criteria, approvals. Measured sequentially at 654 + 310 + 1070
= 2034ms, which was exactly how long the criteria panel took to stop showing
the previous stage's content. **Each panel renders when ITS request lands**, so
the slowest no longer sets the floor.

**P3. THE PENDING/SETTLED CONTRACT, and it is what makes the panel testable.**

| attribute | meaning |
|---|---|
| `dataset.pending` | the stage being loaded, present only in flight |
| `dataset.stage` | the stage whose DATA is displayed, set only when real data rendered |

Marked **synchronously at the click, before any await**, so there is no window
where stale content is presented as current. A failure clears BOTH, so a check
waiting on `dataset.stage` cannot pass against an error message.

**P4. THE TERMINAL STAGE RENDERS THE COMPLETED RECORD, NOT THE PANELS.** Closed
has no exit gate, no documents and no approvals, so the ordinary panels would
be permanently empty. **Decided by the DATA - no next stage in
`stage_definitions` - not by matching the string `Closed`**, so a record type
whose last stage is named otherwise behaves the same.

**P5. THE TERMINAL BRANCH STILL STAMPS THE SCORING CARD'S STAGE.** It returns
before the three fetches, so the card would carry no `dataset.stage` at all.
Stamping it completes the attribute's contract on all eight tabs rather than
seven.

**P6. THE INSTALL SECTION IS A VISIBILITY TOGGLE, NOT A RE-RENDER.** Installer,
Tech Team and Install Notes apply only to Installation and Commissioning. The
fields are rendered once and stay mounted, so switching away and back cannot
lose an in-progress edit.

**P7. UNITS RENDER ONLY FOR THE STAGE THAT OWNS THEM.** Deriving against a
hidden section would create records for a tab nobody opened.

**P8. THE SCORING CARD IS HIDDEN UNTIL ITS OWN CRITERIA ARE DERIVED**, so
Pre-Site Assessment can never show Qualification's five while its fetch is in
flight.

**P9. AN UNEXPECTED THROW MUST NOT LEAVE A PANEL PENDING.** The `catch` writes
a real error into every panel still carrying `dataset.pending`, and **only the
current load may clear it** - a stale failure clearing a newer load's state is
the same race P1 guards.

---

## What this enumeration does NOT decide

**The door's interaction with the tabs.** Q3 records `markStagePanelFailed` /
`markStagePanelSettled` as SHELL functions this file calls, so the panel's
loading state is the shell's contract, and the shell is a later round. **The
React shell for the tabs is built here; the shell's own ownership sweep at
`:6520` is not touched.**

**Which tabs a non-owner may open.** Measured in Phase 0b: the door is about
FIELDS, not navigation. No tab is gated on ownership in the vanilla, and this
enumeration does not add one.

---

# Addendum, 2026-09-07 (sixth entry): THE SIX ABSENT CAPABILITIES, enumerated before build

**Round 7 Phase 2b, session 2.** 362 vanilla lines, the whole of what stands
between the reach gate and an empty `NOT_RENDERED`.

Enumerated from the vanilla by the same instruction the stage-tab shell had.

---

## I. INSTALLER (96 lines)

**I1. THE INSTALLER IS A LINK TO AN ACCOUNT, not a picklist**, so it renders as
the search-and-link shape Account detail's Parent Account row uses.

**I2. TWO STATES, AND THE SEARCH IS ONE OF THEM.** With an installer set and no
search open, the row shows the name read-only plus a **Change installer**
button. Opening the search replaces the row with a text input and a result
list; a Cancel button appears **only if an installer is already set**, because
with none there is nothing to cancel back to.

**I3. CLIENT-INSTALLED IS A DERIVED FACT, NOT A STORED LABEL.**
`installer.client_installed` renders as *Client installs with their own staff*
or *Installed by a contractor*. The vanilla's own comment says this is shown as
a derived fact "because that is exactly what it is".

**I4. THE SEARCH IS OVER THE ALREADY-FETCHED ACCOUNTS, capped at eight.**
Case-insensitive substring, no new endpoint. An empty term lists the first
eight rather than nothing.

**I5. THE TEST BED'S OWN ACCOUNT IS MARKED IN THE RESULTS**, `(this Test Bed's
own Account)`, because a Test Bed installed by its own client is the ordinary
case and picking it should not feel like an error.

**I6. SETTING THE INSTALLER CAN CLEAR THE TECH TEAM, AND THE USER MUST SEE IT
HAPPEN.** The server reports `cleared_tech_team`. Changing the installer
invalidates a tech team from the previous Account, and **saying nothing would
leave a gate that was satisfied a moment ago silently blocking again**, with the
row empty and no reason on screen. The message is an ERROR-styled one, not a
success one, because the user has work to do.

**I7. `accountsCache` IS A MODULE-SCOPE `let` IN THE VANILLA and unreachable
from a bundle** (measured in the Round 2 shell inventory). The React surface
fetches its own accounts, the same ruling `terminusStaffCache` already forced.

---

## E. TECH TEAM (72 lines)

**E1. A SINGLE CONTACT FROM THE INSTALLER'S ACCOUNT**, which is a DIFFERENT
Account from the record's own. The buyer-row component cannot be reused: it
reads the record's `account_id`, and the endpoint behind it answers 422 for any
Contact outside it.

**E2. NO INSTALLER MEANS NO CONTROL AT ALL, and the reason is on screen.** The
vanilla renders a sentence - *Set the Installer first. The Tech Team is a person
from the Installer's Account.* - and **no select**. Its own comment: the server
already refuses this order with a 422, and an empty select "would look available
and produce that refusal only after the user had tried". **The fourth instance
of this project's standing argument that a control which cannot be used is
replaced, not disabled.**

**E3. AN INSTALLER WITH NO CONTACTS STILL RENDERS THE SELECT**, with its
placeholder saying so by name: *No Contacts at &lt;Installer&gt; yet*. Distinct
from E2 - there is a control, it simply has nothing in it.

**E4. THE SOURCE IS NAMED UNDER THE CONTROL**, *From &lt;Installer&gt;*, because
the Account these people come from is not the one the rest of the card is about.

**E5. AN EMPTY SELECTION IS A NO-OP, NOT A CLEAR.** `if (!contactId) return`.
Choosing the placeholder does not unlink the tech team.

---

## V. VALIDATION (69 lines) - AND IT IS HALF BUILT

**V1. THE KEYSTROKE GUARD EXISTS IN REACT ALREADY**: `acceptsValue`, keyed on
the field's declared `inputMode` rather than on a list of field names, because
a per-field guard is a to-do list to be completed again on every new field.

**V2. WHAT IS MISSING IS THE REFUSAL AND ITS MESSAGE.** `tbValidateNumeric`
answers three problems, and each has words:

| condition | message |
|---|---|
| not a number | `must be a number` |
| negative | `cannot be negative` |
| non-integer where the field is integer | `must be a whole number` |

**An empty field is NOT a problem**: not-set is a legitimate state. Architecture
11 exactly.

**V3. THE REACT KEYSTROKE PATTERN ADMITS A LEADING MINUS** (`^-?\d*$`), so a
negative CAN be typed today and nothing refuses it. The guard and the refusal
are not the same control and the guard alone is the silent-refusal shape.

**V4. THE MESSAGE IS `<label> <problem>`, JOINED WITH `. ` ACROSS FIELDS**, and
it is one line for all invalid fields rather than one per row.

**V5. OWNERSHIP IS MARKED, NOT INFERRED FROM THE CLASS.** The vanilla writes
`dataset.owner = 'validation'` and clears the banner only when it owns it.
Confirmed live before the vanilla was changed: a server save error carries the
same `msg-error` class, so identifying "its own" by class meant **one valid
keystroke in another field erased the server's reason**.

**V6. THE INVALID FIELD IS MARKED TOO**, `input-invalid` and
`aria-invalid="true"`, and unmarked when the problem clears.

**V7. VALIDITY GATES THE SAVE BAR.** The vanilla updates the bar from the guard
rather than relying on the field-input handler, because that handler returns
early when the field was never opened through the opener.

---

## D. CUSTOMER DOCUMENTS (59 lines)

**D1. A SEPARATE RESOURCE, NOT A PAYLOAD KEY.** `GET/POST/DELETE
/api/test-beds/:id/customer-documents`.

**D2. CLIENT-SUPPLIED, DISTINGUISHED BY `document_kind`**, not by having a name
no gate rule mentions.

**D3. RENDERED AND REMOVED BY ROW ID, NEVER BY NAME.** Two client files genuinely
called *Site drawings* are two documents, so nothing keys by variant.

**D4. BOTH A NAME AND A LINK ARE REQUIRED**, refused client-side with *A name and
a link are both required.* before any request.

**D5. THE INPUTS CLEAR ONLY ON SUCCESS**, so a refused add does not cost the
typing.

**D6. THE LINK OPENS IN A NEW TAB**, `target="_blank" rel="noopener
noreferrer"`.

**D7. THE EMPTY STATE SAYS `No client documents yet.`**

---

## N. INSTALL SECTION (34 lines)

**N1. IT IS A COMPOSITION, AND `TB_INSTALL_FIELDS` IS EMPTY.** Measured:
`renderTbInstallSection` maps an empty array and then calls the installer row,
the tech team row and the install notes. **The section has no fields of its
own.** Recorded because the name suggests otherwise and a reader would expect
rows.

**N2. INSTALL NOTES ARE A PAYLOAD LIST, NEWEST FIRST**, written whole through
the record PATCH - the same read-modify-write shape as use cases, with the same
revision precondition doing the work.

**N3. A BLANK NOTE IS NOT WRITTEN.**

**N4. EACH NOTE CARRIES WHEN, WHO AND A STAGE CHIP.**

---

## H. REVISION HISTORY (32 lines)

**H1. `GET /api/records/:id/history`, RAW AUDIT ENTRIES.**

**H2. NEWEST FIRST, AND THE ORDER IS THE SERVER'S**:
`.order('timestamp', { ascending: false })`. The client does not re-sort, so a
test that proves ordering must **carry entries the server would have ordered**
and assert the client preserves them rather than imposing an order of its own.

**H3. THE PROVISIONAL NOTICE IS PART OF THE CAPABILITY, NOT DECORATION.** *Raw
audit entries, unedited. What each action should say, how entries should be
grouped, and which of them belong here at all are not decided yet.* It renders
**above the empty state as well as above the table**, so a record with no
history still says what this panel is.

**H4. THE COUNT IS STATED AND IT IS SINGULAR-AWARE**, `1 entry` / `2 entries`.

**H5. FOUR COLUMNS: when, action, actor, detail.** The timestamp is truncated to
minutes with the `T` replaced by a space; the actor is the first eight
characters of the id; the detail is JSON, and **an empty detail object renders as
nothing rather than as `{}`**.

**H6. A FAILED LOAD SAYS SO** - *Unable to load history.* - and does not render
the notice, because there is nothing to caveat.

---

# Addendum, 2026-09-07 (seventh entry): WHAT BLOCKS THE WALK, enumerated before build

**Round 7 Phase 2d, session 1.** The four `app.js` names the stage panel starves
on, enumerated from the vanilla: the documents panel's content, the approvals
panel's content, the terminal panel's content, and the Next Stage action.

---

## M. THE DOCUMENTS PANEL (`renderTestBedDocuments`, 92 lines)

**M1. ONE PANEL BUILT FROM BOTH ENDPOINT KEYS**, which is what merging the two
panels meant. `reference_docs` is the stage's configured CATALOGUE and the
authoritative answer to *what documents belong to this stage*.
`completable_documents` is the per-document STATE - status, stored URL, and
whether a gate rule makes it confirmable - derived from `stage_gate_rules`.

**M2. UNIONED BY NAME, NEVER INTERSECTED, AND THE REASON IS THE RULE.** The two
tables hold document names as independent free strings with nothing aligning
them. **Intersecting would make a mismatch INVISIBLE** - the document would
silently vanish from the panel. A union shows it, and **a document listed with
no Confirm control is a legible symptom of exactly that misalignment**.

**M3. THREE STATUSES, from `current_status`**: `approved` reads *Approved*, any
other truthy value reads *Started*, absent reads *Not started*.

**M4. A DOCUMENT WITH NO GATE RULE IS CATALOGUE-ONLY.** Listed because the stage
owns it, but nothing about it releases a transition, so it gets **no Confirm
control** and says *Not gated*.

**M5. AN APPROVED DOCUMENT GETS NO CONFIRM EITHER**, because there is nothing
left to confirm. Distinct from M4: one has no gate, the other has passed it.

**M6. THE ROW KEY IS A SLUG OF THE NAME**, spaces to hyphens and every other
non-alphanumeric dropped. It keys the row, the URL box and the feedback line.

**M7. A URL BOX PER ROW**, prefilled from `document_location`, saved on change.

**M8. THE THREE OUTCOMES ARE DISTINCT.** A failed load says *Could not load
documents.* and marks the panel FAILED, so no `data-stage` is set. An empty
configured list says *No documents configured for this stage.* and marks it
SETTLED, because that IS this stage's answer. Rows mark it settled too.

---

## A. THE APPROVALS PANEL (`renderTbStageApprovals`, 45) AND THE SHARED TRACK LIST

**A1. ONE GET of `stage-approvals`, and the panel finds THIS stage's entry** in
the returned list. `buildStageTracks` on the server derives the list from the
stage's own `approval_obtained` rules, so the panel is already scoped correctly.

**A2. AN UNKNOWN STAGE SAYS SO** rather than rendering an empty row.

**A3. NO TRACKS SAYS *No approvals required for this stage.*** Distinct from A2:
the stage is known and genuinely requires nothing.

**A4. `recordType` IS REQUIRED AND THROWS WITHOUT IT.** It decides whether the
pre-workflow approve control may be clicked, and **a default would hide a missed
call site** - the vanilla throws by hand for exactly this reason.

**A5. CLICKABLE ONLY WHEN ALL FOUR HOLD**: the record type does not use the
workflow, the stage is `current`, the track is not approved, and its scope is
not `version`.

**A6. A VERSION-SCOPED TRACK IS NEVER CLICKABLE, AND SAYS WHICH VERSION.** Its
sign-off is collected against an issued major version, not by clicking a stage
row, and offering the control would send somebody to a route that cannot record
what they meant. **"Approved" without naming what was approved is the claim this
model exists to make precise.**

**A7. `t.scope` COMES FROM THE RULE THE GATE READS.** Inferring it from the stage
name would state the model in a second place - Verification 43.

**A8. THE META LINE HAS FOUR SHAPES**: version-scoped approved names the version
and the stage; version-scoped unapproved carries the rule's own reason;
ordinary approved gives the date; ordinary unapproved says *Click to approve*,
*Decided on the transition request*, or *Not yet at this stage* by state.

**A9. BUILT AS A SHARED COMPONENT.** `buildStageTrackListHtml` serves the
Opportunity too. The React component is consumed by the Test Bed host in this
session; **the Opportunity's consumption is a follow-on re-point, recorded, not
duplicated** (Verification 20: a second implementation agrees today).

---

## Z. THE CLOSED PANEL (`renderTbClosedPanel`, 47)

**Z1. ITS OWN ROUTE**, `GET /api/test-beds/:id/lifecycle-documents`, not the
per-stage one.

**Z2. READ-ONLY IS STRUCTURAL, NOT COSMETIC.** No Confirm control and no
editable URL **because the endpoint returns nothing either could act on** - no
gate rule, no required_status. A closed Test Bed's documents ARE the record, and
altering them after closure undermines the audit trail. The backward transition
path is how something changes, and it records the move as a regression.

**Z3. GROUPED BY STAGE IN LIFECYCLE ORDER**, because a flat list of nine
documents loses the shape of what happened. **A stage that produced no documents
is OMITTED rather than shown empty.**

**Z4. IT DEGRADES HONESTLY.** A Test Bed can reach Closed with documents missing
via the backward transition path, so the count is **stated rather than implied**:
*All N documents produced* when they match, otherwise *N of M produced. K were
never recorded.*

**Z5. A DOCUMENT NEVER PRODUCED SAYS SO** rather than rendering a blank row that
reads like a missing URL. A produced document with no URL says that instead.

**Z6. ITS OWN PENDING CONTRACT.** `dataset.pending` while loading and
`dataset.record` once shown, cleared on failure - the same discipline as the
stage panels, on a different attribute because it is a different question.

---

## X. THE NEXT STAGE ACTION (`wireTbNextStageButton` + `tbNextStageState`, 23)

**X1. THE NEXT STAGE IS THE ONE AFTER THE RECORD'S STATUS IN SORT ORDER**, read
from the stage list. Absent at the end, which is what T7's *Final stage* label
reads.

**X2. THE FEEDBACK AREA IS CLEARED WHEN THE STATE IS WIRED**, not when the
button is clicked.

**X3. THE CLICK CARRIES THE RECORD KIND AS ITS FOURTH ARGUMENT.** It read as an
element id and never was one: the transition only ever compared it, and no
element of that id exists. Recorded because the shape invites the old reading.

**X4. T7 ALREADY DECIDES ENABLEMENT** and is built and injection-covered. This
is the ACTION only, which is why the gap is 23 lines rather than 84.

---

# Addendum, 2026-09-07 (eighth entry): THE VIEW'S LOAD AND RENDER, enumerated before build

**Round 7 Phase 2d, session 2.** `loadTestBedDetail`, `renderTestBedDetail` and
the three landing flags, enumerated from the vanilla.

---

## L. THE VIEW LOAD (`loadTestBedDetail`, 95 lines)

**L1. THE FRESH-NAVIGATION FLAG IS CONSUMED AT THE TOP, BEFORE THE GET CAN
FAIL.** The vanilla's own comment says why, and it is not tidiness:
`loadTestBedDetail` returns early when the GET fails, so **a flag cleared only
by the renderer would survive a failed load and make the NEXT call - a save -
read as an arrival and jump to Reference**. That is the original fault
reintroduced through its own fix, reachable whenever a save follows a load that
404ed.

**L2. EXACTLY ONE PLACE SETS IT, AND THE DEFAULT WAS INVERTED TO GET THERE.**
Twelve of the thirteen call sites are in-app saves; only `navigate()` is an
arrival. The fix was not to pass *do not reset* at twelve call sites - **that
leaves the thirteenth, added in a future round, inheriting the fault**, which is
this project's standing rule at four confirmed instances. Preserving the tab is
what happens unless something explicitly says this is a navigation.

**L3. ARRIVING AT THE VIEW CLEARS THE SAVE FEEDBACK.** It is the other way the
thing the message was about goes away. Because `navigate()` is the only setter,
**no save path can reach this branch and wipe its own report** - which is the
pair to T6, where a tab re-apply must not clear it either.

**L4. A FAILED GET STILL SETTLES THE VIEW.** `detailLoaded` is called on the
failure path too, or a record that could not be fetched **shows the loading line
for ever instead of its error**. The name reads *Not found*.

**L5. THE DOOR: `notMine` NEEDS ALL THREE.** An owner id on the record, a signed
-in user id, and the two differing. Absent either id it is NOT not-mine, which
fails OPEN deliberately at load time and closed at the edit attempt.

**L6. THE BANNER IS THE ONLY PER-VIEW PART.** The class, the value and the
stylesheet rule are shared with the Opportunity; the banners differ only because
they sit in different documents. **The behaviour is shared by construction
rather than by matching.**

**L7. NOT A SECURITY BOUNDARY, AND SAYING SO IS PART OF THE RULE.** RLS is the
boundary. This stops a person doing work that will be refused; it does not stop
anybody who means to.

**L8. UNIT COUNTS ARE LOADED ONCE PER DETAIL LOAD, AS A READ.** Both tabs use
them. The derive control is the only thing that writes.

---

## R. THE VIEW RENDER (`renderTestBedDetail`, 99 lines)

**R1. THE HEADER IS NAME AND CLIENT ORGANISATION.** The four stat-strip writes
that used to sit here are gone with the strip: every value already had a home
and was duplicated there.

**R2. THE STAGE LIST IS FETCHED AND STORED**, because the terminal check reads
it. Round 10 Phase 7 recorded what happens when it is not: opening a stage tab
on a direct navigation, inside the window before it is assigned, left the list
empty and rendered the ordinary panels on the Closed tab.

**R3. THE CHEVRON STRIP AND ITS HOVER POPUP** are the shared components, keyed
to the record.

**R4. THE CURRENT-STAGE DOT IS SET ONCE PER RENDER**, not per tab switch: the
record's real stage does not change from clicking through tabs.

**R5. THE LANDING STAGE IS READ AND CLEARED HERE**, so a later unrelated load
cannot inherit it.

**R6. EVERY TRANSITION LANDS ON THE STAGE JUST ENTERED, INCLUDING THE LAST.**
Round 10 Phase 6 excepted the final transition because Closed rendered nothing
and arriving on a blank tab was a poor reward for completing the lifecycle.
Round 10 Phase 7 gave Closed a real panel and **removed the exception**, which
it had only ever been deferring.

**R7. THE OPEN TAB IS READ BEFORE ANY SWITCH**, since switching rewrites the
active class - the input to T5's reload branch.

---

## What this session does NOT build

**The chevron strip.** R3's two functions are SHARED with the Opportunity and
are dispositioned as such in the enumeration, so they are not gaps and not this
round's to move.

**`detailLoaded` itself.** It is a shell service the React tree already has.
