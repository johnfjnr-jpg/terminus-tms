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
