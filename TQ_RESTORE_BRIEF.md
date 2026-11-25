# TQ_RESTORE: version list, Restore and an unsaved-edits guard on the Term quote tab

Branched off origin/main at 5df8ad3 (John's push of F5; ls-remote read
5df8ad3 on 2026-11-25 before branching). This brief is the round's first
commit.

## The block (John, 2026-11-25), verbatim

ROUND TQ_RESTORE: version list, Restore and an unsaved-edits guard on the Term quote tab.
Branch off origin/main at 5df8ad3 (John's push of F5). If ls-remote does not read 5df8ad3, STOP. Brief first commit.

PURPOSE: today a salesperson cannot see or bring back an earlier term quote (TERM_QUOTES departure 9), and typed term edits can be lost on navigation with no warning (TERM_QUOTES close-out, "not done yet").

DECIDED (raise conflicts in Phase 0, do not reopen):
R1  The Term quote tab lists the record's term_quote versions only, newest first, with the same component, labels and states as the Commercials version list (V<major>.<minor>; Draft | Awaiting approval | Approved; date; reason). Each row's figure: issued versions show their frozen Base TCV; drafts show Base TCV priced on their own stored snapshot, labelled "as saved".
R2  Restore loads the version's inputs into the Term quote tab as UNSAVED edits. Nothing is written until Save; the Save/Discard bar governs, as on Commercials. The restored quote prices on today's settings (R-TQ2); if today's params differ from that version's stored snapshot, the reopened-draft banner shows, naming that version.
R3  Restore never creates a version or writes the record by itself.
R4  Closed Won: Restore is not offered (the won lock, both kinds).
R5  The unsaved-edits guard on the Term quote tab matches the Commercials guard exactly: same triggers, same wording, same choices. No new kind of prompt.
R6  No migration expected. If Phase 0 finds one is needed, STOP and draft it for my review.
R7  Mockup gate: reuse only. If the Commercials list or guard cannot serve the Term quote tab without a layout change, STOP for a mockup.

GOLDENS (fixture params only; never write live settings):
TR-1  Version V1.0 saved at SafeSight 60 units, 120 months (Base TCV 3,414,000.00). Edit the tab to 80 units, 96 months (3,978,240.00), do not save, Restore V1.0: the tab reads 3,414,000.00 with unsaved edits pending; the record and the version count are unchanged until Save.
TR-2  Same, then Discard: the tab returns to the last saved working quote (80 units, 96 months, if saved; otherwise the record's termQuote), as Commercials does.
TR-3  Edit, then navigate to another record: the guard prompts with the Commercials wording; choosing to stay keeps the edits.

PHASE 0 (read-only, then STOP):
P1  How the Commercials version list and Restore work today: component, route (POST restore), client flow, and how restored inputs reach the form and the Save/Discard bar.
P2  Whether that component can serve term versions through the term seam, and exactly what differs (kind filter, figure per row, restore target).
P3  Every unsaved-edits guard on Commercials: triggers (navigate away, record switch, tab switch, method switch, browser close or reload), mechanism, wording. Which of them the Term quote tab already has.
P4  What happens today to unsaved term edits on: a switch to the Commercials tab, a method switch, a save elsewhere on the record. Measured from the click.
P5  The restore route's Closed Won and kind handling today (Restore refusing a term version on the Commercials tab, departure 9).
P6  Probe plan from the click: the list, Restore, TR-1 to TR-3, Closed Won, and calibration (an injected Restore that writes the record FIRES; an injected missing guard FIRES).
P7  Any conflict with R1 to R7, with a recommendation.
STOP with the report.

After rulings: spec, tests fail first in their own commit, build, calibration (each FIRES), probe, sweep 1240..1920 step 40 on the tab with the list open, full gate, merge --no-ff, merged gate, ls-remote, and STOP with the report. Do not say "ready for John's push" until I have read it.

## Sources the block cites

- TERM_QUOTES departure 9 (2026-11-21 close-out): "The Term quote tab has no
  version list or Restore. On the Commercials tab, Restore refuses a term
  version in words, rather than pouring a quote into the Commercials form."
- TERM_QUOTES close-out, "Not done yet": "No guard against leaving the Term
  quote tab with unsaved edits. Unsaved inputs are kept across reloads. But
  nothing asks before you navigate away, as the Commercials panel's guards do."

## Phase record

Rulings given after Phase 0 are appended below at the phase they launch.

### Phase 0: STOPPED for rulings (2026-11-25)

Report: OneDrive 2026-11-25_TQ_RESTORE_PHASE_0.md. Measured from the click by
scripts/tq-restore/p0-measure.mjs and p0-cross-record.mjs.

- OUTSIDE SCOPE, destroying live data: the Commercials form shows the
  previously opened record's values on the next record, unmarked, and a save
  writes them (fixture B's duration 48 overwritten with A's 36). DealPanel is
  re-rendered per record with no key and seeds its state once. Raised under
  build discipline 10's live-data exception; the ruling is John's.
- P7 conflicts raised: R5 against TR-3 (Commercials guards Restore-on-dirty
  only); R2's bar (the Term quote tab has none; Commercials' strip says Reset,
  not Discard); R1's figure line against R7; TR-1's 3,978,240.00 is not today's
  live figure (4,026,624.00); R4 against W6 on the Commercials tab; the reopened
  banner's closing sentence for a restored version.
