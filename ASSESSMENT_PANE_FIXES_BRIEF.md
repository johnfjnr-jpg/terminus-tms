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
