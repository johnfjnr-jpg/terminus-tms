ROUND: ASSESSMENT PANE FIXES
Base: main at 1b1c221 (confirm by ls-remote; differs: STOP).
Branch: assess-pane-fixes. First commit: this brief verbatim as
ASSESSMENT_PANE_FIXES_BRIEF.md. ls-remote base check at branch and merge.
Rule 18. NordVPN OFF and PUPPETEER_PATH set for the gate. Each phase
reports (REPORT_FOR_CHAT.md, OneDrive, pbcopy) and waits for sign-off.

SOURCE: 2026-11-14 investigation (assessment inputs frozen). Root cause:
style.css:6458 freezes inputs by pointer-events only; label.opp-assess-level
(app.js:3699) bypasses it; keyboard bypasses it; no assessment control is
disabled while frozen (app.js:7761 sets is-frozen from oppOpenRequest).
Server (423) is correct and unchanged.

JOHN'S RULING: scoring stays REFUSED while a transition request is open.
The freeze is right; the UI must be honest about it.

F1 FROZEN PANE. While oppOpenRequest is open, render the assessment pane's
   level radios, figure, currency and reason boxes, and its Save/Discard,
   DISABLED at render time (the unanchored mechanism, app.js:3696/4031).
   Add one line in the assessment save bar, visible in the viewport at the
   pane: "Frozen: a move to <target stage> is awaiting approval. Withdraw
   the request to edit it." (target from the open request). Lens sub-tabs
   stay usable so the frozen record can still be READ.
F2 PER-DRAFT SAVE. A reason-required draft with no reason no longer blocks
   other drafts. Save sends every valid draft; the invalid ones stay as
   drafts; the bar reports "Saved N of M. Not saved: <criterion> (<lens>),
   reason required." using the existing Saved/Not saved grammar.
F3 READER NAVIGATION. On a not-mine record the lens sub-tabs switch panes.
   Every input stays disabled (door unchanged for inputs). Find what sets
   pointer-events:none on the sub-tabs and exempt navigation only.

PHASE 1: confirm premises (read-only). For F1: every assessment control
the template renders and where each would take disabled. For F2: the
pre-flight check and the save loop, file:line. For F3: the rule or door
step that kills the sub-tabs. Any premise false: STOP.

PHASE 2: build F1 to F3 and prove:
- Frozen fixture (real API, real request raised), all five lenses, MOUSE
  AND KEYBOARD: no control activates or takes text; 0 POSTs; the in-pane
  line is inside the viewport at 1240/1440/1920; sub-tabs switch.
- Withdraw the request through the real route: pane editable again
  without reload or with one reload (state which), a score saves 201.
- Owned unfrozen: the 14 investigation cases still save and read back.
- F2: Unknown with no reason on Organisational plus valid drafts on two
  other lenses: the valid ones save 201 and read back, the invalid one
  stays a draft, bar wording exact.
- F3: on a not-mine record, every lens tab shows its pane; 0 enabled
  inputs (settled wait); 0 writes.
- Calibrate each: remove the render-time disable (label selects again,
  keyboard types); remove the in-pane line; restore the blocking
  pre-flight; restore the sub-tab block. Each named check fails.
- Screenshots at 1240/1440/1920 of frozen, F2 bar, not-mine.
- Radar and roll-ups unchanged (probe-rollups and probe-radar green).
Fixtures soft-deleted, open requests withdrawn first, all listed.

PHASE 3: DESIGN_PRINCIPLES: the freeze lesson (a pointer-events lock is
not a lock: labels and the keyboard pass it; a freeze disables at render).
Full gate, no skipped stages. Push-ready SHA. STOP.

QUEUED, NOT THIS ROUND: view-wide keyboard reach of frozen inputs; revision
reason prefill/append; gate-hygiene round; workflow audit_log gap; C3;
refusal wording; CHECKING...; per-lens spider.

---

## PHASE 1 SIGN-OFF (John, 2026-11-15), appended at the phase it launches

F1, F2 premises ACCEPTED as reported.
- Cancel is the Discard the brief means; no label change.
- Disclosure buttons stay live while frozen.
- Bar shown on its own while frozen; measure it in the viewport at
  1240/1440/1920.
- The sweep as a second writer of disabled: accepted on order today;
  Phase 2 reads state after a settled wait so a reorder fails the proof.
F2 positions ACCEPTED: oppAssessMissingLevels gate unchanged; one
"Not saved:" list, semicolon-separated, for skipped and server-refused.

F3: John rules OPTION A. Add 'tabpanel' to NON_WIDGET_ROLES (app.js:1978).
Proof additions for A:
- On both not-mine records, #opp-tab-assessment AND #opp-tab-reference:
  no is-inert-action or aria-disabled on the panel after a settled wait;
  every lens sub-tab switches its pane; Reference navigation works.
- Census, settled wait, both panels: 0 enabled inputs/selects/textareas;
  0 enabled non-navigation buttons; 0 writes.
- On an OWNED record: both panels unchanged (no new disabled, no lost
  tab stop beyond the panel's own).
- Calibrate: remove 'tabpanel' from NON_WIDGET_ROLES and the sub-tab
  switch check fails on both panels.
- Server unchanged; RLS untouched.

Proceed to Phase 2. Stop for sign-off.

---

## PHASE 2 SIGN-OFF (John, 2026-11-15), appended at the phase it launches

Phase 2 ACCEPTED at bf4c190.
Departure 1 ACCEPTED (Reference measured as panel reach).
Departure 2 ACCEPTED: keep oppAssessSaveReport. Success message wipe
  stays queued (finding B).
Departure 3 ACCEPTED (enumerate-controls.mjs gains 'tabpanel').
Departure 4 AMENDED: while frozen, Cancel is ENABLED when the pane holds
  drafts, DISABLED when it holds none. Save stays disabled while frozen.
  Cancel only clears page-memory drafts; it writes nothing.
  Proof: the pre-freeze draft case, Cancel clears the draft, 0 writes,
  fields stay disabled, frozen line stays. Calibrate: with Cancel
  disabled again, the clear check fails.
Owned-record census limit: accepted as stated (no change detected; not
  a calibrated detector).

Findings QUEUED for the next round (not this one):
  B pulse reload after a save wipes "Saved N of N" and resets the lens
    to Commercial;
  C key-contact name link (span.kc-name role=link) inert for readers.
Finding A queued low.

Proceed to Phase 3 with the Departure 4 amendment built first, then:
DESIGN_PRINCIPLES freeze lesson, full gate (NordVPN OFF, PUPPETEER_PATH
set, no skipped stages), push-ready SHA. Rule 18. Stop.
