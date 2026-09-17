# TEST BED WORKFLOW CORE: Phase 4 report (the riders: B5, R4, L9, and the buyer widths)

**Model: this session is running Claude Opus 5 (claude-opus-5[1m]).**

## Not built, first

Nothing in 4.1 to 4.3 or in the buyer-width rider is left unbuilt. One thing
was built, measured, and **removed again** because it answered a harness
artefact, not production (finding 2). One question is **left for a ruling
rather than built** (finding 1): whether the blocked list should clear when the
host reloads its own record after a save, which the vanilla did and this build
does not.

## Rulings and commits

The Phase 3 sign-off carries were appended to the brief before any work
(36408a5).

    36408a5  brief: Phase 3 sign-off carries, at the phase they launch
    abe38d6  the feedback id returns (B5), Back to test beds (R4), the six identity rows (L9)
    1c777aa  the host's record type declares what GET /test-beds/:id carries (typecheck fix, finding 4)
    adfd995  instruments: live riders probe, calibration specs, the P0 instrument kept alive
    4cc4dae  instruments: the another-record check lands on a cached record, live spec C

**No server file changed**: git diff 6da809e..HEAD -- src supabase is 0 lines.

## What was built

| Item | Built as |
|---|---|
| 4.1 | StageTabs.tsx renders `<div id="tb-next-stage-feedback" className="tb-next-stage-feedback">` once, beside its testid. React never writes its children: the shell's attemptTransition writes the list there and clears it at the top of the next attempt. No tab-change clear (R8) |
| 4.2 | ViewHeader.tsx renders `Back to test beds` as its first child, `button.btn-text#btn-back-testbeds`, calling `shell.navigate('test-beds')` (R4). The `btn-back-` id is what the door's NON_ACTION_SELECTOR exempts, so it is load-bearing, and no-duplicate-ids.test.mjs carries a disposition for it |
| 4.3 | identity.ts (`identityRows`, `ageFrom`) and six read-only FieldRows in TestBedPanel.tsx, in the positions of 54001c5^:frontend/test-bed-detail.js:433-495. Terminus Details: Terminus Reference after the name, Industry and Stage at the end. Customer Details: Account first. Key Dates: Date Created and Age first. Age is computed at display time from `created_at` with the vanilla's daysAgo rule (floor; Today, 1 day, N days) |

**Tests:** testbed-riders.test.tsx, 10, through the real host, driven by the
bed captured from the route in Phase 3 (buyers-live.json). React suite: 1159 at
the Phase 3 close, **1169** now, emitted by the reverted run of the unit
calibration.

## Evidence, live

scripts/testbed-core/probe-p4-riders.mjs on the committed tree
(TBCORE_RUN=p4-riders-head2): **22/22**.

    F  4.1
       Next Stage was refused 422 with a blocking list                                  (422, 13 items)
       exactly one #tb-next-stage-feedback, and it is the rendered feedback element
       the itemised blocking list RENDERS, every item                                   (13 items, 453px)
       it is visible, below the tab row
       R8: the list SURVIVES a switch to Reference and back                             (13 items)
       a second attempt renders its own answer, once (the shell clears at the top of an attempt)
       opening ANOTHER Test Bed shows none of this record's blocked list                (0 items)
    I  4.3
       Reference and Stage are the DATABASE's                                           (TT-SG-AIRPRT-790 / Qualification)
       Industry and Account are what the route returns                                  (Airports / the fixture Account)
       Date Created is created_at as DD/MM/YY                                           (17/09/26)
       Age is computed from created_at: minutes old reads Today
       all six sit in the vanilla's positions
       all six are visible, read-only, and out of the tab order
    W  buyer rows (below)
    B  4.2
       Back to test beds is visible above the title and reachable (a click at its centre reaches it)
       clicking it shows the test bed list and hides the detail view
       on an UNOWNED record the door leaves Back live
       and it still navigates to the list

**P0.4 closing proof, under a new run label** (TBCORE_RUN=p4-close-2):
`getElementById('tb-next-stage-feedback') present=true`, the 422 carried 14
blocking items, and the rendered list held all 14 with "Transition blocked" on
screen. The record's fingerprint was unchanged. At Phase 0 the same instrument
read present=false. The run also re-closed P0.1, P0.2, P0.3, P0.5 and P0.6
(finding 3 is why the first close run, p4-close, did not reach P0.6).

## The buyer rows at three widths

Measured before any capture, with a linked row, a refused row (a real 404: the
contact was deleted out of band after the page loaded) and a plain row:

    1240  card 420px; 3 rows inside the card; both selects 120px; the refusal below its controls; no page overflow
    1920  the same
    3440  the same

The card is 420px at all three widths, so these widths do not move this card;
the claim is that its three row states fit at each. **Self-calibrated in the
run**: a browser-only style forcing a select to 2000px made the check FIRE, and
removing it made the check pass again. The captures were not opened: these claims
rest on the measurements.

## Calibration, both directions

**calibrate-unit.mjs spec p4-riders: 15/15 fired on their named tests;
reverted React suite 1169/1169 (62 files)**, re-run on HEAD. Injections:

- the feedback id removed (the B5 defect);
- the vanilla class removed;
- a remount per tab (R8);
- back navigating somewhere else;
- back losing the door-exempt id;
- back losing its treatment;
- Terminus Reference out of position;
- Industry reading nothing;
- Account not first;
- Date Created unformatted;
- Age from a fixed clock rather than display time;
- the rows becoming editable;
- Age with no Today;
- Age rounded rather than floored;
- Age reading NaN days.

**calibrate-live.mjs, re-run with the final probe, each restoring sources and
the committed bundle byte-identical:**

    spec a  the feedback id removed      FIRED  "the itemised blocking list RENDERS, every item"     <- the brief's "proof reddens with the id removed"
            back loses btn-back-testbeds FIRED  "on an UNOWNED record the door leaves Back live"
    spec b  key={active} on the feedback FIRED  "R8: the list SURVIVES a switch to Reference and back"
    spec c  TestBedView's key removed    FIRED  "opening ANOTHER Test Bed shows none of this record's blocked list"  (13 items followed)

**Spec c came back SILENT twice before it fired, and each silence was
explained, not waved through (Verification 51):**

1. Its first target was a record-change clear inside StageTabs (finding 2).
   Removing it changed nothing live, because production never re-renders the
   host with a new record: TestBedView remounts it by `key={navToken ?? id}`.
   The clear was redundant in production, so it was removed.
2. Aimed at that key, it was silent again. A record never loaded passes through
   the query's pending state, which unmounts the host whatever its key. The
   check could only discriminate on a CACHED record, so the probe now visits the
   second fixture first and returns to it later. With that change it fired.

**What spec c establishes:** on a cached record, the key is the one thing
keeping a blocked list from following the person. On an uncached record, the
pending state keeps it too.

## Findings

1. **R11: the vanilla cleared the blocked list on EVERY render, so R8's parity
   is narrower than "cleared only at the next attempt".**
   54001c5^:frontend/app.js:6764-6765 (`wireTbNextStageButton`, called from the
   Test Bed render at 6731) set the feedback's innerHTML to ''. The capabilities
   document's X2 says this ("cleared when the state is wired"), so here the
   document and the vanilla agree.
   - Measured parity: across tab switches, the list persists in both (the
     vanilla's tab switch did not re-render the record). A navigation to another
     record, and the shell's reload after a transition, clear it in both: here
     through the remount.
   - **The one divergence: the host's own `load()` after a save** (TestBedHost,
     for example after a score or a buyer link). The vanilla re-rendered and
     cleared the list; React keeps it.
   - **Not built, for a ruling:** R8 said no tab-change clear, and this is not
     a tab change.
2. **A clear built for a harness artefact, measured and removed.** A jsdom test
   that re-rendered TestBedHost directly with a second record showed the list
   following. A clear keyed on the record was added for it. Live spec c then
   showed it changed nothing in production (the shell remounts), so the clear
   and its test were removed. Verification 47's clause: that jsdom test invoked
   the host the way production never does.
3. **probe-p0.mjs had rotted in its P0.5 section.** It waited for the lookup
   row that Phase 3 removed, so the first close run died before P0.6. It now
   accepts the Phase 3 direct-write rows and reports them as superseding the
   lookup (3 rows, 0 lookup FieldRows). The fix is in adfd995.
4. **The pre-commit hook does not typecheck.** abe38d6 passed the hook and failed
   `tsc`: the host cast the record to the identity type, and BedLike did not
   declare the fields. 1c777aa declares them and drops the cast. Typecheck is
   now run by hand before each commit.
5. **Date Created follows the shared formatter (DD/MM/YY), not the vanilla's
   `toLocaleDateString` ("17 Sep 26").** This is an R11 disagreement, with the
   position taken and revisitable. The shared-formatter ruling (93b9a2f,
   2026-09-12) came after 54001c5 (2026-09-08), and today's shell formatDate
   routes through it too. R11 settles the capabilities document against the
   vanilla. It does not re-open a later business ruling.
6. **One stated departure on Age:** the vanilla printed "NaN days" for a missing
   or unreadable date. This build prints nothing, so the row reads as not
   recorded. Calibrated (the NaN injection fires).

## Process notes

- **Two process errors of mine, both caught before commit.**
  - Chained edit.mjs heredocs whose bodies were out of order refused with
    "anchor not found", and once inserted a stray placeholder line into
    TestBedPanel.tsx. The line was removed through edit.mjs, and the edits then
    ran one at a time.
  - The typecheck gap (finding 4).
- **Teardown by tag prefix:** the second fixture's tag extends the first, so the
  first tearDown removed both beds. The second call reports removed 0, remaining
  0, which is correct and reads oddly.
- **Hook database stage on this phase's commits (K3):** 143.8s and 155.2s where
  captured, up from 123.2s to 129.9s at Phase 3.
- **Residue:** 251 records created by the probe identity since 03:40, including
  hook database suites. LIVE: 0.
- **Environment unchanged:** Chrome for Testing 152 via PUPPETEER_EXECUTABLE_PATH,
  the browser run outside the command sandbox.

## For the list (Rule 10), not acted on

- Finding 1's host-reload clear, for a ruling.
- Finding 4: the hook has no typecheck stage.
- Carried and unchanged: the route accepting a second contact in an
  already-linked role (Round B's server scope); C6 and C9 annotated at the close
  (R11); K1, K2 and K3.

## What this does not establish

- Whether the blocked list clears after a host-internal reload in the vanilla
  as MEASURED live. The claim rests on reading 54001c5^, not on running it.
- Any viewport effect on the buyer card beyond these three widths. The card is a
  fixed 420px at all three.
- The two back-navigation proofs on any record type other than Test Bed.
