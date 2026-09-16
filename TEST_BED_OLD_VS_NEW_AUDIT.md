# Test Bed OLD vs NEW: the full capability audit (Phase 0)

Read-only. Nothing here is fixed; this scopes the work and waits for John's
ruling on what to correct and in what order.

## Sources and instrument

- OLD: the pre-migration vanilla Test Bed at `54001c5^` (`b748a8e`), the
  commit before "Round 8 Phase 2: the two vanilla surface files retired".
  `frontend/test-bed-detail.js` (3,281 lines, matching the prior recovery
  report's own count) and the `#view-test-bed-detail` block of
  `frontend/index.html` (702 lines). Both read in full, plus the shell
  functions the old screen leaned on in `app.js` at that commit where a
  capability crossed the seam (attemptTransition, chevron, sub-tabs).
- NEW: the current React Test Bed at `27427da` (origin/main), the whole of
  `frontend-react/src/testbed/` plus the field-row layer, the shell seam
  (`shell-services.ts`), and the server routes each side calls.
- METHOD: capability by capability, never by element name. The prior raw ID
  diff claimed 39 absences and most were renamed containers; that overcount
  is the trap this audit avoids. Each old capability is classified PRESENT,
  LOST or CHANGED, and a LOST item that renders but cannot work is
  additionally marked BROKEN LIVE, because "on screen and non-functional" is
  worse than absent: it looks done.
- EVIDENCE STANDARD: every claim carries the file and line it was read at.
  Nothing in this audit was executed against a live server (this checkout
  has no session and no dev server), so every BROKEN LIVE claim names the
  two sides of the contract that disagree, read at both ends, and where a
  test exists that should have caught it, the audit says why it did not.

## What this audit CANNOT see (stated, not implied complete)

1. Runtime behaviour. All claims are from reading both sides of each seam.
   A live walk remains the confirming instrument for every BROKEN LIVE item.
2. CSS-only presentation loss (spacing, weight, colour) beyond structure.
   The layout rounds and walk-2 covered the header; the tab interiors were
   not pixel-compared here.
3. Anything the OLD screen did through app.js at `54001c5^` that this audit
   did not follow across the seam. The named crossings (transition feedback,
   chevron, inline buyer modal, sub-tabs, back button) were followed; an
   unnamed one could hide.
4. Whether server routes the old screen used still behave as they did then.
   Routes were read at HEAD only.

---

## THE HEADLINE

The React Test Bed's record-keeping surface (Reference, Commercials, cost
calculations, header, documents, installer, use cases, customer documents,
history, convert, closed tab) is in good shape: the recovery rounds restored
the big losses and they verify PRESENT below.

The WORKFLOW core of the screen is not migrated; it is broken while looking
built. Six capabilities render but cannot work, and four of them stack on
the same journey: a user at Qualification cannot see the exit requirements
(the panel reads empty on every stage), cannot record the scores the gate
demands (every POST is refused by a body-shape mismatch, and the scoring
panel has no criteria to offer anyway), cannot link the buyer roles three
gate rules name (the dropdowns save nowhere), and when Next Stage refuses,
the refusal renders nowhere (the feedback element lost its id). The units
path is equally stacked: every unit save calls a route that does not exist,
and opening the Installation tab silently CREATES unit records, reversing a
recorded design ruling. None of this is visible to the suites, because in
each case the test fixture is shaped to what the reader wants rather than
what the server sends, which is the estate's own Verification 47 pattern.

---

## SECTION 1: BROKEN LIVE (renders, cannot work; all are LOST capabilities)

### B1. Recording a score fails on every attempt (contract mismatch)
- NEW sends `POST /api/test-beds/:id/scores` with `{ entries: [{
  criterion_key, score, reason }] }` (`TestBedHost.tsx:533-539`).
- The server reads `{ criterion, score, comment, reason }` flat from the
  body (`src/lib/score-entry.js:62`), looks up `criterion ?? ''` and answers
  400 "criterion is not a recognised scoring criterion"
  (`score-entry.js:73-79`).
- OLD posted one entry at a time as `{ criterion, score, reason }`
  (`test-bed-detail.js:1973-1996`).
- Why no test caught it: the score tests exercise the client helpers and the
  route separately; nothing drives the client body into the route.

### B2. The stage scoring panel is permanently empty
- `ScoringCard` takes its criteria from `deps.scoringCriteria(stage)` which
  reads the host's `scoring` state; `setScoring` has zero callers, so it is
  `{}` for ever. The host's own comment records this as a finding and
  defers it (`TestBedHost.tsx:230-234`, `530`).
- `seriesByKey` is populated only from a score POST response
  (`TestBedHost.tsx:544`), which B1 means never succeeds, so history counts
  read 0 even on a scored record.
- OLD derived visibility from the criteria's own stage rows plus the
  exit-criteria response, and read series from the record payload
  (`test-bed-detail.js:2095-2137, 1929-1932`).
- Net: no criterion is scoreable from the React screen at any stage.

### B3. The exit criteria panel reads "No exit criteria" on every stage
- The stage loader stores the criteria fetch's `r.data` unmapped
  (`stageLoad.ts:92`), and `StageTabs` casts it straight to rows
  (`StageTabs.tsx:117-119`).
- The live route answers an OBJECT: `{ from_stage, to_stage, blocking,
  requirements }` (`src/routes/records.js:562`). An object cast to an array
  has `length === undefined`, so `ExitCriteria` takes its empty branch
  (`StagePanel.tsx:38, 50`) on every stage, live.
- Why no test caught it: the stage-surface suite's `criteria` dep returns a
  hand-shaped ARRAY, `[{ field, label, value }]`
  (`__tests__/testbed-stage-surface.test.tsx:22, 27`). The fixture is shaped
  to the reader, not the server: Verification 47 exactly.
- Latent second fault, for whoever fixes this: `ExitCriteria` renders EVERY
  row as a clickable checkbox writing a timestamp into `row.field`
  (`StagePanel.tsx:44-46`). The OLD panel ticked only the
  `TB_EXIT_CRITERION_KEYS` members that carry a label, and rendered
  document, approval, contact-role and score requirements as computed
  read-only rows, precisely so a click could never write a timestamp into an
  unrelated payload field (`test-bed-detail.js:1489-1567, 1599-1610`). A
  naive shape fix that maps `requirements` into this component would ship
  that unsafe surface.

### B4. Every unit save fails, three contract breaks deep
- NEW patches `/api/units/:unitId` (`TestBedHost.tsx:553-555`). No such
  route exists; the server's is `/test-beds/:id/units/:unitId`
  (`src/routes/test-beds.js:1841`). Every save 404s.
- Even route-corrected, NEW wraps the field as `{ payload: { [field]:
  value } }` while the server reads flat keys (`test-beds.js:1879-1881`),
  so nothing would be written.
- Even unwrapped, NEW's field name is `serial` (`UnitsPane.tsx:60-61`)
  where the server accepts `serialNumber`.
- OLD called the real route flat with the revision precondition
  (`test-bed-detail.js:3054-3057`).

### B5. A blocked transition shows nothing
- The shell's `attemptTransition` writes blocking feedback into
  `document.getElementById('tb-next-stage-feedback')` and returns silently
  when it is null (`frontend/app.js:5195-5224`;
  `shell-services.ts:331-340` passes that id).
- NEW renders the element with `data-testid` only and NO id
  (`StageTabs.tsx:225`), so the lookup is null and every refusal, including
  the itemised blocking list, is swallowed. Clicking Next Stage on a
  blocked record does nothing visible.
- OLD carried `id="tb-next-stage-feedback"` (old index.html:211).

### B6. Buyer role linking has no write path
- The three buyer dropdowns render as lookups into the batched draft store
  (`TestBedPanel.tsx:208-213`), but `buildPayload` deliberately skips every
  `buyer-` key (`TestBedHost.tsx:97`), no POST to
  `/test-beds/:id/buyer-contacts` exists anywhere in `frontend-react/`
  (grep: zero hits), and no other handler consumes the draft. Selecting a
  buyer produces a dirty row whose Save sends nothing and reports nothing.
- The descriptor census itself says these were meant to be "direct-write
  controls rather than batched rows" (`descriptors.ts:13`); the direct
  write was never built.
- OLD saved on select via POST `/buyer-contacts` with per-role feedback
  (`test-bed-detail.js:1413-1424`).
- Weight: three live `contact_role_linked` gate rules on the Qualification
  exit name these roles (old `test-bed-detail.js:299-301`), so this is
  gate-blocking, not cosmetic.

---

## SECTION 2: REGRESSION OF A RECORDED RULING

### R1. Opening the Installation tab silently derives units
- The stage loader calls `onDeriveUnits` whenever the Installation tab
  opens (`stageLoad.ts:74-76` "P7"), and the host's `onDeriveUnits` POSTs
  `/units/derive` (`TestBedHost.tsx:548-551`).
- OLD removed exactly this in Round 17 Phase 3 and recorded why: "this used
  to POST derive here, so opening this tab created records... A write must
  not be the consequence of a read" (`test-bed-detail.js:3099-3104`).
  Creation was moved behind an explicit button so the count lock is
  "attributable to a person and a moment rather than to a page view"
  (`3113-3115`).
- Consequence today: viewing the tab creates unit records, which trips the
  server's count lock (see L3), on a record the viewer may only have been
  reading.

---

## SECTION 3: LOST (old did it, new does not; renders nothing misleading)

Ordered by what matters. Items marked GATE feed a stage gate.

- L1 GATE. Measurability confirmation. The route constant exists with zero
  callers (`scoring.ts:72`; grep: no caller). OLD rendered the yes/no row
  on Qualification and saved immediately (`test-bed-detail.js:1836-1846,
  2148-2165`). The Qualification gate requires `measurabilityConfirmed`;
  there is no way to record it.
- L2. Count correction (the way out of the lock). OLD: new count plus a
  mandatory reason, applied via the record PATCH with
  `countCorrectionReason`, control living with the units and acting on the
  open type tab (`test-bed-detail.js:3239-3281`). NEW: absent (grep zero).
  The server still refuses a count change once units exist without a
  reason (`src/routes/test-beds.js:723-736`), so counts are now
  permanently uncorrectable from the UI, and R1 above is what locks them.
- L3. Locked-count presentation. OLD replaced each locked count field with
  a read-only row naming the value, the reason and where to correct it
  (`test-bed-detail.js:1025-1043`). NEW leaves the count fields fully
  editable on Commercials and renders a single summary line inside the
  install section only (`UnitsPane.tsx:91-105`; `CommercialsCards.tsx`
  renders plain rows). A user edits a locked count and is refused at save
  with no visible lock and, per L2, no route to the correction.
- L4. Unit fields. OLD table per type: index, serial, latitude, longitude,
  state select (Planned/Installed/Faulty/Removed), per-row status cell
  (`test-bed-detail.js:2924-2951`). NEW renders one serial input and a
  status span (`UnitsPane.tsx:57-63`). Latitude, longitude and state have
  no control at all (server still validates all three:
  `test-beds.js:1851-1862`).
- L5. Scoring surface depth (all within the panel B2 empties):
  current-value display ("Not scored" / value), the criterion question
  line (`asks`), the anchors block (Show/Hide definitions, per-level
  wording, no-wording marking, version line, auto-open on a pending
  draft), full history rows resolving each entry against its OWN anchor
  version, the awaiting-reason entry lock across the OTHER selects with
  the named lock note and the focus-into-reason behaviour
  (`test-bed-detail.js:1759-1793, 2169-2343`). NEW has name, bare select,
  conditional reason box, latest-reason-only disclosure
  (`StagePanel.tsx:85-116`).
- L6. Exit-criteria depth (within B3): the "N of M outstanding to move to
  X" summary counted over ALL requirements, the met state read from the
  server's own `met`, the process-vs-data-entry visibility split, pending
  marks (dot, dashed, "unsaved") when a draft would satisfy a row, the
  serialized per-record tick queue, confirmed-tick-before-recompute, the
  final-stage and no-criteria messages naming `to_stage`, the tick
  feedback element (`test-bed-detail.js:1454-1588, 1673-1696,
  2352-2410`).
- L7. Notes stage stamp. OLD stamped every new note and install note with
  the stage it was written at and rendered the chip
  (`test-bed-detail.js:553-561`). NEW: the shared `note()` has no stage
  (`contact/notes.ts:18`), `NotesHistory` renders no chip (grep zero), and
  the install-note add call omits the stage argument its own helper
  accepts (`InstallSection.tsx:139` vs `installNotes.ts:16`). Existing
  install-note chips still display (`InstallSection.tsx:130`); main-note
  chips do not.
- L8. The install-date ceiling. `dateBounds` computes `max` (install date
  never after a set go-live) but `FieldDescriptor` declares no `max` and
  the date editor renders `min` only (`dateBounds.ts:28-33`;
  `field-row/types.ts:85`; `editors.tsx:170-186`, zero `max=` in the
  file). The go-live floor IS wired. Server still refuses both directions.
- L9. Read-only identity rows: Terminus Reference, Industry, Stage row,
  Account (the linked account's name), Date Created, Age. All six render
  nowhere in the React tree (grep across testbed and shared: zero). OLD
  rendered them on Reference (`test-bed-detail.js:433-495`), and Round 7
  Phase 5 explicitly relocated Age so it was "not dropped". The header
  shows name, client_organisation and the stat strip; none of the six.
- L10. Chevron hover popup. `wireChevronHover` is called for the
  Opportunity only (`app.js:7580`); the React header renders the strip
  with no wrap and no popup element (`ViewHeader.tsx:137`), so the
  per-stage hover detail with its blocking list is gone on Test Bed.
- L11. Back to test beds. The static button is destroyed when createRoot
  clears `#view-test-bed-detail` (`main.tsx:228-229`), its app.js listener
  with it (`app.js:424`), and no React back control exists (grep zero).
  Navigation back is browser or sidebar only.
- L12. The R&D tag in the header (old index.html:694). Cosmetic.

## SECTION 4: CHANGED (both do it, differently; for ruling, not necessarily fixing)

- C1. Scores save path. OLD intercepted the page Save bar: scores recorded
  first in panel order with stated partial-failure semantics, other dirty
  fields held and saved after, refusal messages naming what was and was
  not recorded (`test-bed-detail.js:1939-2028, 2656-2711`). NEW is a
  per-stage "Record scores" button separate from the edit bar, batch body
  (B1), no partial-failure statement. A design decision is needed before
  the fix: restore the interception or keep the button and fix the
  contract.
- C2. Numeric entry guard. OLD validated on input, marked the field
  invalid, showed the joined message and disabled Save, after explicitly
  withdrawing keystroke blocking because it silently rewrote values
  ("2.5" became "25") (`test-bed-detail.js:2416-2447`). NEW filters
  candidate values via `acceptsValue` (rejecting the keystroke or paste)
  and client-validates only the three counts (`NUMERIC_FIELDS`,
  `TestBedHost.tsx:58-62`); duration integer and cost-rate negative checks
  are server-only now. The rejected-keystroke style is the shape the old
  code withdrew, though the controlled input avoids the silent-rewrite
  half. Ruling wanted on whether the vanilla's mark-invalid model returns.
- C3. Save bar. OLD: Cancel and Save in the tab row, dirty-gated, Save
  disabled while invalid, stays visible while invalid. NEW: EditBar below
  the tabs with a change count, "Discard all", hidden at zero dirty; the
  invalid path refuses inside onSave with the owned message rather than
  disabling (`EditBar.tsx`; `TestBedHost.tsx:467-470`). Functionally
  covered; presentation differs.
- C4. Site Details placement. OLD folded the four site fields into
  Customer Details (Round 16 Phase 3); NEW gives them their own card
  again (`TestBedPanel.tsx:216-222`).
- C5. Notes. Moved to the header band (per the ruled design), expansion is
  the Contact model (2, 10, All) rather than 2-or-all, ordering trusts
  the prepend array rather than sorting by timestamp (the OLD sorted after
  a real mis-ordering defect; `NotesHistory.tsx:205` vs
  `test-bed-detail.js:573`). Low risk while the one writer prepends.
- C6. Tech team, linked state. OLD showed a read-only display once linked;
  NEW keeps the select with the linked value (`InstallSection.tsx:105`).
- C7. History pane. NEW is richer than OLD (prose field-change rendering
  through the screen's own labels, singular-aware count, notice preserved)
  and loads eagerly rather than lazily. Improvement, recorded.
- C8. Stage documents. NEW adds the approve:false URL save beside Confirm
  (`TestBedHost.tsx:704-713`). Improvement, recorded.
- C9. Unit-count card title "Sensor Counts" vs OLD "Unit Counts".
- C10. Exit tick concurrency. OLD serialized ticks through a per-record
  queue; NEW fires `patchPayload` per tick with the last-loaded revision,
  so two rapid ticks make the second 409 and reload. At this product's
  scale (single user on a record is the norm) this is tolerable; recorded
  so the 409 is not read as mystery.

## SECTION 5: PRESENT (verified in the current tree; not re-litigated)

Cost engine and itemized breakdown (four cards, total-first, draft-quoting
labels, unsaved marker, 400ms debounce, failure fallback; verified against
COST_CALCULATIONS.md and enforced by contract tests), the three rate cards
with units in their titles, Sensor Counts card, the header (title, client,
summary beside title, stat strip with the overdue read, chevron strip via
the shell, readonly banner and the proven door), convert (trigger beside
the title, name validation, view-it, per-record reset), the Reference
cards (Terminus, Customer, Site, Key Dates), the Qualification score card
(payload-read, sorted by `at`, stage named), the sub-tab strip (use cases,
customer documents, history), use cases add/remove, customer documents
add/remove with both-required validation and feedback, installer
search-and-set (cap 8, own-account annotation, cleared-tech-team warning),
tech team gating and placeholders, install notes (add, chip display,
newest-first), lifecycle documents on Closed, stage approvals via the
shared track list, ten tabs with the shared stage panel, tab races and
landing rules, Next Stage gating on the open tab, draft survival across
tab switches and reloads with per-record reset, the revision precondition
on every surviving writer, the 409 stale message with the shell's reload
control, and estCostPerUnit / indicativeCost correctly rendered nowhere.

---

## RECOMMENDED SCOPE SPLIT (for John's ruling; nothing started)

1. FIX ROUND A, the workflow core: B1+B2+L1+L5 (scoring, one design
   ruling from C1 first), B3+L6 (exit criteria, with the tickable-safety
   guard restored), B6 (buyer writes plus the inline "+ New" question),
   B5 (the feedback id, a one-line fix that still gets a live proof
   because it is the door to seeing every other refusal).
2. FIX ROUND B, units: B4, R1, L2, L3, L4 as one piece, since they are one
   mechanism (counts, slots, lock, correction).
3. SMALL ITEMS ride whichever round touches their file: L7, L8, L9, L10,
   L11, L12, C9.
4. Every BROKEN LIVE fix lands with a test that drives the real
   client body into the real route or the real response into the real
   component, because in all six cases the existing green was a fixture
   shaped to the reader (Verification 47), and proof on the real screen
   per CLAUDE.md V4.
