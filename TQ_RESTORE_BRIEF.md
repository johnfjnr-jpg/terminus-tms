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

## Rulings on Phase 0 (John, 2026-11-25), appended verbatim as received

RECEIVED TRUNCATED: the paste ends mid-sentence inside B. Everything after
"on its own" was not received. X is worked; B and anything after it wait.

TQ_RESTORE: rulings on Phase 0 (John, 2026-11-25).

X  THE CROSS-RECORD FINDING IS FIXED FIRST, in this round (build discipline 10).
X1 Key the deal panel by record (key={rec.id} or equivalent) so the Commercials form and its baseline are seeded per record. Tests fail first in their own commit: the two-record save from p0-cross-record (A 10/36, B 20/48; open A then B; B must show 20/48, unmarked; type 21 on B and save; B must hold 21/48).
X2 Read-only census, before the fix lands: for the live opportunities, list any revision whose Commercials keys equal another record's revision taken earlier the same day, excluding defaults and empty forms. Report candidates with record, revision, author and time. No repair. If none, say so with the query.
X3 Correct the wrong comment at DealPanel.tsx:323.

G  ONE GUARD, BOTH TABS (supersedes R5's "same triggers").
G1 One registry of dirty sources, asked by navigate() and beforeunload. Registered: the Commercials form and the Term quote tab (and the existing Assessment drafts, unchanged).
G2 Triggers: Restore while dirty, navigating to another record, browser close or reload. Tab switches and method switches keep edits (measured, P4) and do not prompt.
G3 The existing dialogue only: "Discard unsaved changes?", Keep editing | Discard. No new wording.

S  THE STRIP ON THE TERM QUOTE TAB: reuse of the Commercials "Modified, not saved" strip, its markup and classes (not a layout change under R7). "Save changes" writes the record's termQuote only, through the existing PATCH; "Reset" returns to the saved quote. TR-2 reads Reset, not Discard.

L  THE LIST.
L1 Extract VersionList (range toggle, rows, Restore) from VersionCard; both tabs render it; Commercials unchanged in look and behaviour.
L2 Each tab lists its own kind. Label gaps across kinds are expected.
L3 Term rows: one figure line in the row's existing note style, in place of "sections recorded": issued rows show frozen Base TCV; drafts show Base TCV priced on their own rates.params via priceTermVersion, labelled "as saved". Reuse, not a mockup.
L4 The list route selects rates and frozen_figures->page->ask. No migration.
L5 Restore targets the term seam's populateForm.
L6 Any Restore refusal reaches the card's feedback line, never an unawaited throw.
L7 States keep the existing lowercase spelling in the shared component.

W  CLOSED WON: Restore is not offered on either tab (supersedes W6). The term tab on a won deal keeps the won panel, no list.

B  BANNER after a Restore, when the restored version's stored snapshot differs from today's params, for drafts and issued versions alike:
   "Restored from V<x.y>. It was priced at <saved> on its own
   [TRUNCATED HERE]
