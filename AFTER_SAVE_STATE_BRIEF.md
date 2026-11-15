ROUND: AFTER-SAVE STATE AND READER LINKS
Base: main at b2adae3 (confirm by ls-remote; differs: STOP).
Branch: after-save-state. First commit: this brief verbatim as
AFTER_SAVE_STATE_BRIEF.md. ls-remote base check at branch and merge.
Rule 18. NordVPN OFF and PUPPETEER_PATH set for the gate. Each phase
reports (REPORT_FOR_CHAT.md, OneDrive, pbcopy) and waits for sign-off.
No layout change: anything that moves panel structure STOPS (mockup rule).

SOURCE: ASSESSMENT PANE FIXES Phase 2 and 3 findings.
B  After a save that lands, the record advances, a pulse reloads it and
   the remount rebuilds the view: "Saved N of N" is wiped, the visible
   lens resets to Commercial, and an in-page reopen can land on the
   Reference tab. Measured on 1b1c221 too (pre-existing).
C  On a not-mine record, the key-contact name link (span.kc-name
   role=link, opens the contact) is marked inert by the door's third
   loop. Reader navigation killed (same family as F3).
A  (low, investigate only) On an in-page reopen the record loads twice
   (navigate, then pulse); each load nulls oppOpenRequest before awaiting
   it, so a mount can briefly render live controls.

GOAL, in John's terms: after you save, you stay where you were (same top
tab, same lens), and you see what happened (the Saved / Not saved line).
A reader can open a contact from someone else's record.

PHASE 1: INVESTIGATE (read-only)
1. The pulse: what triggers the reload after a save (file:line), what it
   compares, and whether it can tell the user's OWN accepted write from
   someone else's change. Cite recordQueue and the last-accepted-response
   precondition (Architecture 13/P3) if relevant.
2. What a reload resets: active top tab, active lens sub-tab, save bar
   message, scroll position, drafts. Measure each before and after a
   save on a john+test fixture.
3. Why an in-page reopen lands on Reference: the code that picks the top
   tab on load.
4. Finding A: is the double load the same pulse? If yes, say so.
5. C: the door step that marks span.kc-name inert, why it is classed as
   an action, and what the contact view does for a not-mine reader
   (read-only? door applied?).
6. Propose fix options for B, with trade-offs. Expected candidates:
   (a) the pulse skips a reload when the revision change is the user's
       own accepted write;
   (b) keep view state (top tab, lens, save message) per record across
       a reload;
   (c) both.
   Name what each could break (e.g. a stale view after someone else's
   change). Recommend one. DO NOT BUILD.
STOP and report.

PHASE 2: BUILD the ruled option for B, C, and A if Phase 1 ties it to B.
Proof on john+test fixtures, real clicks:
- Save on each of the five lenses: after the save settles, the same top
  tab and the same lens are shown; the bar reads the exact Saved / Not
  saved sentence; the entry is at the authority.
- In-page reopen: lands on the tab it should (state the rule), not
  Reference by accident.
- Another user's change (second account or a server-side revision by the
  real API as a different identity) still reaches the view: the view
  updates, so the fix has not hidden real changes.
- C: on two not-mine records, the key-contact name opens the contact by a
  real click; the contact view is read-only for the reader (0 enabled
  inputs after a settled wait); 0 writes. On an owned record, unchanged.
- A (if fixed): the reopen loads once, or no live control renders while
  oppOpenRequest is unresolved.
- Calibrate each fix: undo it, the named check fails.
- probe-rollups, probe-radar, probe-assess-pane green.
Fixtures soft-deleted, open requests withdrawn first, all listed.
STOP and report.

PHASE 3: DESIGN_PRINCIPLES entry (a reload caused by your own write must
not cost you your place or your message; the reason). Regenerate
CURRENT_STATE if affected. Full gate, no skipped stages. Push-ready SHA.
STOP.

QUEUED, NOT THIS ROUND: view-wide keyboard reach of frozen inputs;
revision reason prefill/append; gate hygiene (skip rule, wire probe-gaps,
5 Commercials failures); workflow audit_log gap; C3; refusal wording;
CHECKING...; per-lens spider.

---

PHASE 1 SIGN-OFF (John, 2026-11-15), appended at the phase it launches

Phase 1 ACCEPTED. Premise corrections noted: Reference-on-arrival is a
deliberate rule; finding A is the pulse racing its own record's load.

B: John rules OPTION (b). Per record, across any reload of the SAME
record, keep: top tab (whatever is showing, clicked or landed), lens
(restore oppAssessCurrentLens at mount; fall back to the first lens if
it no longer exists), scroll (restored once the remount settles), and
the save message (widen oppAssessSaveReport to success; dropped at the
next draft change, Cancel, the next save, or leaving the record).
Arrival rule unchanged: a navigation to a record still lands on
Reference. No server change.

A: FOLDED IN. The pulse does not tick while its own record's load is in
flight. The guard MUST release when the load fails as well as when it
finishes. Proof: a forced load failure (in-page stub) is followed by a
pulse tick that runs; calibrate by removing the release.

C: John rules '[role="link"]' added to NON_ACTION_SELECTOR. Add a pure
census test: exactly one role="link" element in source (the kc-name
span) and no setAttribute('role','link'); a new one fails the test by
name. Contact view for the reader: 0 enabled inputs after a settled
wait, 0 writes.

Phase 2 proof as the brief states, plus:
- B under an OUTSIDE change: another identity's real write reloads the
  view, the change is visible, and tab, lens, scroll and message are
  kept. This is the case (b) exists for; it must be measured, not
  reasoned.
- Message lifetime: each drop condition measured once.
- A: reopen-after-outside-change run at least 6 times: 0 double loads.
Calibrate every fix. Stop for sign-off.
