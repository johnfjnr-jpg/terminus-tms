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
